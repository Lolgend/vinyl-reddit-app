"""FastAPI endpoints for Directory Explorer catalog views."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.db import get_db
from backend.schemas.directory import (
    DirectoryCountsResponse,
    PaginatedAlbumsResponse,
    PaginatedArtistsResponse,
    PaginatedReleasesResponse,
)
from backend.services.directory import (
    get_directory_albums,
    get_directory_artists,
    get_directory_counts,
    get_directory_releases,
    get_directory_retailers,
)
from backend.services.hype import WindowType

router = APIRouter()


@router.get("/releases", response_model=PaginatedReleasesResponse)
def list_directory_releases(
    session: Annotated[Session, Depends(get_db)],
    q: Annotated[str | None, Query(description="Search query string")] = None,
    window: Annotated[WindowType, Query(description="Time window for scoring")] = "24H",
    tier: Annotated[Literal["high", "moderate", "low"] | None, Query(description="Hype tier filter")] = None,
    retailer: Annotated[str | None, Query(description="Retailer filter (case-insensitive)")] = None,
    sort: Annotated[str, Query(description="Field to sort by")] = "hype_index",
    order: Annotated[Literal["asc", "desc"], Query(description="Sort direction")] = "desc",
    page: Annotated[int, Query(ge=1, description="Page number")] = 1,
    page_size: Annotated[int, Query(ge=1, le=100, description="Items per page")] = 20,
) -> PaginatedReleasesResponse:
    """Return paginated physical releases matching filters."""
    return get_directory_releases(
        session=session,
        window=window,
        q=q,
        tier=tier,
        retailer=retailer,
        sort=sort,
        order=order,
        page=page,
        page_size=page_size,
    )


@router.get("/albums", response_model=PaginatedAlbumsResponse)
def list_directory_albums(
    session: Annotated[Session, Depends(get_db)],
    q: Annotated[str | None, Query(description="Search query string")] = None,
    window: Annotated[WindowType, Query(description="Time window for scoring")] = "24H",
    tier: Annotated[Literal["high", "moderate", "low"] | None, Query(description="Hype tier filter")] = None,
    retailer: Annotated[str | None, Query(description="Retailer filter")] = None,
    sort: Annotated[str, Query(description="Field to sort by")] = "hype_index",
    order: Annotated[Literal["asc", "desc"], Query(description="Sort direction")] = "desc",
    page: Annotated[int, Query(ge=1, description="Page number")] = 1,
    page_size: Annotated[int, Query(ge=1, le=100, description="Items per page")] = 20,
) -> PaginatedAlbumsResponse:
    """Return paginated derived albums with child release metadata."""
    return get_directory_albums(
        session=session,
        window=window,
        q=q,
        tier=tier,
        retailer=retailer,
        sort=sort,
        order=order,
        page=page,
        page_size=page_size,
    )


@router.get("/artists", response_model=PaginatedArtistsResponse)
def list_directory_artists(
    session: Annotated[Session, Depends(get_db)],
    q: Annotated[str | None, Query(description="Search query string")] = None,
    window: Annotated[WindowType, Query(description="Time window for scoring")] = "24H",
    tier: Annotated[Literal["high", "moderate", "low"] | None, Query(description="Hype tier filter")] = None,
    sort: Annotated[str, Query(description="Field to sort by")] = "hype_index",
    order: Annotated[Literal["asc", "desc"], Query(description="Sort direction")] = "desc",
    page: Annotated[int, Query(ge=1, description="Page number")] = 1,
    page_size: Annotated[int, Query(ge=1, le=100, description="Items per page")] = 20,
) -> PaginatedArtistsResponse:
    """Return paginated artists with solo and combined catalog footprints."""
    return get_directory_artists(
        session=session,
        window=window,
        q=q,
        tier=tier,
        sort=sort,
        order=order,
        page=page,
        page_size=page_size,
    )


@router.get("/retailers", response_model=list[str])
def list_directory_retailers(
    session: Annotated[Session, Depends(get_db)],
) -> list[str]:
    """Return distinct non-null retailer names."""
    return get_directory_retailers(session)


@router.get("/counts", response_model=DirectoryCountsResponse)
def get_catalog_counts(
    session: Annotated[Session, Depends(get_db)],
) -> DirectoryCountsResponse:
    """Return total catalog entity counts across releases, albums, and artists."""
    return get_directory_counts(session)
