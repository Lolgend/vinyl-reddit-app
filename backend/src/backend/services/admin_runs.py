"""Read-only Pipeline Run history query service."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import cast

import psycopg.errors
from reddit_scrape.models import PipelineRun
from sqlalchemy import select
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from backend.schemas.admin import LoopName, PipelineRunItem, RunOutcome

_VALID_STAGES: set[str] = {
    "discovery_poll",
    "tracking_poll",
    "extraction_worker",
    "enrichment_worker",
}
_VALID_OUTCOMES: set[str] = {"success", "error"}


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _normalize_stats(raw_stats: object) -> dict[str, int] | None:
    if not isinstance(raw_stats, dict):
        return None
    return {str(k): int(v) for k, v in raw_stats.items()}


def _is_undefined_table_error(exc: ProgrammingError) -> bool:
    orig = getattr(exc, "orig", None)
    if isinstance(orig, psycopg.errors.UndefinedTable):
        return True
    return getattr(orig, "sqlstate", None) == "42P01"


def get_pipeline_runs(
    session: Session,
    *,
    stage: LoopName | None = None,
    outcome: RunOutcome | None = None,
    limit: int = 50,
) -> list[PipelineRunItem]:
    """Query recent Pipeline Run records ordered newest-first."""
    stmt = select(PipelineRun)
    if stage is not None:
        stmt = stmt.where(PipelineRun.loop_name == stage)
    if outcome is not None:
        stmt = stmt.where(PipelineRun.status == outcome)
    stmt = stmt.order_by(PipelineRun.started_at.desc(), PipelineRun.id.desc()).limit(limit)

    try:
        rows = list(session.execute(stmt).scalars().all())
    except ProgrammingError as exc:
        if _is_undefined_table_error(exc):
            session.rollback()
            return []
        raise
    items: list[PipelineRunItem] = []
    for row in rows:
        if row.loop_name not in _VALID_STAGES or row.status not in _VALID_OUTCOMES:
            continue
        items.append(
            PipelineRunItem(
                id=row.id,
                stage=cast(LoopName, row.loop_name),
                outcome=cast(RunOutcome, row.status),
                started_at=_ensure_utc(row.started_at),
                completed_at=_ensure_utc(row.completed_at),
                duration_ms=row.duration_ms,
                stats=_normalize_stats(row.stats),
                error_message=row.error_message,
                host=row.host,
                pid=row.pid,
            )
        )
    return items
