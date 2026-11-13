"""Core Catalog Derivations and Helpers Service.

Provides deterministic attribute normalization, persisted Album entity retrieval,
catalog footprint counts via album_artists, Solo vs. Combined artist attribution
classification, and backward-compatible shims for legacy callers.
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

UNICODE_DASH_PATTERN = re.compile(r"[\u2010-\u2015\u2212]")
COLLABORATIVE_ARTIST_PATTERN = re.compile(
    r"(?:\s+(?:/|&|and|feat\.?|ft\.?|with|vs\.?|x)\s+|\s*/\s*|\((?:feat\.?|ft\.?|with|vs\.?)\s+[^)]+\))",
    re.IGNORECASE,
)


def is_single_billed(combined_artist: str | None) -> bool:
    """Return True if combined_artist represents a single artist billing."""
    if not combined_artist or not str(combined_artist).strip():
        return False
    return not bool(COLLABORATIVE_ARTIST_PATTERN.search(str(combined_artist).strip()))


def normalize_attribute(val: str | None) -> str:
    """Normalize string metadata for deterministic hashing and matching.

    - Standardizes unicode dashes [\u2010-\u2015\u2212] to standard ASCII hyphen '-'
    - Collapses consecutive whitespace characters and converts to lowercase
    - Returns empty string for None or whitespace-only inputs.
    """
    if val is None:
        return ""
    raw = str(val).strip()
    if not raw:
        return ""
    cleaned = UNICODE_DASH_PATTERN.sub("-", raw)
    return " ".join(cleaned.lower().split())


def classify_artist_attribution(
    artist_name: str | None,
    combined_artist: str,
    linked_artist_count: int,
) -> str:
    """Classify artist appearance on an album (or album attribution) as 'solo' or 'combined'.

    - Solo: when exactly 1 artist is linked and normalize(artist_name) == normalize(combined_artist),
      or when unlinked (linked_artist_count == 0) and combined_artist is single-billed.
    - Combined: when multiple artists are linked, or normalized names differ,
      or when unlinked and combined_artist represents a collaborative/split billing.
    """
    norm_comb = normalize_attribute(combined_artist)
    if linked_artist_count == 1:
        norm_art = normalize_attribute(artist_name)
        if norm_art == norm_comb:
            return "solo"
        return "combined"
    if linked_artist_count == 0:
        if is_single_billed(combined_artist):
            if artist_name is not None and normalize_attribute(artist_name) not in ("", norm_comb):
                return "combined"
            return "solo"
        return "combined"
    return "combined"


@dataclass(frozen=True)
class CatalogAlbum:
    """Persisted canonical album representation from the albums table."""

    album_id: str
    combined_artist: str
    album_title: str
    release_count: int
    created_at: datetime
    norm_artist: str = ""
    norm_album: str = ""

    def __post_init__(self) -> None:
        if not self.norm_artist:
            object.__setattr__(self, "norm_artist", normalize_attribute(self.combined_artist))
        if not self.norm_album:
            object.__setattr__(self, "norm_album", normalize_attribute(self.album_title))


def get_catalog_albums(session: Session) -> list[CatalogAlbum]:
    """Retrieve all persisted albums from the albums table, counting child releases.

    Queries the albums table directly, exposing albums.id UUID string as album_id
    and albums.title as album_title. Child releases are counted via releases.album_id = albums.id.
    """
    rows = session.execute(
        text(
            """
            SELECT
                a.id,
                a.combined_artist,
                a.title AS album_title,
                a.created_at,
                COUNT(r.id) AS release_count
            FROM albums a
            LEFT JOIN releases r ON r.album_id = a.id
            GROUP BY a.id, a.combined_artist, a.title, a.created_at
            ORDER BY a.created_at ASC, a.id ASC
            """
        )
    ).fetchall()

    return [
        CatalogAlbum(
            album_id=str(row.id),
            combined_artist=row.combined_artist,
            album_title=row.album_title,
            release_count=int(row.release_count),
            created_at=row.created_at,
        )
        for row in rows
    ]


def get_catalog_album(session: Session, album_id: uuid.UUID | str) -> CatalogAlbum | None:
    """Retrieve a single persisted album by UUID, counting child releases.

    Returns None immediately if album_id is an invalid UUID string or not found.
    """
    try:
        if isinstance(album_id, str):
            album_uuid = uuid.UUID(album_id)
        else:
            album_uuid = album_id
    except (ValueError, AttributeError):
        return None

    row = session.execute(
        text(
            """
            SELECT
                a.id,
                a.combined_artist,
                a.title AS album_title,
                a.created_at,
                COUNT(r.id) AS release_count
            FROM albums a
            LEFT JOIN releases r ON r.album_id = a.id
            WHERE a.id = :album_id
            GROUP BY a.id, a.combined_artist, a.title, a.created_at
            """
        ),
        {"album_id": album_uuid},
    ).fetchone()

    if row is None:
        return None

    return CatalogAlbum(
        album_id=str(row.id),
        combined_artist=row.combined_artist,
        album_title=row.album_title,
        release_count=int(row.release_count),
        created_at=row.created_at,
    )


def get_artist_catalog_counts(
    session: Session,
    artist_id: uuid.UUID | str,
) -> tuple[int, int]:
    """Compute (solo_album_count, combined_album_count) for a specific artist.

    Computed directly via album_artists and albums:
    - An album is classified as 'solo' when normalize_attribute(artist.name) == normalize_attribute(album.combined_artist)
      and the album has exactly 1 linked artist in album_artists.
    - Otherwise, classified as 'combined'.

    Returns (0, 0) if artist_id is not a valid UUID or has no albums.
    """
    try:
        if isinstance(artist_id, str):
            artist_uuid = uuid.UUID(artist_id)
        else:
            artist_uuid = artist_id
    except (ValueError, AttributeError):
        return 0, 0

    rows = session.execute(
        text(
            """
            SELECT
                a.name AS artist_name,
                alb.id AS album_id,
                alb.combined_artist,
                (SELECT COUNT(*) FROM album_artists aa2 WHERE aa2.album_id = alb.id) AS linked_artist_count
            FROM artists a
            JOIN album_artists aa ON a.id = aa.artist_id
            JOIN albums alb ON aa.album_id = alb.id
            WHERE a.id = :artist_id
            """
        ),
        {"artist_id": artist_uuid},
    ).fetchall()

    if not rows:
        return 0, 0

    solo_count = 0
    combined_count = 0
    for row in rows:
        attribution = classify_artist_attribution(
            artist_name=row.artist_name,
            combined_artist=row.combined_artist,
            linked_artist_count=int(row.linked_artist_count),
        )
        if attribution == "solo":
            solo_count += 1
        else:
            combined_count += 1

    return solo_count, combined_count


__all__ = [
    "CatalogAlbum",
    "classify_artist_attribution",
    "get_artist_catalog_counts",
    "get_catalog_album",
    "get_catalog_albums",
    "is_single_billed",
    "normalize_attribute",
]
