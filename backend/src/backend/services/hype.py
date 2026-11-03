"""Mathematical Scoring Engine for r/vinylreleases demand intelligence.

Calculates composite engagement points, baseline anchoring with launch velocity,
window-decayed raw hype signals, and cohort-normalized Hype Index (0-100).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from sqlalchemy.orm import Session

from backend.schemas.dashboard import DashboardResponse

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


def compute_submission_metrics(
    created_utc: datetime,
    latest_score: int,
    latest_num_comments: int,
    latest_upvote_ratio: float | None,
    snapshots: list[Any],
    window: str = DEFAULT_WINDOW,
    now: datetime | None = None,
    t0: datetime | None = None,
) -> dict[str, Any]:
    """Compute submission metrics including baseline anchoring, elapsed time floor, and velocity calculations.

    Elapsed time delta_t uses a 15-minute floor (0.25 hours) measuring to now
    so that dormant posts cool naturally.
    """
    if now is None:
        now = datetime.now(timezone.utc)

    if t0 is None:
        spec = WINDOW_CONFIG.get(window, WINDOW_CONFIG[DEFAULT_WINDOW])
        t0 = now - timedelta(hours=spec.duration_hours)

    def _get(sn: Any, key: str) -> Any:
        return sn[key] if isinstance(sn, dict) else getattr(sn, key)

    # Baseline Anchor (E_base, t_base)
    if created_utc >= t0:
        # Post created inside window: origin anchor guarantees launch velocity
        e_base = 0
        t_base = created_utc
    else:
        # Post created before window
        snaps_before_t0 = [sn for sn in snapshots if _get(sn, "captured_at") <= t0]
        if snaps_before_t0:
            anchor_snap = snaps_before_t0[-1]
            e_base = calculate_points(_get(anchor_snap, "score"), _get(anchor_snap, "num_comments"))
            t_base = _get(anchor_snap, "captured_at")
        else:
            snaps_in_window = [sn for sn in snapshots if _get(sn, "captured_at") > t0]
            if snaps_in_window:
                anchor_snap = snaps_in_window[0]
                e_base = calculate_points(_get(anchor_snap, "score"), _get(anchor_snap, "num_comments"))
                t_base = _get(anchor_snap, "captured_at")
            else:
                e_base = calculate_points(latest_score, latest_num_comments)
                t_base = created_utc

    # Current state (E_curr)
    if snapshots:
        latest_snap = snapshots[-1]
        e_curr = calculate_points(_get(latest_snap, "score"), _get(latest_snap, "num_comments"))
    else:
        e_curr = calculate_points(latest_score, latest_num_comments)

    delta_e = max(0, e_curr - e_base)
    v_s = calculate_velocity(delta_e, t_base, now)
    h_s = calculate_raw_hype(
        velocity=v_s,
        delta_e=delta_e,
        created_utc=created_utc,
        upvote_ratio=latest_upvote_ratio,
        window=window,
        now=now,
    )

    return {
        "velocity": v_s,
        "delta_e": delta_e,
        "raw_hype": h_s,
        "created_utc": created_utc,
        "score": latest_score,
        "num_comments": latest_num_comments,
    }


def get_dashboard_data(
    session: Session,
    window: WindowType = DEFAULT_WINDOW,
    now: datetime | None = None,
) -> DashboardResponse:
    """Compute and construct compound Dashboard response for the given window."""
    from backend.services.dashboard import get_dashboard_data as _get_dashboard_data

    return _get_dashboard_data(session=session, window=window, now=now)


__all__ = [
    "DEFAULT_WINDOW",
    "REFERENCE_FLOOR",
    "WINDOW_CONFIG",
    "WindowSpec",
    "WindowType",
    "calculate_hype_index",
    "calculate_points",
    "calculate_raw_hype",
    "calculate_velocity",
    "compute_submission_metrics",
    "get_dashboard_data",
    "get_hype_tier",
    "normalize_cohort_hype",
]
