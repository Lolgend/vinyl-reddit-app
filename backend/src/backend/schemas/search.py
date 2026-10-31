"""Pydantic schemas for multi-entity search."""

from typing import Any

from pydantic import BaseModel, Field


class SearchResultItem(BaseModel):
    """Normalized search result item across albums, releases, and artists."""

    id: str = Field(..., description="Unique entity identifier (album_id or UUID)")
    title: str = Field(..., description="Primary display title or artist name")
    subtitle: str = Field(..., description="Contextual subtitle, artist billing, or variant summary")
    monogram_key: str = Field(..., description="Key used for deterministic monogram styling")
    extra: dict[str, Any] | None = Field(default=None, description="Optional entity metadata")


class QuickSearchResponse(BaseModel):
    """Grouped multi-entity typeahead search response."""

    query: str = Field(..., description="Original search query string")
    albums: list[SearchResultItem] = Field(default_factory=list, description="Matched canonical albums")
    releases: list[SearchResultItem] = Field(default_factory=list, description="Matched physical releases")
    artists: list[SearchResultItem] = Field(default_factory=list, description="Matched catalog artists")
