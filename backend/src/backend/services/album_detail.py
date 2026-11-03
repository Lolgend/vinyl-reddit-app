"""Album Detail Domain Service.

Provides compound entity resolution for Album Detail view across the 3-tier
schema, including identity derivations, hero KPIs, LOCF time-series buckets,
submission event markers, child pressing share-of-demand, and comparison matrix.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.schemas.album import (
    AlbumDetailResponse,
    AlbumHeroKPI,
    AlbumIdentity,
    ArtistRef,
    ChildReleaseRow,
    PressingsProvenance,
    RedditDemand,
    ShareOfDemandItem,
    SubmissionMarker,
    TimeSeriesBucket,
)
from backend.services.hype import (
    DEFAULT_WINDOW,
    REFERENCE_FLOOR,
    WINDOW_CONFIG,
    WindowType,
    calculate_hype_index,
    fetch_submissions_and_metrics,
    get_hype_tier,
)
from backend.services.timeseries import (
    calculate_share_of_demand,
    compute_locf_time_series,
    get_submission_markers,
)


def get_album_detail(
    session: Session,
    album_id: str | uuid.UUID,
    window: WindowType = DEFAULT_WINDOW,
    now: datetime | None = None,
) -> AlbumDetailResponse | None:
    """Compute and construct compound AlbumDetailResponse for a canonical album_id.

    Pre-validates album_id as a UUID. Returns None if invalid or not found.
    """
    if isinstance(album_id, str):
        try:
            album_uuid = uuid.UUID(album_id)
        except (ValueError, AttributeError):
            return None
    elif isinstance(album_id, uuid.UUID):
        album_uuid = album_id
    else:
        return None

    if window not in WINDOW_CONFIG:
        window = DEFAULT_WINDOW

    if now is None:
        now = datetime.now(timezone.utc)

    spec = WINDOW_CONFIG[window]
    t0 = now - timedelta(hours=spec.duration_hours)

    # 1. Fetch target album directly from albums table
    target_album_row = session.execute(
        text(
            """
            SELECT id, combined_artist, title, created_at
            FROM albums
            WHERE id = :album_id
            """
        ),
        {"album_id": album_uuid},
    ).fetchone()

    if target_album_row is None:
        return None

    target_album_id_str = str(target_album_row.id)

    # 2. Fetch contributing artist chips directly from album_artists
    artist_rows = session.execute(
        text(
            """
            SELECT a.id AS artist_id, a.name AS artist_name
            FROM album_artists aa
            JOIN artists a ON aa.artist_id = a.id
            WHERE aa.album_id = :album_id
            ORDER BY a.name ASC, a.id ASC
            """
        ),
        {"album_id": album_uuid},
    ).fetchall()

    target_artists = [
        ArtistRef(artist_id=str(row.artist_id), name=row.artist_name) for row in artist_rows
    ]

    # 3. Fetch all catalog releases with album_id for cohort scaling
    releases_rows = session.execute(
        text(
            """
            SELECT id, album_id, variant, retailer_name, created_at
            FROM releases
            ORDER BY created_at ASC, id ASC
            """
        )
    ).fetchall()

    target_releases = [r for r in releases_rows if r.album_id == album_uuid]

    # 4. Fetch linked submissions and compute metrics via shared helper
    cohort = fetch_submissions_and_metrics(session=session, window=window, now=now)
    submission_metrics = cohort.submission_metrics
    release_submissions = cohort.release_submissions
    submissions_by_id = cohort.submissions_by_id
    snapshots_by_sub = cohort.snapshots_by_sub

    # Map releases by album for cohort calculations
    album_releases_map: dict[str, list[str]] = defaultdict(list)
    for r in releases_rows:
        album_releases_map[str(r.album_id)].append(str(r.id))

    # Compute raw hypes across all albums and releases for cohort scaling
    album_raw_hypes: list[float] = []
    release_raw_hypes: dict[str, float] = {}

    for rel_ids in album_releases_map.values():
        alb_subs: set[str] = set()
        for r_id in rel_ids:
            alb_subs.update(release_submissions.get(r_id, set()))
        alb_raw = sum(submission_metrics[s]["raw_hype"] for s in alb_subs)
        album_raw_hypes.append(alb_raw)

    for r in releases_rows:
        rel_id = str(r.id)
        linked_subs = release_submissions.get(rel_id, set())
        rel_raw = sum(submission_metrics[s]["raw_hype"] for s in linked_subs)
        release_raw_hypes[rel_id] = rel_raw

    cohort_max_album = max(album_raw_hypes) if album_raw_hypes else 0.0
    cohort_max_release = max(release_raw_hypes.values()) if release_raw_hypes else 0.0

    # Target album calculations
    target_union_subs: set[str] = set()
    for r in target_releases:
        target_union_subs.update(release_submissions.get(str(r.id), set()))

    target_raw_hype = sum(submission_metrics[s]["raw_hype"] for s in target_union_subs)
    target_album_hype_index = calculate_hype_index(
        target_raw_hype, cohort_max_album, REFERENCE_FLOOR
    )
    target_album_tier = get_hype_tier(target_album_hype_index)
    target_album_velocity = round(
        sum(submission_metrics[s]["velocity"] for s in target_union_subs), 1
    )

    target_subs_list = [submissions_by_id[s_id] for s_id in target_union_subs]

    # Dates and engagement (fall back to albums.created_at when no submissions)
    if target_subs_list:
        first_seen_at = min(s["created_utc"] for s in target_subs_list)
        last_seen_at = max(s["created_utc"] for s in target_subs_list)
        total_score = sum(s["latest_score"] for s in target_subs_list)
        total_comments = sum(s["latest_num_comments"] for s in target_subs_list)
        points_gain = sum(submission_metrics[s["id"]]["delta_e"] for s in target_subs_list)
    else:
        first_seen_at = target_album_row.created_at
        last_seen_at = target_album_row.created_at
        total_score = 0
        total_comments = 0
        points_gain = 0

    # Stepped LOCF Time Series
    raw_buckets = compute_locf_time_series(
        submissions=target_subs_list,
        snapshots_by_sub=snapshots_by_sub,
        window=window,
        now=now,
    )
    time_series = [TimeSeriesBucket(**b) for b in raw_buckets]

    # Submission event markers
    raw_markers = get_submission_markers(target_subs_list, t0, now)
    submission_markers = [SubmissionMarker(**m) for m in raw_markers]

    # Target releases for share-of-demand
    target_rel_dicts = [
        {
            "release_id": str(r.id),
            "variant": r.variant,
            "retailer_name": r.retailer_name,
        }
        for r in target_releases
    ]
    subs_by_release_map: dict[str, list[dict[str, Any]]] = {}
    for r in target_releases:
        rel_id = str(r.id)
        subs_by_release_map[rel_id] = [
            submissions_by_id[s_id] for s_id in release_submissions.get(rel_id, set())
        ]

    raw_shares = calculate_share_of_demand(target_rel_dicts, subs_by_release_map)
    share_of_demand = [ShareOfDemandItem(**s) for s in raw_shares]
    share_pct_by_rel_id = {s["release_id"]: s["share_percentage"] for s in raw_shares}

    # Child releases comparison matrix
    child_releases: list[ChildReleaseRow] = []
    for r in target_releases:
        rel_id = str(r.id)
        rel_subs = subs_by_release_map.get(rel_id, [])
        rel_sub_ids = release_submissions.get(rel_id, set())

        rel_vel = round(sum(submission_metrics[s]["velocity"] for s in rel_sub_ids), 1)
        rel_raw = release_raw_hypes.get(rel_id, 0.0)
        rel_hype_idx = calculate_hype_index(rel_raw, cohort_max_release, REFERENCE_FLOOR)
        rel_tier = get_hype_tier(rel_hype_idx)

        rel_score = sum(s["latest_score"] for s in rel_subs)
        rel_comm = sum(s["latest_num_comments"] for s in rel_subs)

        if rel_subs:
            rel_first_seen = min(s["created_utc"] for s in rel_subs)
            rel_last_seen = max(s["created_utc"] for s in rel_subs)
        else:
            rel_first_seen = r.created_at
            rel_last_seen = r.created_at

        child_releases.append(
            ChildReleaseRow(
                release_id=rel_id,
                variant=r.variant,
                retailer_name=r.retailer_name,
                share_percentage=share_pct_by_rel_id.get(rel_id, 0.0),
                hype_velocity=rel_vel,
                hype_index=rel_hype_idx,
                tier=rel_tier,
                submission_count=len(rel_subs),
                total_score=rel_score,
                total_comments=rel_comm,
                first_seen_at=rel_first_seen,
                last_seen_at=rel_last_seen,
            )
        )

    # Sort child releases by share_percentage DESC, then hype_velocity DESC
    child_releases.sort(key=lambda cr: (cr.share_percentage, cr.hype_velocity), reverse=True)

    # Assemble Identity and Hero KPIs
    album_identity = AlbumIdentity(
        album_id=target_album_id_str,
        album_title=target_album_row.title,
        combined_artist=target_album_row.combined_artist,
        monogram_key=target_album_id_str,
        first_seen_at=first_seen_at,
        last_seen_at=last_seen_at,
        artists=target_artists,
    )

    reddit_demand = RedditDemand(
        points_gain=points_gain,
        total_score=total_score,
        total_comments=total_comments,
        submission_count=len(target_subs_list),
    )

    provenance = PressingsProvenance(
        release_count=len(target_releases),
        submission_count=len(target_subs_list),
        first_seen_at=first_seen_at,
        last_seen_at=last_seen_at,
    )

    hero_kpi = AlbumHeroKPI(
        hype_index=target_album_hype_index,
        tier=target_album_tier,
        hype_velocity=target_album_velocity,
        reddit_demand=reddit_demand,
        pressings_provenance=provenance,
        points_gain=points_gain,
        total_score=total_score,
        total_comments=total_comments,
        submission_count=len(target_subs_list),
        release_count=len(target_releases),
        first_seen_at=first_seen_at,
        last_seen_at=last_seen_at,
    )

    return AlbumDetailResponse(
        album_id=target_album_id_str,
        album_title=target_album_row.title,
        combined_artist=target_album_row.combined_artist,
        monogram_key=target_album_id_str,
        first_seen_at=first_seen_at,
        last_seen_at=last_seen_at,
        window=window,
        album=album_identity,
        hero_kpi=hero_kpi,
        time_series=time_series,
        submission_markers=submission_markers,
        share_of_demand=share_of_demand,
        child_releases=child_releases,
    )


__all__ = ["get_album_detail"]
