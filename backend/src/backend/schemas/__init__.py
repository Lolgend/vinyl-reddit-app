"""API request and response schemas."""

from backend.schemas.album import (
    AlbumDetailResponse,
    AlbumHeroKPI,
    AlbumIdentity,
    ArtistRef,
    ChildReleaseRow,
    PressingsProvenance,
    RedditDemand,
    ShareOfDemandItem,
    SubmissionMarker,
    TimeSeriesBucket,
)
from backend.schemas.artist import (
    ArtistDetailResponse,
    ArtistHeroKPI,
    ArtistIdentity,
    ArtistRedditDemand,
    CatalogFootprint,
    ChildReleaseLedgerRow,
    TrackedAlbumRow,
)
from backend.schemas.dashboard import (
    AlbumLeaderboardItem,
    DashboardResponse,
    LiveFeedItem,
    NewlyAddedReleaseItem,
    ReleaseLeaderboardItem,
)
from backend.schemas.release import (
    ParentAlbumInfo,
    ProvenanceSummary,
    RedditSubmissionProvenance,
    ReleaseDetailResponse,
    ReleaseHeroKPI,
    ReleasePhysicalSpecs,
    SubmissionEngagement,
)
from backend.schemas.search import QuickSearchResponse, SearchResultItem

__all__ = [
    "AlbumDetailResponse",
    "AlbumHeroKPI",
    "AlbumIdentity",
    "AlbumLeaderboardItem",
    "ArtistDetailResponse",
    "ArtistHeroKPI",
    "ArtistIdentity",
    "ArtistRedditDemand",
    "ArtistRef",
    "CatalogFootprint",
    "ChildReleaseLedgerRow",
    "ChildReleaseRow",
    "DashboardResponse",
    "LiveFeedItem",
    "NewlyAddedReleaseItem",
    "ParentAlbumInfo",
    "PressingsProvenance",
    "ProvenanceSummary",
    "QuickSearchResponse",
    "RedditDemand",
    "RedditSubmissionProvenance",
    "ReleaseDetailResponse",
    "ReleaseHeroKPI",
    "ReleaseLeaderboardItem",
    "ReleasePhysicalSpecs",
    "SearchResultItem",
    "ShareOfDemandItem",
    "SubmissionEngagement",
    "SubmissionMarker",
    "TimeSeriesBucket",
    "TrackedAlbumRow",
]
