"""Release Detail Domain Service.

Provides compound entity resolution for Release Detail view across the 3-tier
schema, including physical specifications, parent album links, hero KPIs,
stepped LOCF time-series curves, and 6-column Reddit submission provenance ledger.
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
    """Compute and construct compound ReleaseDetailResponse for a canonical release_id.

    Pre-validates release_id as a UUID. Returns None if invalid or not found.
    """
    if isinstance(release_id, str):
        try:
            rel_uuid = uuid.UUID(release_id)
        except (ValueError, AttributeError):
            return None
    elif isinstance(release_id, uuid.UUID):
        rel_uuid = release_id
    else:
        return None

    rel_id_str = str(rel_uuid)

    if window not in WINDOW_CONFIG:
        window = DEFAULT_WINDOW

    if now is None:
        now = datetime.now(timezone.utc)

    spec = WINDOW_CONFIG[window]
    t0 = now - timedelta(hours=spec.duration_hours)

    # 1. Fetch target release joined to parent album
    target_row = session.execute(
        text(
            """
            SELECT
                r.id AS release_id,
                r.album_id,
                r.variant,
                r.retailer_name,
                r.created_at AS release_created_at,
                a.title AS album_title,
                a.combined_artist
            FROM releases r
            JOIN albums a ON r.album_id = a.id
            WHERE r.id = :release_id
            """
        ),
        {"release_id": rel_uuid},
    ).fetchone()

    if target_row is None:
        return None

    target_album_uuid = target_row.album_id
    target_album_id_str = str(target_album_uuid)

    # 2. Count sibling releases under parent album
    sibling_count_row = session.execute(
        text(
            """
            SELECT COUNT(*) AS rel_count
            FROM releases
            WHERE album_id = :album_id
            """
        ),
        {"album_id": target_album_uuid},
    ).fetchone()
    sibling_release_count = int(sibling_count_row[0]) if sibling_count_row else 1

    # 3. Resolve primary artist_id deterministically from album_artists
    primary_artist_row = session.execute(
        text(
            """
            SELECT artist_id
            FROM album_artists
            WHERE album_id = :album_id
            ORDER BY created_at ASC, artist_id ASC
            LIMIT 1
            """
        ),
        {"album_id": target_album_uuid},
    ).fetchone()
    primary_artist_id = str(primary_artist_row.artist_id) if primary_artist_row else None

    # 4. Fetch all catalog releases for cohort scaling
    releases_rows = session.execute(
        text("SELECT id FROM releases ORDER BY created_at ASC, id ASC")
    ).fetchall()

    # 5. Fetch linked submissions where is_release = TRUE
    sub_rows = session.execute(
        text(
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
    ).fetchall()

    # 6. Fetch snapshots for release submissions
    snap_rows = session.execute(
        text(
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
    ).fetchall()

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
        first_seen_at = target_row.release_created_at
        last_seen_at = target_row.release_created_at
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

    variant_val = (
        target_row.variant
        if target_row.variant and target_row.variant.strip()
        else "Standard Pressing"
    )
    retailer_val = (
        target_row.retailer_name
        if target_row.retailer_name and target_row.retailer_name.strip()
        else "Wide / Unspecified"
    )

    specs = ReleasePhysicalSpecs(
        release_id=rel_id_str,
        album_id=target_album_id_str,
        album_title=target_row.album_title,
        combined_artist=target_row.combined_artist,
        variant=variant_val,
        retailer_name=retailer_val,
        first_seen_at=first_seen_at,
        last_seen_at=last_seen_at,
        monogram_key=rel_id_str,
        artist_id=primary_artist_id,
    )

    parent_album = ParentAlbumInfo(
        album_id=target_album_id_str,
        album_title=target_row.album_title,
        release_count=sibling_release_count,
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
        album_id=target_album_id_str,
        album_title=target_row.album_title,
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
