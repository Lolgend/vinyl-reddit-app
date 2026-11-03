"""Album Detail API Router.

Provides compound endpoint GET /api/v1/albums/{album_id}.
"""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.db import get_db
from backend.schemas.album import AlbumDetailResponse
from backend.services.album_detail import get_album_detail

router = APIRouter()


@router.get(
    "/{album_id}",
    response_model=AlbumDetailResponse,
    summary="Get compound Album Detail intelligence",
    description=(
        "Returns derived album identity, 4-cell hero KPIs, stepped LOCF time-series "
        "buckets, submission event markers, variant share-of-demand breakdown, and "
        "7-column child releases comparison matrix."
    ),
)
def get_album(
    album_id: str,
    session: Annotated[Session, Depends(get_db)],
    window: Literal["24H", "7D", "1M"] = Query(
        "24H",
        description="Hype calculation window (24H, 7D, 1M)",
    ),
) -> AlbumDetailResponse:
    detail = get_album_detail(session=session, album_id=album_id, window=window)
    if detail is None:
        raise HTTPException(status_code=404, detail="Album not found")
    return detail


__all__ = ["router"]
