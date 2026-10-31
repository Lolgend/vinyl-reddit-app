"""FastAPI router for Demand Dashboard and leaderboards."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.db import get_db
from backend.schemas.dashboard import DashboardResponse
from backend.services.hype import get_dashboard_data

router = APIRouter()


@router.get("", response_model=DashboardResponse, summary="Demand Dashboard leaderboards and live feed")
def get_dashboard(
    db: Annotated[Session, Depends(get_db)],
    window: Literal["24H", "7D", "1M"] = Query(
        "24H",
        description="Analysis window (24H, 7D, or 1M)",
    ),
) -> DashboardResponse:
    """Retrieve top albums, top releases, newly added, and live feed for the requested window."""
    return get_dashboard_data(session=db, window=window)
