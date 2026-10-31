"""Stepped LOCF Time-Series & Share-of-Demand Engine.

Generates uniform N+1 time boundaries, samples cumulative engagement points
using Last Observation Carried Forward (LOCF) semantics, calculates stepped
interval velocities, extracts submission event markers, and calculates
variant share-of-demand across child releases.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

WindowType = Literal["24H", "7D", "1M"]


@dataclass(frozen=True)
class TimeSeriesWindowSpec:
    duration_hours: int
    step_hours: float
    num_buckets: int


TIMESERIES_CONFIG: dict[str, TimeSeriesWindowSpec] = {
    "24H": TimeSeriesWindowSpec(duration_hours=24, step_hours=1.0, num_buckets=24),
    "7D": TimeSeriesWindowSpec(duration_hours=168, step_hours=6.0, num_buckets=28),
    "1M": TimeSeriesWindowSpec(duration_hours=720, step_hours=24.0, num_buckets=30),
}


def generate_window_boundaries(
    window: str,
    now: datetime | None = None,
) -> list[datetime]:
    """Generate uniform N+1 boundary timestamps ending at now.

    - 24H: 24 intervals * 1 hour (25 boundaries)
    - 7D: 28 intervals * 6 hours (29 boundaries)
    - 1M: 30 intervals * 24 hours (31 boundaries)
    """
    if now is None:
        now = datetime.now(timezone.utc)

    spec = TIMESERIES_CONFIG.get(window, TIMESERIES_CONFIG["24H"])
    t0 = now - timedelta(hours=spec.duration_hours)

    boundaries: list[datetime] = []
    for i in range(spec.num_buckets + 1):
        b = t0 + timedelta(hours=i * spec.step_hours)
        boundaries.append(b)

    # Ensure the final boundary matches now exactly
    boundaries[-1] = now
    return boundaries


def compute_locf_time_series(
    submissions: list[dict[str, Any]],
    snapshots_by_sub: dict[str, list[dict[str, Any]]],
    window: str = "24H",
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    """Sample cumulative engagement points at uniform boundaries using LOCF.

    For each linked submission s and boundary b_i:
    - If b_i < s.created_utc: E_s(b_i) = 0
    - If b_i >= s.created_utc:
        Find latest snapshot with captured_at <= b_i:
        E_s(b_i) = score + 2 * num_comments
        If snapshots were purged or no snapshots exist <= b_i:
          If snapshots exist later than b_i: E_s(b_i) = 0 (not yet observed)
          Else: carry forward s.latest_score + 2 * s.latest_num_comments

    For each interval i in [1, N]:
    - E(b_i) = sum(E_s(b_i) across deduplicated submissions)
    - v_bucket(i) = round(max(0, E(b_i) - E(b_{i-1})) / step_hours, 1)
    """
    if now is None:
        now = datetime.now(timezone.utc)

    spec = TIMESERIES_CONFIG.get(window, TIMESERIES_CONFIG["24H"])
    boundaries = generate_window_boundaries(window, now)

    # Compute E(b_i) at each boundary for i = 0 .. N
    boundary_points: list[int] = []

    for b in boundaries:
        total_pts_at_b = 0
        for s in submissions:
            s_created = s["created_utc"]
            if b < s_created:
                pts = 0
            else:
                s_id = str(s["id"])
                snaps = snapshots_by_sub.get(s_id, [])
                snaps_before_b = [sn for sn in snaps if sn["captured_at"] <= b]
                if snaps_before_b:
                    latest_snap = snaps_before_b[-1]
                    pts = latest_snap["score"] + 2 * latest_snap["num_comments"]
                elif snaps:
                    # Snaps exist, but all are captured after b
                    pts = 0
                else:
                    # No snapshots in DB (e.g. purged retention), carry forward latest metrics
                    pts = s.get("latest_score", 0) + 2 * s.get("latest_num_comments", 0)

            total_pts_at_b += max(0, pts)
        boundary_points.append(total_pts_at_b)

    # Construct bucket intervals
    buckets: list[dict[str, Any]] = []
    step_hours = spec.step_hours

    for i in range(1, len(boundaries)):
        b_start = boundaries[i - 1]
        b_end = boundaries[i]
        cum_pts = boundary_points[i]
        prev_pts = boundary_points[i - 1]

        delta_pts = max(0, cum_pts - prev_pts)
        velocity = round(delta_pts / step_hours, 1)

        bucket_data = {
            "bucket_start": b_start,
            "bucket_end": b_end,
            "cumulative_points": cum_pts,
            "velocity_pts_per_hr": velocity,
            # Convenient aliases for frontend access
            "timestamp": b_end,
            "points": cum_pts,
            "velocity": velocity,
        }
        buckets.append(bucket_data)

    return buckets


def calculate_share_of_demand(
    releases: list[dict[str, Any]],
    submissions_by_release: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    """Calculate relative commercial share-of-demand for each child release.

    share(r) = round(100.0 * E_r / sum(E_j), 1)
    Fallback: round(100.0 / K, 1) when total points == 0.
    Ensures total percentage sums to exactly 100.0% by adjusting residual on max share item.
    """
    k = len(releases)
    if k == 0:
        return []

    # Calculate engagement points per release
    release_points: dict[str, int] = {}
    for r in releases:
        rel_id = str(r["release_id"])
        subs = submissions_by_release.get(rel_id, [])
        e_r = 0
        for s in subs:
            score = s.get("latest_score", 0)
            num_comments = s.get("latest_num_comments", 0)
            e_r += max(0, score + 2 * num_comments)
        release_points[rel_id] = e_r

    total_e = sum(release_points.values())

    raw_shares: list[float] = []
    for r in releases:
        rel_id = str(r["release_id"])
        pts = release_points[rel_id]
        if total_e > 0:
            share = round(100.0 * pts / total_e, 1)
        else:
            share = round(100.0 / k, 1)
        raw_shares.append(share)

    # Distribute residual so sum is exactly 100.0%
    current_sum = round(sum(raw_shares), 1)
    residual = round(100.0 - current_sum, 1)
    if residual != 0.0 and len(raw_shares) > 0:
        # Adjust the item with highest points (or first item if tied)
        max_idx = max(range(len(raw_shares)), key=lambda i: release_points[str(releases[i]["release_id"])])
        raw_shares[max_idx] = round(raw_shares[max_idx] + residual, 1)

    result: list[dict[str, Any]] = []
    for idx, r in enumerate(releases):
        rel_id = str(r["release_id"])
        result.append(
            {
                "release_id": rel_id,
                "variant": r.get("variant"),
                "retailer_name": r.get("retailer_name"),
                "share_percentage": raw_shares[idx],
                "points": release_points[rel_id],
            }
        )

    # Sort descending by share_percentage then points
    result.sort(key=lambda item: (item["share_percentage"], item["points"]), reverse=True)
    return result


def get_submission_markers(
    submissions: list[dict[str, Any]],
    t0: datetime,
    now: datetime,
) -> list[dict[str, Any]]:
    """Extract event markers for submissions created within the active window."""
    markers: list[dict[str, Any]] = []
    for s in submissions:
        created = s["created_utc"]
        if t0 <= created <= now:
            markers.append(
                {
                    "timestamp": created,
                    "submission_id": str(s["id"]),
                    "title": s.get("title", ""),
                }
            )

    markers.sort(key=lambda m: m["timestamp"])
    return markers


__all__ = [
    "TIMESERIES_CONFIG",
    "TimeSeriesWindowSpec",
    "calculate_share_of_demand",
    "compute_locf_time_series",
    "generate_window_boundaries",
    "get_submission_markers",
]
