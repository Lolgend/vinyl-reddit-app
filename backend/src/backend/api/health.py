from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from reddit_scrape.models import SubmissionSnapshot
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.db import get_db

router = APIRouter(prefix="/health", tags=["Health"])


class HealthResponse(BaseModel):
    status: str
    database: str
    latest_snapshot_at: datetime | None = None


@router.get("", response_model=HealthResponse)
def get_health(db: Annotated[Session, Depends(get_db)]) -> HealthResponse:
    """Return system health, database connection status, and latest snapshot timestamp."""
    try:
        stmt = select(func.max(SubmissionSnapshot.captured_at))
        latest_snapshot = db.execute(stmt).scalar()
        return HealthResponse(
            status="ok",
            database="connected",
            latest_snapshot_at=latest_snapshot,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "error",
                "database": "disconnected",
                "error": str(exc),
            },
        ) from exc
