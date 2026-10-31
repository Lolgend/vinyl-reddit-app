"""Artist Detail API Router.

Provides compound endpoint GET /api/v1/artists/{artist_id}.
"""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.db import get_db
from backend.schemas.artist import ArtistDetailResponse
from backend.services.artist_detail import get_artist_detail

router = APIRouter()


@router.get(
    "/{artist_id}",
    response_model=ArtistDetailResponse,
    summary="Get compound Artist Detail intelligence",
    description=(
        "Returns artist identity, 4-cell hero KPIs, catalog footprint with solo and combined counts, "
        "tracked albums matrix with billing attribution, and child releases discography ledger."
    ),
)
def get_artist(
    artist_id: str,
    session: Annotated[Session, Depends(get_db)],
    window: Literal["24H", "7D", "1M"] = Query(
        "24H",
        description="Hype calculation window (24H, 7D, 1M)",
    ),
) -> ArtistDetailResponse:
    detail = get_artist_detail(session=session, artist_id=artist_id, window=window)
    if detail is None:
        raise HTTPException(status_code=404, detail="Artist not found")
    return detail


__all__ = ["router"]
