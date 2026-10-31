"""Mathematical Scoring Engine for r/vinylreleases demand intelligence.

Calculates composite engagement points, baseline anchoring with launch velocity,
window-decayed raw hype signals, and cohort-normalized Hype Index (0-100).
"""

from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.schemas.dashboard import (
    AlbumLeaderboardItem,
    DashboardResponse,
    LiveFeedItem,
    NewlyAddedReleaseItem,
    ReleaseLeaderboardItem,
)
from backend.services.catalog import derive_album_id

WindowType = Literal["24H", "7D", "1M"]


@dataclass(frozen=True)
class WindowSpec:
    duration_hours: int
    tau_hours: float


WINDOW_CONFIG: dict[str, WindowSpec] = {
    "24H": WindowSpec(duration_hours=24, tau_hours=12.0),
    "7D": WindowSpec(duration_hours=168, tau_hours=72.0),
    "1M": WindowSpec(duration_hours=720, tau_hours=336.0),
}

DEFAULT_WINDOW: WindowType = "24H"
REFERENCE_FLOOR: float = 25.0


def calculate_points(score: int, num_comments: int) -> int:
    """Calculate composite engagement points E = score + 2 * num_comments."""
    return score + 2 * num_comments


def calculate_velocity(
    delta_e: int,
    t_base: datetime,
    now: datetime,
) -> float:
    """Calculate hype velocity (points per hour).

    Elapsed time delta_t uses a 15-minute floor (0.25 hours) measuring to now
    so that dormant posts cool naturally.
    v_s = round(delta_e / delta_t, 1).
    """
    if delta_e <= 0:
        return 0.0

    elapsed_seconds = (now - t_base).total_seconds()
    elapsed_hours = max(0.25, elapsed_seconds / 3600.0)
    return round(delta_e / elapsed_hours, 1)


def calculate_raw_hype(
    velocity: float,
    delta_e: int,
    created_utc: datetime,
    upvote_ratio: float | None,
    window: str,
    now: datetime,
) -> float:
    """Compute raw hype signal h_s for a single submission.

    h_s = (v_s + delta_e / tau_W) * (0.5 + 0.5 * r_s) * 2^(-a_s / tau_W)
    where a_s is age in hours and r_s is upvote ratio.
    """
    if velocity <= 0.0 and delta_e <= 0:
        return 0.0

    spec = WINDOW_CONFIG.get(window, WINDOW_CONFIG[DEFAULT_WINDOW])
    tau = spec.tau_hours

    # Age in hours (non-negative)
    age_seconds = max(0.0, (now - created_utc).total_seconds())
    age_hours = age_seconds / 3600.0

    # Half-life decay factor: 2^(-a_s / tau)
    decay = 2.0 ** (-age_hours / tau)

    # Upvote ratio damping: 0.5 + 0.5 * r_s (default r_s = 1.0 if None or invalid)
    r = 1.0 if upvote_ratio is None else max(0.0, min(1.0, float(upvote_ratio)))
    ratio_factor = 0.5 + 0.5 * r

    # Raw signal
    base_signal = velocity + (delta_e / tau)
    return float(base_signal * ratio_factor * decay)


def calculate_hype_index(
    raw_hype: float,
    cohort_max_raw_hype: float,
    reference_floor: float = REFERENCE_FLOOR,
) -> int:
    """Log-compress and normalize raw hype to 0-100 scale against cohort max.

    Scale uses max(ln(1.0 + cohort_max_raw_hype), ln(1.0 + reference_floor))
    to ensure low-activity periods do not artificially scale cooling titles to 100.
    """
    if raw_hype <= 0.0:
        return 0

    scale = max(math.log(1.0 + cohort_max_raw_hype), math.log(1.0 + reference_floor))
    if scale <= 0.0:
        return 0

    norm = 100.0 * math.log(1.0 + raw_hype) / scale
    return min(100, max(0, round(norm)))


def normalize_cohort_hype(
    raw_hypes: list[float],
    reference_floor: float = REFERENCE_FLOOR,
) -> list[int]:
    """Normalize a cohort list of raw hypes to 0-100 integer indices."""
    if not raw_hypes:
        return []
    cohort_max = max(raw_hypes)
    return [
        calculate_hype_index(h, cohort_max, reference_floor)
        for h in raw_hypes
    ]


