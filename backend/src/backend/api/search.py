"""FastAPI router for global search."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.db import get_db
from backend.schemas.search import QuickSearchResponse
from backend.services.search import search_catalog

router = APIRouter()


@router.get("", response_model=QuickSearchResponse, summary="Multi-entity quick search")
def search_entities(
    db: Annotated[Session, Depends(get_db)],
    q: str = Query("", description="Search substring query (min 2 characters)"),
    limit: int = Query(5, ge=1, le=50, description="Max results per entity group"),
) -> QuickSearchResponse:
    """Execute case-insensitive substring search across albums, releases, and artists."""
    return search_catalog(session=db, query=q, limit=limit)
