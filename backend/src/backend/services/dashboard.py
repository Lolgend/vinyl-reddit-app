"""Demand Dashboard Domain Service.

Computes Top Albums, Top Releases, Newly Added Releases, and Live Release Feed
across 24H, 7D, and 1M Hype Windows directly from the 3-tier database schema.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.schemas.dashboard import (
    AlbumLeaderboardItem,
    DashboardResponse,
    LiveFeedItem,
    NewlyAddedReleaseItem,
    ReleaseLeaderboardItem,
)
from backend.services.catalog import get_catalog_albums
from backend.services.hype import (
    DEFAULT_WINDOW,
    REFERENCE_FLOOR,
    WINDOW_CONFIG,
    WindowType,
    calculate_hype_index,
    fetch_submissions_and_metrics,
    get_hype_tier,
)


def get_dashboard_data(
    session: Session,
    window: WindowType = DEFAULT_WINDOW,
    now: datetime | None = None,
) -> DashboardResponse:
    """Compute and construct compound Dashboard response for the given window."""
    if window not in WINDOW_CONFIG:
        window = DEFAULT_WINDOW

    if now is None:
        now = datetime.now(timezone.utc)

    # 1. Fetch all persisted albums from the albums table using catalog helper
    catalog_albums = get_catalog_albums(session)

    # 2. Fetch releases joined to their parent albums via releases.album_id = albums.id
    releases_sql = text(
        """
        SELECT
            r.id,
            r.album_id,
            a.title AS album_title,
            a.combined_artist,
            r.variant,
            r.retailer_name,
            r.created_at
        FROM releases r
        JOIN albums a ON r.album_id = a.id
        ORDER BY r.created_at ASC, r.id ASC
        """
    )
    releases_rows = session.execute(releases_sql).fetchall()

    # 3. Fetch linked submissions and compute metrics via shared helper
    cohort = fetch_submissions_and_metrics(session=session, window=window, now=now)
    submission_metrics = cohort.submission_metrics
    release_submissions = cohort.release_submissions
    submission_metrics_24h = cohort.get_metrics_24h()

    # 24H cohort max for newly added scaling
    max_rel_raw_24h = max(
        (
            sum(
                submission_metrics_24h[s]["raw_hype"]
                for s in release_submissions.get(str(r.id), set())
            )
            for r in releases_rows
        ),
        default=0.0,
    )

    # Map releases and associate child releases per album
    album_release_ids: dict[str, list[str]] = defaultdict(list)
    release_dict: dict[str, dict[str, Any]] = {}

    for r in releases_rows:
        rel_id = str(r.id)
        alb_id = str(r.album_id)
        album_release_ids[alb_id].append(rel_id)

        # Release metrics calculation
        linked_subs = release_submissions.get(rel_id, set())
        rel_velocity = round(sum(submission_metrics[s]["velocity"] for s in linked_subs), 1)
        rel_raw_hype = sum(submission_metrics[s]["raw_hype"] for s in linked_subs)

        if linked_subs:
            latest_sub_id = max(linked_subs, key=lambda s: submission_metrics[s]["created_utc"])
            latest_sub_meta = submission_metrics[latest_sub_id]
            rel_score = latest_sub_meta["score"]
            rel_num_comments = latest_sub_meta["num_comments"]
            rel_posted_at = latest_sub_meta["created_utc"]
            rel_first_seen_at = min(submission_metrics[s]["created_utc"] for s in linked_subs)
        else:
            rel_score = 0
            rel_num_comments = 0
            rel_posted_at = r.created_at
            rel_first_seen_at = r.created_at

        release_dict[rel_id] = {
            "release_id": rel_id,
            "album_id": alb_id,
            "album_title": r.album_title,
            "combined_artist": r.combined_artist,
            "variant": r.variant,
            "retailer_name": r.retailer_name,
            "created_at": r.created_at,
            "velocity": rel_velocity,
            "raw_hype": rel_raw_hype,
            "score": rel_score,
            "num_comments": rel_num_comments,
            "posted_at": rel_posted_at,
            "first_seen_at": rel_first_seen_at,
            "monogram_key": rel_id,
        }

    # Aggregate album metrics across deduplicated union of submissions per album
    albums_dict: dict[str, dict[str, Any]] = {}
    for a in catalog_albums:
        alb_id = a.album_id
        child_rel_ids = album_release_ids.get(alb_id, [])

        union_subs: set[str] = set()
        for r_id in child_rel_ids:
            union_subs.update(release_submissions.get(r_id, set()))

        alb_velocity = round(sum(submission_metrics[s]["velocity"] for s in union_subs), 1)
        alb_raw_hype = sum(submission_metrics[s]["raw_hype"] for s in union_subs)

        albums_dict[alb_id] = {
            "album_id": alb_id,
            "album_title": a.album_title,
            "combined_artist": a.combined_artist,
            "release_count": a.release_count,
            "submission_count": len(union_subs),
            "velocity": alb_velocity,
            "raw_hype": alb_raw_hype,
            "monogram_key": alb_id,
            "created_at": a.created_at,
        }

    # Normalize albums Hype Index
    album_raw_hypes = [alb["raw_hype"] for alb in albums_dict.values()]
    max_alb_raw = max(album_raw_hypes) if album_raw_hypes else 0.0

    for alb in albums_dict.values():
        h_idx = calculate_hype_index(alb["raw_hype"], max_alb_raw, REFERENCE_FLOOR)
        alb["hype_index"] = h_idx
        alb["tier"] = get_hype_tier(h_idx)

    # Normalize releases Hype Index
    release_raw_hypes = [rel["raw_hype"] for rel in release_dict.values()]
    max_rel_raw = max(release_raw_hypes) if release_raw_hypes else 0.0

    for rel in release_dict.values():
        h_idx = calculate_hype_index(rel["raw_hype"], max_rel_raw, REFERENCE_FLOOR)
        rel["hype_index"] = h_idx
        rel["tier"] = get_hype_tier(h_idx)

    # 1. Top 5 Albums
    sorted_albums = sorted(
        albums_dict.values(),
        key=lambda a: (
            -a["hype_index"],
            -a["velocity"],
            -a["release_count"],
            a["album_title"],
        ),
    )
    top_albums = [
        AlbumLeaderboardItem(
            album_id=a["album_id"],
            album_title=a["album_title"],
            combined_artist=a["combined_artist"],
            hype_index=a["hype_index"],
            hype_velocity=a["velocity"],
            tier=a["tier"],
            release_count=a["release_count"],
            submission_count=a["submission_count"],
            monogram_key=a["monogram_key"],
        )
        for a in sorted_albums[:5]
    ]

    # 2. Top 5 Releases
    sorted_releases = sorted(
        release_dict.values(),
        key=lambda r: (
            -r["hype_index"],
            -r["velocity"],
            -r["created_at"].timestamp(),
            r["release_id"],
        ),
    )
    top_releases = [
        ReleaseLeaderboardItem(
            release_id=r["release_id"],
            album_id=r["album_id"],
            album_title=r["album_title"],
            combined_artist=r["combined_artist"],
            variant=r["variant"],
            retailer_name=r["retailer_name"],
            hype_index=r["hype_index"],
            hype_velocity=r["velocity"],
            tier=r["tier"],
            monogram_key=r["monogram_key"],
        )
        for r in sorted_releases[:5]
    ]

    # 3. Newly Added Releases (first seen within last 24h, up to 5, strictly evaluated in 24H window)
    cutoff_24h = now - timedelta(hours=24)
    newly_added_candidates = [r for r in release_dict.values() if r["first_seen_at"] >= cutoff_24h]
    sorted_newly_added = sorted(
        newly_added_candidates,
        key=lambda r: (-r["first_seen_at"].timestamp(), r["release_id"]),
    )
    newly_added = []
    for rel_item in sorted_newly_added[:5]:
        rel_id = str(rel_item["release_id"])
        rel_subs = release_submissions.get(rel_id, set())
        rel_raw_24h = sum(submission_metrics_24h[s]["raw_hype"] for s in rel_subs)
        rel_vel_24h = round(sum(submission_metrics_24h[s]["velocity"] for s in rel_subs), 1)
        h_idx_24h = calculate_hype_index(rel_raw_24h, max_rel_raw_24h, REFERENCE_FLOOR)
        newly_added.append(
            NewlyAddedReleaseItem(
                release_id=rel_id,
                album_id=rel_item["album_id"],
                album_title=rel_item["album_title"],
                combined_artist=rel_item["combined_artist"],
                variant=rel_item["variant"],
                retailer_name=rel_item["retailer_name"],
                hype_index=h_idx_24h,
                hype_velocity=rel_vel_24h,
                tier=get_hype_tier(h_idx_24h),
                monogram_key=rel_item["monogram_key"],
                first_seen_at=rel_item["first_seen_at"],
                latest_score=rel_item["score"],
            )
        )

    # 4. Live Release Feed (up to 50 recent releases ordered by recency)
    sorted_feed = sorted(
        release_dict.values(),
        key=lambda r: (-r["posted_at"].timestamp(), r["release_id"]),
    )
    live_feed = [
        LiveFeedItem(
            release_id=r["release_id"],
            album_id=r["album_id"],
            album_title=r["album_title"],
            combined_artist=r["combined_artist"],
            variant=r["variant"],
            retailer_name=r["retailer_name"],
            hype_index=r["hype_index"],
            hype_velocity=r["velocity"],
            tier=r["tier"],
            score=r["score"],
            num_comments=r["num_comments"],
            posted_at=r["posted_at"],
            monogram_key=r["monogram_key"],
        )
        for r in sorted_feed[:50]
    ]

    return DashboardResponse(
        window=window,
        top_albums=top_albums,
        top_releases=top_releases,
        newly_added=newly_added,
        live_feed=live_feed,
    )


__all__ = ["get_dashboard_data"]
