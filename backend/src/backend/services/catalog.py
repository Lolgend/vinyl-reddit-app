"""Core Catalog Derivations and Helpers Service.

Provides deterministic attribute normalization, persisted Album entity retrieval,
catalog footprint counts via album_artists, Solo vs. Combined artist attribution
classification, and backward-compatible shims for legacy callers.
"""

from __future__ import annotations

import hashlib
import re
import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

UNICODE_DASH_PATTERN = re.compile(r"[\u2010-\u2015\u2212]")


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


def derive_album_id(norm_artist: str, norm_album: str) -> str:
    """Derive deterministic 16-character lowercase hex album_id from normalized attributes.

    Deprecated: Upstream PR #51 migrated to persisted canonical albums.id UUIDs.
    Kept as a backward-compatible shim for legacy callers.
    """
    payload = f"{norm_artist}|{norm_album}".encode()
    return hashlib.sha256(payload).hexdigest()[:16]


def classify_artist_attribution(
    artist_name: str,
    combined_artist: str,
    linked_artist_count: int,
) -> str:
    """Classify artist appearance on an album as 'solo' or 'combined'.

    - Solo: when normalize(artist_name) == normalize(combined_artist)
      and exactly 1 artist is linked to the album in album_artists.
    - Combined: when normalized names differ or multiple artists are linked
      (e.g. split releases, collaborations).
    """
    norm_art = normalize_attribute(artist_name)
    norm_comb = normalize_attribute(combined_artist)
    if norm_art == norm_comb and linked_artist_count == 1:
        return "solo"
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
    earliest_created_at: datetime | None = None

    def __post_init__(self) -> None:
        if not self.norm_artist:
            object.__setattr__(self, "norm_artist", normalize_attribute(self.combined_artist))
        if not self.norm_album:
            object.__setattr__(self, "norm_album", normalize_attribute(self.album_title))
        if self.earliest_created_at is None:
            object.__setattr__(self, "earliest_created_at", self.created_at)


# Backward-compatibility alias
DerivedAlbum = CatalogAlbum


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


def get_all_derived_albums(session: Session) -> list[CatalogAlbum]:
    """Deprecated: Backward-compatible alias for get_catalog_albums."""
    return get_catalog_albums(session)


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


def get_artists_catalog_counts(
    session: Session,
    artist_ids: list[uuid.UUID | str],
) -> dict[str, tuple[int, int]]:
    """Batch compute (solo_album_count, combined_album_count) mapped by artist_id string."""
    valid_uuids: list[uuid.UUID] = []
    for aid in artist_ids:
        try:
            valid_uuids.append(uuid.UUID(str(aid)))
        except (ValueError, AttributeError):
            continue

    result: dict[str, tuple[int, int]] = {str(aid): (0, 0) for aid in valid_uuids}
    if not valid_uuids:
        return result

    rows = session.execute(
        text(
            """
            SELECT
                a.id AS artist_id,
                a.name AS artist_name,
                alb.id AS album_id,
                alb.combined_artist,
                (SELECT COUNT(*) FROM album_artists aa2 WHERE aa2.album_id = alb.id) AS linked_artist_count
            FROM artists a
            JOIN album_artists aa ON a.id = aa.artist_id
            JOIN albums alb ON aa.album_id = alb.id
            WHERE a.id = ANY(:artist_ids)
            """
        ),
        {"artist_ids": valid_uuids},
    ).fetchall()

    counts: dict[str, list[str]] = {str(aid): [] for aid in valid_uuids}
    for row in rows:
        art_key = str(row.artist_id)
        attr = classify_artist_attribution(
            artist_name=row.artist_name,
            combined_artist=row.combined_artist,
            linked_artist_count=int(row.linked_artist_count),
        )
        counts[art_key].append(attr)

    for art_key, attrs in counts.items():
        solo = sum(1 for a in attrs if a == "solo")
        comb = sum(1 for a in attrs if a != "solo")
        result[art_key] = (solo, comb)

    return result


__all__ = [
    "CatalogAlbum",
    "DerivedAlbum",
    "classify_artist_attribution",
    "derive_album_id",
    "get_all_derived_albums",
    "get_artist_catalog_counts",
    "get_artists_catalog_counts",
    "get_catalog_album",
    "get_catalog_albums",
    "normalize_attribute",
]
