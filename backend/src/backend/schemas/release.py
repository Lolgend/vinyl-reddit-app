"""Release Detail and Submission Provenance Schemas.

Defines Pydantic v2 contracts for Release Detail REST API endpoints.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from backend.schemas.album import SubmissionMarker, TimeSeriesBucket


class ReleasePhysicalSpecs(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    release_id: str
    album_id: str
    album_title: str
    combined_artist: str
    variant: str
    retailer_name: str
    first_seen_at: datetime | None
    last_seen_at: datetime | None
    monogram_key: str


class ParentAlbumInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    album_id: str
    album_title: str
    release_count: int


class SubmissionEngagement(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    points_gain: int
    total_score: int
    total_comments: int
    submission_count: int


class ProvenanceSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    first_seen_at: datetime | None
    last_seen_at: datetime | None
    linked_submissions_count: int


class ReleaseHeroKPI(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    hype_index: int
    tier: Literal["high", "moderate", "low"]
    hype_velocity: float
    submission_engagement: SubmissionEngagement
    provenance_summary: ProvenanceSummary
    # Direct access convenience fields
    points_gain: int
    total_score: int
    total_comments: int
    submission_count: int
    first_seen_at: datetime | None
    last_seen_at: datetime | None


class RedditSubmissionProvenance(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    submission_id: str
    title: str
    created_utc: datetime
    latest_score: int
    latest_upvote_ratio: float
    latest_num_comments: int
    window_velocity: float
    url: str
    external_url: str | None = None


class ReleaseDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    release_id: str
    album_id: str
    album_title: str
    combined_artist: str
    variant: str
    retailer_name: str
    first_seen_at: datetime | None
    last_seen_at: datetime | None
    monogram_key: str
    window: Literal["24H", "7D", "1M"]
    specs: ReleasePhysicalSpecs
    parent_album: ParentAlbumInfo
    hero_kpi: ReleaseHeroKPI
    time_series: list[TimeSeriesBucket]
    submission_markers: list[SubmissionMarker]
    submissions: list[RedditSubmissionProvenance]


__all__ = [
    "ParentAlbumInfo",
    "ProvenanceSummary",
    "RedditSubmissionProvenance",
    "ReleaseDetailResponse",
    "ReleaseHeroKPI",
    "ReleasePhysicalSpecs",
    "SubmissionEngagement",
]
