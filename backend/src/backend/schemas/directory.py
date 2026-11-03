"""Pydantic schemas for the Directory Explorer API endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic envelope for paginated directory queries."""

    page: int = Field(..., ge=1, description="Current 1-based page number")
    page_size: int = Field(..., ge=1, le=100, description="Number of items requested per page")
    total_pages: int = Field(..., ge=1, description="Total number of available pages")
    total_items: int = Field(..., ge=0, description="Total count of matching items")
    items: list[T] = Field(..., description="Paginated items for current page")


class ReleaseDirectoryItem(BaseModel):
    """Release row item for grid and table views in Directory Explorer."""

    release_id: str = Field(..., description="UUID of physical release")
    album_id: str = Field(..., description="UUID of parent canonical album")
    album_title: str = Field(..., description="Album title")
    combined_artist: str = Field(..., description="Artist or collaborative artist billing")
    variant: str | None = Field(default=None, description="Pressing variant description")
    retailer_name: str | None = Field(default=None, description="Retailer or webstore distributor")
    hype_index: int = Field(..., ge=0, le=100, description="Window-decayed Hype Index (0-100)")
    hype_velocity: float = Field(..., ge=0.0, description="Hype Velocity in points/hour")
    tier: Literal["high", "moderate", "low"] = Field(..., description="Hype demand tier")
    score: int = Field(..., ge=0, description="Cumulative score / upvotes across linked submissions")
    num_comments: int = Field(..., ge=0, description="Cumulative comments count across linked submissions")
    submission_count: int = Field(..., ge=0, description="Total deduplicated Reddit submissions linked")
    created_at: datetime = Field(..., description="Ingested timestamp")
    monogram_key: str = Field(..., description="Key for deterministic monogram styling")


class AlbumDirectoryItem(BaseModel):
    """Canonical album row item for Directory Explorer."""

    album_id: str = Field(..., description="Canonical Album UUID")
    album_title: str = Field(..., description="Canonical album title")
    combined_artist: str = Field(..., description="Canonical artist billing")
    release_count: int = Field(..., ge=0, description="Count of physical releases/pressings")
    preview_variants: list[str] = Field(
        default_factory=list,
        description="Inline preview list of child variant descriptors",
    )
    retailers: list[str] = Field(
        default_factory=list,
        description="Distinct non-null retailers distributing this album",
    )
    submission_count: int = Field(..., ge=0, description="Deduplicated union submission count")
    score: int = Field(..., ge=0, description="Total score points across deduplicated submissions")
    num_comments: int = Field(..., ge=0, description="Total comments across deduplicated submissions")
    hype_velocity: float = Field(..., ge=0.0, description="Hype Velocity in points/hour")
    hype_index: int = Field(..., ge=0, le=100, description="Window-decayed Hype Index (0-100)")
    tier: Literal["high", "moderate", "low"] = Field(..., description="Hype demand tier")
    attribution: Literal["solo", "combined"] = Field(
        default="solo",
        description="Solo vs Combined artist billing attribution",
    )
    monogram_key: str = Field(..., description="Key for deterministic monogram styling")
    created_at: datetime = Field(..., description="Earliest release creation timestamp")


class ArtistDirectoryItem(BaseModel):
    """Artist row item for Directory Explorer ledger."""

    artist_id: str = Field(..., description="UUID of artist")
    name: str = Field(..., description="Canonical artist name")
    solo_album_count: int = Field(..., ge=0, description="Count of derived albums where artist is billed solo")
    combined_album_count: int = Field(..., ge=0, description="Count of derived albums where artist is in a collaboration")
    album_count: int = Field(..., ge=0, description="Total catalog albums footprint")
    release_count: int = Field(..., ge=0, description="Total child pressings across discography")
    submission_count: int = Field(..., ge=0, description="Total deduplicated Reddit submissions linked")
    score: int = Field(..., ge=0, description="Total score points across deduplicated submissions")
    num_comments: int = Field(..., ge=0, description="Total comments across deduplicated submissions")
    hype_velocity: float = Field(..., ge=0.0, description="Hype Velocity in points/hour")
    hype_index: int = Field(..., ge=0, le=100, description="Window-decayed Hype Index (0-100)")
    tier: Literal["high", "moderate", "low"] = Field(..., description="Hype demand tier")
    monogram_key: str = Field(..., description="Key for deterministic monogram styling")
    created_at: datetime = Field(..., description="Artist catalog entry creation timestamp")


class PaginatedReleasesResponse(PaginatedResponse[ReleaseDirectoryItem]):
    """Paginated release directory payload."""


class PaginatedAlbumsResponse(PaginatedResponse[AlbumDirectoryItem]):
    """Paginated album directory payload."""


class PaginatedArtistsResponse(PaginatedResponse[ArtistDirectoryItem]):
    """Paginated artist directory payload."""


class DirectoryCountsResponse(BaseModel):
    """Catalog totals for live entity counters."""

    releases: int = Field(..., ge=0, description="Total releases in catalog")
    albums: int = Field(..., ge=0, description="Total derived albums in catalog")
    artists: int = Field(..., ge=0, description="Total artists in catalog")


__all__ = [
    "AlbumDirectoryItem",
    "ArtistDirectoryItem",
    "DirectoryCountsResponse",
    "PaginatedAlbumsResponse",
    "PaginatedArtistsResponse",
    "PaginatedReleasesResponse",
    "PaginatedResponse",
    "ReleaseDirectoryItem",
]