def get_hype_tier(hype_index: int) -> Literal["high", "moderate", "low"]:
    """Classify 0-100 Hype Index into qualitative tiers.

    - High: 75-100 (#68D391)
    - Moderate: 40-74 (#ECC94B)
    - Low: 0-39 (#646464)
    """
    if hype_index >= 75:
        return "high"
    elif hype_index >= 40:
        return "moderate"
    else:
        return "low"


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

    spec = WINDOW_CONFIG[window]
    t0 = now - timedelta(hours=spec.duration_hours)

    # 1. Fetch releases ordered by created_at ASC, id ASC for deterministic album display casing
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

    # 2. Fetch linked submissions where is_release = TRUE
    sub_sql = text(
        """
        SELECT
            sr.release_id,
            s.id AS submission_id,
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

    # Group snapshots by submission_id
    snapshots_by_sub: dict[str, list[Any]] = defaultdict(list)
    for sn in snap_rows:
        snapshots_by_sub[sn.submission_id].append(sn)

    # Compute submission metrics
    submission_metrics: dict[str, dict[str, Any]] = {}
    release_submissions: dict[str, set[str]] = defaultdict(set)

    for row in sub_rows:
        s_id = row.submission_id
        r_id = str(row.release_id)
        release_submissions[r_id].add(s_id)

        if s_id in submission_metrics:
            continue

        s_created_utc = row.created_utc
        snaps = snapshots_by_sub.get(s_id, [])

        # Baseline Anchor (E_base, t_base)
        if s_created_utc >= t0:
            # Post created inside window: origin anchor guarantees launch velocity
            e_base = 0
            t_base = s_created_utc
        else:
            # Post created before window
            snaps_before_t0 = [sn for sn in snaps if sn.captured_at <= t0]
            if snaps_before_t0:
                anchor_snap = snaps_before_t0[-1]
                e_base = calculate_points(anchor_snap.score, anchor_snap.num_comments)
                t_base = anchor_snap.captured_at
            else:
                snaps_in_window = [sn for sn in snaps if sn.captured_at > t0]
                if snaps_in_window:
                    anchor_snap = snaps_in_window[0]
                    e_base = calculate_points(anchor_snap.score, anchor_snap.num_comments)
                    t_base = anchor_snap.captured_at
                else:
                    e_base = calculate_points(row.latest_score, row.latest_num_comments)
                    t_base = s_created_utc

        # Current state (E_curr)
        if snaps:
            latest_snap = snaps[-1]
            e_curr = calculate_points(latest_snap.score, latest_snap.num_comments)
        else:
            e_curr = calculate_points(row.latest_score, row.latest_num_comments)

        delta_e = max(0, e_curr - e_base)
        v_s = calculate_velocity(delta_e, t_base, now)
        h_s = calculate_raw_hype(
            velocity=v_s,
            delta_e=delta_e,
            created_utc=s_created_utc,
            upvote_ratio=row.latest_upvote_ratio,
            window=window,
            now=now,
        )

        submission_metrics[s_id] = {
            "velocity": v_s,
            "delta_e": delta_e,
            "raw_hype": h_s,
            "created_utc": s_created_utc,
            "score": row.latest_score,
            "num_comments": row.latest_num_comments,
        }

    # Group releases into derived albums
    albums_dict: dict[str, dict[str, Any]] = {}
    release_dict: dict[str, dict[str, Any]] = {}

    for r in releases_rows:
        rel_id = str(r.id)
        alb_id = derive_album_id(r.norm_artist, r.norm_album)

        if alb_id not in albums_dict:
            albums_dict[alb_id] = {
                "album_id": alb_id,
                "album_title": r.album_title,
                "combined_artist": r.combined_artist,
                "release_count": 1,
                "earliest_created_at": r.created_at,
                "release_ids": [rel_id],
            }
        else:
            albums_dict[alb_id]["release_count"] += 1
            albums_dict[alb_id]["release_ids"].append(rel_id)

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

    # Album metrics calculation across deduplicated union of submissions
    for alb in albums_dict.values():
        union_subs: set[str] = set()
        for r_id in alb["release_ids"]:
            union_subs.update(release_submissions.get(r_id, set()))

        alb_velocity = round(sum(submission_metrics[s]["velocity"] for s in union_subs), 1)
        alb_raw_hype = sum(submission_metrics[s]["raw_hype"] for s in union_subs)

        alb["velocity"] = alb_velocity
        alb["raw_hype"] = alb_raw_hype
        alb["monogram_key"] = alb["album_id"]

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

    # 3. Newly Added Releases (first seen within last 24h, up to 5)
    cutoff_24h = now - timedelta(hours=24)
    newly_added_candidates = [
        r for r in release_dict.values() if r["first_seen_at"] >= cutoff_24h
    ]
    sorted_newly_added = sorted(
        newly_added_candidates,
        key=lambda r: (-r["first_seen_at"].timestamp(), r["release_id"]),
    )
    newly_added = [
        NewlyAddedReleaseItem(
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
            first_seen_at=r["first_seen_at"],
        )
        for r in sorted_newly_added[:5]
    ]

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
