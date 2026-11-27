"""Read-only Pipeline Run history query service."""

from __future__ import annotations

from typing import cast

from reddit_scrape.models import PipelineRun
from sqlalchemy import select
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from backend.schemas.admin import LoopName, PipelineRunItem, RunOutcome
from backend.services.admin_common import (
    VALID_LOOP_NAMES,
    ensure_utc,
    is_undefined_table_error,
    normalize_stats,
)

_VALID_OUTCOMES: set[str] = {"success", "error"}


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
        if is_undefined_table_error(exc):
            session.rollback()
            return []
        raise
    items: list[PipelineRunItem] = []
    for row in rows:
        if row.loop_name not in VALID_LOOP_NAMES or row.status not in _VALID_OUTCOMES:
            continue
        items.append(
            PipelineRunItem(
                id=row.id,
                stage=cast(LoopName, row.loop_name),
                outcome=cast(RunOutcome, row.status),
                started_at=ensure_utc(row.started_at),
                completed_at=ensure_utc(row.completed_at),
                duration_ms=row.duration_ms,
                stats=normalize_stats(row.stats),
                error_message=row.error_message,
                host=row.host,
                pid=row.pid,
            )
        )
    return items
