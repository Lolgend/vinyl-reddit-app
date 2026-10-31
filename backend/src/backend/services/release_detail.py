"""Release Detail Domain Service.

Provides compound entity resolution for Release Detail view, including
physical specifications, parent album links, hero KPIs, stepped LOCF time-series
curves, and 6-column Reddit submission provenance ledger.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.schemas.album import SubmissionMarker, TimeSeriesBucket
from backend.schemas.release import (
    ParentAlbumInfo,
    ProvenanceSummary,
    RedditSubmissionProvenance,
    ReleaseDetailResponse,
    ReleaseHeroKPI,
    ReleasePhysicalSpecs,
    SubmissionEngagement,
)
from backend.services.catalog import derive_album_id
from backend.services.hype import (
    DEFAULT_WINDOW,
    REFERENCE_FLOOR,
    WINDOW_CONFIG,
    WindowType,
    calculate_hype_index,
    compute_submission_metrics,
    get_hype_tier,
)
from backend.services.timeseries import (
    compute_locf_time_series,
    get_submission_markers,
)


def get_release_detail(
    session: Session,
    release_id: str | uuid.UUID,
    window: WindowType = DEFAULT_WINDOW,
    now: datetime | None = None,
) -> ReleaseDetailResponse | None:
    """Compute and construct compound ReleaseDetailResponse for a release_id."""
    if isinstance(release_id, str):
        try:
            rel_uuid = uuid.UUID(release_id)
        except ValueError:
            return None
    else:
        rel_uuid = release_id

    rel_id_str = str(rel_uuid)

    if window not in WINDOW_CONFIG:
        window = DEFAULT_WINDOW

    if now is None:
        now = datetime.now(timezone.utc)

    spec = WINDOW_CONFIG[window]
    t0 = now - timedelta(hours=spec.duration_hours)

    # 1. Fetch all releases ordered by created_at ASC, id ASC for deterministic album display casing
    release_sql = text(
        r"""
        SELECT
            r.id,
            r.combined_artist,
            r.album_title,
            r.variant,
            r.retailer_name,
            r.created_at,
            LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(r.combined_artist, '[\u2010-\u2015\u2212]', '-', 'g'), '\s+', ' ', 'g'))) AS norm_artist,
            LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(r.album_title, '[\u2010-\u2015\u2212]', '-', 'g'), '\s+', ' ', 'g'))) AS norm_album
        FROM releases r
        ORDER BY r.created_at ASC, r.id ASC
        """
    )
    releases_rows = session.execute(release_sql).fetchall()

    albums_dict: dict[str, dict[str, Any]] = {}
    target_row = None
    target_album_id: str | None = None

    for r in releases_rows:
        r_str = str(r.id)
        alb_id = derive_album_id(r.norm_artist, r.norm_album)

        if alb_id not in albums_dict:
            albums_dict[alb_id] = {
                "album_id": alb_id,
                "album_title": r.album_title,
                "combined_artist": r.combined_artist,
                "release_count": 1,
            }
        else:
            albums_dict[alb_id]["release_count"] += 1

        if r_str == rel_id_str:
            target_row = r
            target_album_id = alb_id

    if target_row is None or target_album_id is None:
        return None

    parent_album_dict = albums_dict[target_album_id]

    # 2. Fetch linked submissions where is_release = TRUE
    sub_sql = text(
        """
        SELECT
            sr.release_id,
            s.id AS submission_id,
            s.reddit_id,
            s.title,
            s.url,
            s.created_utc,
            s.latest_score,
            s.latest_num_comments,
            s.latest_upvote_ratio
        FROM submission_releases sr
        JOIN submissions s ON sr.submission_id = s.id
        WHERE s.is_release = TRUE
        """
    )
    sub_rows = session.execute(sub_sql).fetchall()

    # 3. Fetch snapshots for release submissions
    snap_sql = text(
        """
        SELECT
            ss.submission_id,
            ss.score,
            ss.num_comments,
            ss.captured_at
        FROM submission_snapshots ss
        JOIN submissions s ON ss.submission_id = s.id
        WHERE s.is_release = TRUE
        ORDER BY ss.submission_id, ss.captured_at ASC
        """
    )
    snap_rows = session.execute(snap_sql).fetchall()

    snapshots_by_sub: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for sn in snap_rows:
        snapshots_by_sub[sn.submission_id].append(
            {
                "captured_at": sn.captured_at,
                "score": sn.score,
                "num_comments": sn.num_comments,
            }
        )

    # Compute submission metrics
    submission_metrics: dict[str, dict[str, Any]] = {}
    release_submissions: dict[str, set[str]] = defaultdict(set)
    submissions_by_id: dict[str, dict[str, Any]] = {}

    for row in sub_rows:
        s_id = row.submission_id
        r_id = str(row.release_id)
        release_submissions[r_id].add(s_id)

        submissions_by_id[s_id] = {
            "id": s_id,
            "reddit_id": row.reddit_id,
            "title": row.title,
            "url": row.url,
            "created_utc": row.created_utc,
            "latest_score": row.latest_score,
            "latest_num_comments": row.latest_num_comments,
            "latest_upvote_ratio": row.latest_upvote_ratio,
        }

        if s_id in submission_metrics:
            continue

        submission_metrics[s_id] = compute_submission_metrics(
            created_utc=row.created_utc,
            latest_score=row.latest_score,
            latest_num_comments=row.latest_num_comments,
            latest_upvote_ratio=row.latest_upvote_ratio,
            snapshots=snapshots_by_sub.get(s_id, []),
            window=window,
            now=now,
            t0=t0,
        )

    # Compute raw hypes across all releases for cohort scaling
    release_raw_hypes: dict[str, float] = {}
    for r in releases_rows:
        r_id = str(r.id)
        linked_subs = release_submissions.get(r_id, set())
        release_raw_hypes[r_id] = sum(submission_metrics[s]["raw_hype"] for s in linked_subs)

    cohort_max_release = max(release_raw_hypes.values()) if release_raw_hypes else 0.0

    # Target release metrics
    target_sub_ids = release_submissions.get(rel_id_str, set())
    target_subs_list = [submissions_by_id[s_id] for s_id in target_sub_ids]

    target_raw_hype = release_raw_hypes.get(rel_id_str, 0.0)
    target_hype_index = calculate_hype_index(target_raw_hype, cohort_max_release, REFERENCE_FLOOR)
    target_tier = get_hype_tier(target_hype_index)
    target_velocity = round(sum(submission_metrics[s]["velocity"] for s in target_sub_ids), 1)

    if target_subs_list:
        first_seen_at = min(s["created_utc"] for s in target_subs_list)
        last_seen_at = max(s["created_utc"] for s in target_subs_list)
        total_score = sum(s["latest_score"] for s in target_subs_list)
        total_comments = sum(s["latest_num_comments"] for s in target_subs_list)
        points_gain = sum(submission_metrics[s["id"]]["delta_e"] for s in target_subs_list)
    else:
        first_seen_at = target_row.created_at
        last_seen_at = target_row.created_at
        total_score = 0
        total_comments = 0
        points_gain = 0

    # Time series & Markers
    raw_buckets = compute_locf_time_series(
        submissions=target_subs_list,
        snapshots_by_sub=snapshots_by_sub,
        window=window,
        now=now,
    )
    time_series = [TimeSeriesBucket(**b) for b in raw_buckets]

    raw_markers = get_submission_markers(target_subs_list, t0, now)
    submission_markers = [SubmissionMarker(**m) for m in raw_markers]

    # Provenance Submissions list (6 columns)
    provenance_subs: list[RedditSubmissionProvenance] = []
    for s in target_subs_list:
        sub_id = s["id"]
        reddit_id = s.get("reddit_id")
        reddit_url = (
            f"https://www.reddit.com/comments/{reddit_id}"
            if reddit_id
            else (
                s["url"]
                if "reddit.com" in (s.get("url") or "")
                else f"https://www.reddit.com/comments/{sub_id.replace('t3_', '')}"
            )
        )
        provenance_subs.append(
            RedditSubmissionProvenance(
                submission_id=sub_id,
                title=s["title"],
                created_utc=s["created_utc"],
                latest_score=s["latest_score"],
                latest_upvote_ratio=s["latest_upvote_ratio"],
                latest_num_comments=s["latest_num_comments"],
                window_velocity=submission_metrics[sub_id]["velocity"],
                url=reddit_url,
                external_url=s.get("url"),
            )
        )

    # Sort provenance submissions chronologically DESC (most recent first)
    provenance_subs.sort(key=lambda x: x.created_utc, reverse=True)

    variant_val = target_row.variant if target_row.variant and target_row.variant.strip() else "Standard Pressing"
    retailer_val = target_row.retailer_name if target_row.retailer_name and target_row.retailer_name.strip() else "Wide / Unspecified"

    art_row = session.execute(
        text("SELECT artist_id FROM release_artists WHERE release_id = :r_id LIMIT 1"),
        {"r_id": rel_id_str},
    ).fetchone()
    artist_id = str(art_row.artist_id) if art_row else None

    specs = ReleasePhysicalSpecs(
        release_id=rel_id_str,
        album_id=target_album_id,
        album_title=parent_album_dict["album_title"],
        combined_artist=target_row.combined_artist,
        variant=variant_val,
        retailer_name=retailer_val,
        first_seen_at=first_seen_at,
        last_seen_at=last_seen_at,
        monogram_key=rel_id_str,
        artist_id=artist_id,
    )

    parent_album = ParentAlbumInfo(
        album_id=target_album_id,
        album_title=parent_album_dict["album_title"],
        release_count=parent_album_dict["release_count"],
    )

    upvote_ratios = [
        s["latest_upvote_ratio"]
        for s in target_subs_list
        if s.get("latest_upvote_ratio") is not None
    ]
    avg_upvote_ratio = (
        round(sum(upvote_ratios) / len(upvote_ratios), 2)
        if upvote_ratios
        else None
    )

    submission_engagement = SubmissionEngagement(
        points_gain=points_gain,
        total_score=total_score,
        total_comments=total_comments,
        submission_count=len(target_subs_list),
        upvote_ratio=avg_upvote_ratio,
        latest_upvote_ratio=avg_upvote_ratio,
    )

    provenance_summary = ProvenanceSummary(
        first_seen_at=first_seen_at,
        last_seen_at=last_seen_at,
        linked_submissions_count=len(target_subs_list),
    )

    hero_kpi = ReleaseHeroKPI(
        hype_index=target_hype_index,
        tier=target_tier,
        hype_velocity=target_velocity,
        submission_engagement=submission_engagement,
        provenance_summary=provenance_summary,
        points_gain=points_gain,
        total_score=total_score,
        total_comments=total_comments,
        submission_count=len(target_subs_list),
        first_seen_at=first_seen_at,
        last_seen_at=last_seen_at,
    )

    return ReleaseDetailResponse(
        release_id=rel_id_str,
        album_id=target_album_id,
        album_title=parent_album_dict["album_title"],
        combined_artist=target_row.combined_artist,
        variant=variant_val,
        retailer_name=retailer_val,
        first_seen_at=first_seen_at,
        last_seen_at=last_seen_at,
        monogram_key=rel_id_str,
        window=window,
        specs=specs,
        parent_album=parent_album,
        hero_kpi=hero_kpi,
        time_series=time_series,
        submission_markers=submission_markers,
        submissions=provenance_subs,
    )


__all__ = ["get_release_detail"]
