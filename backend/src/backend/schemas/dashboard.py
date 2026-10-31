"""Pydantic schemas for Demand Dashboard endpoint and leaderboards."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class AlbumLeaderboardItem(BaseModel):
    """Derived album leaderboard item ranked by Hype Index."""

    album_id: str = Field(..., description="Deterministic 16-character SHA-256 album identifier")
    album_title: str = Field(..., description="Canonical album title (earliest ingested casing)")
    combined_artist: str = Field(..., description="Canonical artist billing")
    hype_index: int = Field(..., ge=0, le=100, description="Window-scaled log-compressed Hype Index (0-100)")
    hype_velocity: float = Field(..., ge=0.0, description="Hype Velocity (+X.X pts/hr)")
    tier: Literal["high", "moderate", "low"] = Field(..., description="Qualitative demand tier")
    release_count: int = Field(..., ge=1, description="Number of child pressings under this album")
    monogram_key: str = Field(..., description="Key for deterministic monogram styling")


class ReleaseLeaderboardItem(BaseModel):
    """Physical release leaderboard item ranked by Hype Index."""

    release_id: str = Field(..., description="UUID string of physical release")
    album_id: str = Field(..., description="Parent derived album identifier")
    album_title: str = Field(..., description="Album title")
    combined_artist: str = Field(..., description="Artist billing")
    variant: str | None = Field(default=None, description="Pressing variant description")
    retailer_name: str | None = Field(default=None, description="Distributor or exclusive retailer name")
    hype_index: int = Field(..., ge=0, le=100, description="Hype Index (0-100)")
    hype_velocity: float = Field(..., ge=0.0, description="Hype Velocity (+X.X pts/hr)")
    tier: Literal["high", "moderate", "low"] = Field(..., description="Qualitative demand tier")
    monogram_key: str = Field(..., description="Key for deterministic monogram styling")


class NewlyAddedReleaseItem(BaseModel):
    """Release first discovered within the last 24 hours."""

    release_id: str = Field(..., description="UUID string of physical release")
    album_id: str = Field(..., description="Parent derived album identifier")
    album_title: str = Field(..., description="Album title")
    combined_artist: str = Field(..., description="Artist billing")
    variant: str | None = Field(default=None, description="Pressing variant description")
    retailer_name: str | None = Field(default=None, description="Distributor or exclusive retailer name")
    hype_index: int = Field(..., ge=0, le=100, description="Hype Index (0-100)")
    hype_velocity: float = Field(..., ge=0.0, description="Hype Velocity (+X.X pts/hr)")
    tier: Literal["high", "moderate", "low"] = Field(..., description="Qualitative demand tier")
    monogram_key: str = Field(..., description="Key for deterministic monogram styling")
    first_seen_at: datetime = Field(..., description="Timestamp when release was first discovered")


class LiveFeedItem(BaseModel):
    """7-column ledger item for live release feed."""

    release_id: str = Field(..., description="UUID string of physical release")
    album_id: str = Field(..., description="Parent derived album identifier")
    album_title: str = Field(..., description="Album title")
    combined_artist: str = Field(..., description="Artist billing")
    variant: str | None = Field(default=None, description="Pressing variant description")
    retailer_name: str | None = Field(default=None, description="Distributor or exclusive retailer name")
    hype_index: int = Field(..., ge=0, le=100, description="Hype Index (0-100)")
    hype_velocity: float = Field(..., ge=0.0, description="Hype Velocity (+X.X pts/hr)")
    tier: Literal["high", "moderate", "low"] = Field(..., description="Qualitative demand tier")
    score: int = Field(..., description="Latest Reddit upvote score")
    num_comments: int = Field(..., description="Latest Reddit comment count")
    posted_at: datetime = Field(..., description="Reddit post or release discovery timestamp")
    monogram_key: str = Field(..., description="Key for deterministic monogram styling")


class DashboardResponse(BaseModel):
    """Compound response schema for GET /api/v1/dashboard."""

    window: Literal["24H", "7D", "1M"] = Field(..., description="Active analysis timeframe window")
    top_albums: list[AlbumLeaderboardItem] = Field(..., description="Top 5 albums ranked by Hype Index")
    top_releases: list[ReleaseLeaderboardItem] = Field(..., description="Top 5 releases ranked by Hype Index")
    newly_added: list[NewlyAddedReleaseItem] = Field(..., description="Releases first seen in the last 24 hours")
    live_feed: list[LiveFeedItem] = Field(..., description="Recent active pressings ledger feed")
