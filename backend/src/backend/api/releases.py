"""Release Detail API Router.

Provides compound endpoint GET /api/v1/releases/{release_id}.
"""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.db import get_db
from backend.schemas.release import ReleaseDetailResponse
from backend.services.release_detail import get_release_detail

router = APIRouter()


@router.get(
    "/{release_id}",
    response_model=ReleaseDetailResponse,
    summary="Get compound Release Detail intelligence",
    description=(
        "Returns release physical specifications, parent album links, 4-cell hero KPIs, "
        "stepped LOCF time-series buckets, and 6-column Reddit submission provenance ledger."
    ),
)
def get_release(
    release_id: str,
    session: Annotated[Session, Depends(get_db)],
    window: Literal["24H", "7D", "1M"] = Query(
        "24H",
        description="Hype calculation window (24H, 7D, 1M)",
    ),
) -> ReleaseDetailResponse:
    detail = get_release_detail(session=session, release_id=release_id, window=window)
    if detail is None:
        raise HTTPException(status_code=404, detail="Release not found")
    return detail


__all__ = ["router"]
