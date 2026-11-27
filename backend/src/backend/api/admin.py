"""Read-only Pipeline Admin REST router."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.db import get_db
from backend.schemas.admin import AdminPipelineResponse, LoopName, RunOutcome
from backend.services.admin_pipeline import get_admin_pipeline_status

router = APIRouter()


def get_utc_now() -> datetime:
    """Clock dependency returning current UTC timestamp (overridable in tests)."""
    return datetime.now(timezone.utc)


@router.get("/pipeline", response_model=AdminPipelineResponse)
def get_pipeline_admin(
    db: Annotated[Session, Depends(get_db)],
    now: Annotated[datetime, Depends(get_utc_now)],
    run_stage: Annotated[LoopName | None, Query()] = None,
    run_outcome: Annotated[RunOutcome | None, Query()] = None,
    run_limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> AdminPipelineResponse:
    """Return read-only Pipeline liveness, loop schedules, queue states, and recent runs."""
    return get_admin_pipeline_status(
        db,
        now=now,
        run_stage=run_stage,
        run_outcome=run_outcome,
        run_limit=run_limit,
    )
