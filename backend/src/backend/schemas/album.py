"""Album Detail and Pressing Share-of-Demand Schemas.

Defines Pydantic v2 contracts for Album Detail REST API endpoints.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class TimeSeriesBucket(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    bucket_start: datetime
    bucket_end: datetime
    cumulative_points: int
    velocity_pts_per_hr: float
    timestamp: datetime
    points: int
    velocity: float


class SubmissionMarker(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    timestamp: datetime
    submission_id: str
    title: str


class ShareOfDemandItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    release_id: str
    variant: str | None
    retailer_name: str | None
    share_percentage: float
    points: int


class ChildReleaseRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    release_id: str
    variant: str | None
    retailer_name: str | None
    share_percentage: float
    hype_velocity: float
    hype_index: int
    tier: Literal["high", "moderate", "low"]
    submission_count: int
    total_score: int
    total_comments: int
    first_seen_at: datetime | None
    last_seen_at: datetime | None


class ArtistRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    artist_id: str
    name: str


class AlbumIdentity(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    album_id: str
    album_title: str
    combined_artist: str
    monogram_key: str
    first_seen_at: datetime | None
    last_seen_at: datetime | None
    artists: list[ArtistRef] = []


class RedditDemand(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    points_gain: int
    total_score: int
    total_comments: int
    submission_count: int


class PressingsProvenance(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    release_count: int
    submission_count: int
    first_seen_at: datetime | None
    last_seen_at: datetime | None


class AlbumHeroKPI(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    hype_index: int
    tier: Literal["high", "moderate", "low"]
    hype_velocity: float
    reddit_demand: RedditDemand
    pressings_provenance: PressingsProvenance
    # Direct access convenience fields
    points_gain: int
    total_score: int
    total_comments: int
    submission_count: int
    release_count: int
    first_seen_at: datetime | None
    last_seen_at: datetime | None


class AlbumDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    album_id: str
    album_title: str
    combined_artist: str
    monogram_key: str
    first_seen_at: datetime | None
    last_seen_at: datetime | None
    window: Literal["24H", "7D", "1M"]
    album: AlbumIdentity
    hero_kpi: AlbumHeroKPI
    time_series: list[TimeSeriesBucket]
    submission_markers: list[SubmissionMarker]
    share_of_demand: list[ShareOfDemandItem]
    child_releases: list[ChildReleaseRow]


__all__ = [
    "AlbumDetailResponse",
    "AlbumHeroKPI",
    "AlbumIdentity",
    "ArtistRef",
    "ChildReleaseRow",
    "PressingsProvenance",
    "RedditDemand",
    "ShareOfDemandItem",
    "SubmissionMarker",
    "TimeSeriesBucket",
]
