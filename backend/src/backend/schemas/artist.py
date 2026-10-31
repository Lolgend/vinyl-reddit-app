"""Artist Detail and Discography Ledgers Schemas.

Defines Pydantic v2 contracts for Artist Detail REST API endpoints.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class ArtistIdentity(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    artist_id: str
    name: str
    monogram_key: str
    last_seen_at: datetime | None


class CatalogFootprint(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_albums: int
    solo_album_count: int
    combined_album_count: int
    total_releases: int


class ArtistRedditDemand(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_submissions: int
    submission_count: int
    total_score: int
    total_comments: int
    points_gain: int
    last_seen: datetime | None
    last_seen_at: datetime | None


class ArtistHeroKPI(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    hype_index: int
    tier: Literal["high", "moderate", "low"]
    hype_velocity: float
    catalog_footprint: CatalogFootprint
    reddit_demand: ArtistRedditDemand
    # Direct access convenience fields
    total_albums: int
    solo_album_count: int
    combined_album_count: int
    total_releases: int
    submission_count: int
    total_score: int
    total_comments: int
    points_gain: int
    last_seen_at: datetime | None


class TrackedAlbumRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    album_id: str
    album_title: str
    combined_artist: str
    billing_attribution: str
    release_count: int
    submission_count: int
    score: int
    num_comments: int
    hype_velocity: float
    hype_index: int
    tier: Literal["high", "moderate", "low"]
    first_seen_at: datetime | None
    last_seen_at: datetime | None


class ChildReleaseLedgerRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    release_id: str
    album_id: str
    album_title: str
    combined_artist: str
    variant: str | None
    retailer_name: str | None
    submission_count: int
    score: int
    num_comments: int
    hype_velocity: float
    hype_index: int
    tier: Literal["high", "moderate", "low"]
    first_seen_at: datetime | None
    last_seen_at: datetime | None


class ArtistDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    artist_id: str
    name: str
    monogram_key: str
    last_seen_at: datetime | None
    window: Literal["24H", "7D", "1M"]
    artist: ArtistIdentity
    hero_kpi: ArtistHeroKPI
    tracked_albums: list[TrackedAlbumRow]
    child_releases: list[ChildReleaseLedgerRow]


__all__ = [
    "ArtistDetailResponse",
    "ArtistHeroKPI",
    "ArtistIdentity",
    "ArtistRedditDemand",
    "CatalogFootprint",
    "ChildReleaseLedgerRow",
    "TrackedAlbumRow",
]
