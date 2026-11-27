"""Read-only Pipeline Admin telemetry, liveness, and orchestration service."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import cast

import psycopg.errors
from reddit_scrape.models import PipelineLoopState, PipelineProcessStatus
from sqlalchemy import select
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from backend.schemas.admin import (
    AdminPipelineResponse,
    EffectiveProcessStatus,
    LoopName,
    LoopStatus,
    PipelineLoopInfo,
    PipelineProcessInfo,
    PipelineRunItem,
    RunOutcome,
)
from backend.services.admin_enrichment import get_enrichment_queue_status
from backend.services.admin_extraction import get_extraction_queue_status
from backend.services.admin_runs import get_pipeline_runs

DEFAULT_PROCESS_NAME = "default"
MIN_STALE_THRESHOLD_SECONDS = 90

CANONICAL_LOOP_ORDER: tuple[LoopName, ...] = (
    "discovery_poll",
    "tracking_poll",
    "extraction_worker",
    "enrichment_worker",
)
_LOOP_ORDER_INDEX: dict[str, int] = {name: idx for idx, name in enumerate(CANONICAL_LOOP_ORDER)}
_VALID_LOOP_NAMES: set[str] = set(CANONICAL_LOOP_ORDER)
_VALID_LOOP_STATUSES: set[str] = {"running", "sleeping", "error", "stopped", "disabled"}


def _ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _is_undefined_table_error(exc: ProgrammingError) -> bool:
    orig = getattr(exc, "orig", None)
    if isinstance(orig, psycopg.errors.UndefinedTable):
        return True
    return getattr(orig, "sqlstate", None) == "42P01"


def _unavailable_process() -> PipelineProcessInfo:
    return PipelineProcessInfo(
        effective_status="unavailable",
        stale_threshold_seconds=MIN_STALE_THRESHOLD_SECONDS,
    )


def _evaluate_process_status(
    row: PipelineProcessStatus,
    now_utc: datetime,
) -> PipelineProcessInfo:
    heartbeat_interval = row.heartbeat_interval_seconds or 30
    stale_threshold = max(MIN_STALE_THRESHOLD_SECONDS, 3 * heartbeat_interval)
    last_heartbeat_utc = _ensure_utc(row.last_heartbeat_at)
    started_at_utc = _ensure_utc(row.started_at)
    stopped_at_utc = _ensure_utc(row.stopped_at)

    effective: EffectiveProcessStatus
    if row.status == "stopped":
        effective = "stopped"
    elif (
        last_heartbeat_utc is not None
        and (now_utc - last_heartbeat_utc).total_seconds() > stale_threshold
    ):
        effective = "offline"
    else:
        effective = "online"

    return PipelineProcessInfo(
        effective_status=effective,
        raw_status=row.status,
        run_mode=row.run_mode,
        host=row.host,
        pid=row.pid,
        heartbeat_interval_seconds=heartbeat_interval,
        stale_threshold_seconds=stale_threshold,
        started_at=started_at_utc,
        last_heartbeat_at=last_heartbeat_utc,
        stopped_at=stopped_at_utc,
    )


def _serialize_loops(
    rows: list[PipelineLoopState],
    effective_process_status: EffectiveProcessStatus,
) -> list[PipelineLoopInfo]:
    items: list[PipelineLoopInfo] = []
    for row in rows:
        if row.loop_name not in _VALID_LOOP_NAMES:
            continue
        status_val: LoopStatus = (
            cast(LoopStatus, row.status) if row.status in _VALID_LOOP_STATUSES else "stopped"
        )
        hide_next_run = effective_process_status != "online" or status_val in (
            "stopped",
            "disabled",
        )
        next_run_at = None if hide_next_run else _ensure_utc(row.next_run_at)
        raw_stats = row.last_run_stats
        last_run_stats: dict[str, int] | None = (
            {str(k): int(v) for k, v in raw_stats.items()}
            if isinstance(raw_stats, dict)
            else None
        )
        items.append(
            PipelineLoopInfo(
                loop_name=cast(LoopName, row.loop_name),
                status=status_val,
                interval_seconds=row.interval_seconds,
                last_started_at=_ensure_utc(row.last_started_at),
                last_completed_at=_ensure_utc(row.last_completed_at),
                next_run_at=next_run_at,
                last_duration_ms=row.last_duration_ms,
                last_run_stats=last_run_stats,
                last_error=row.last_error,
            )
        )
    items.sort(key=lambda item: _LOOP_ORDER_INDEX.get(item.loop_name, 999))
    return items


def _read_telemetry(
    session: Session,
    now_utc: datetime,
) -> tuple[bool, PipelineProcessInfo, list[PipelineLoopInfo]]:
    try:
        process_stmt = select(PipelineProcessStatus).where(
            PipelineProcessStatus.process_name == DEFAULT_PROCESS_NAME
        )
        process_row = session.execute(process_stmt).scalar_one_or_none()
        if process_row is None:
            return False, _unavailable_process(), []

        process_info = _evaluate_process_status(process_row, now_utc)
        loop_rows = list(session.execute(select(PipelineLoopState)).scalars().all())
        loops = _serialize_loops(loop_rows, process_info.effective_status)
        return True, process_info, loops
    except ProgrammingError as exc:
        if _is_undefined_table_error(exc):
            session.rollback()
            return False, _unavailable_process(), []
        raise


def get_admin_pipeline_status(
    session: Session,
    *,
    now: datetime | None = None,
    run_stage: LoopName | None = None,
    run_outcome: RunOutcome | None = None,
    run_limit: int = 50,
) -> AdminPipelineResponse:
    """Assemble the read-only Pipeline Admin operational status payload."""
    now_utc = _ensure_utc(now) or datetime.now(timezone.utc)
    telemetry_available, process_info, loops = _read_telemetry(session, now_utc)

    # Pluggable slots for parallel tickets #43 (Extraction Queue),
    # #44 (Enrichment Queue), and #45 (Pipeline Run History).
    extraction_queue = get_extraction_queue_status(session)
    enrichment_queue = get_enrichment_queue_status(session, now_utc)
    runs: list[PipelineRunItem] = (
        get_pipeline_runs(
            session,
            stage=run_stage,
            outcome=run_outcome,
            limit=run_limit,
        )
        if telemetry_available
        else []
    )

    return AdminPipelineResponse(
        server_time=now_utc,
        telemetry_available=telemetry_available,
        process=process_info,
        loops=loops,
        extraction_queue=extraction_queue,
        enrichment_queue=enrichment_queue,
        runs=runs,
    )
