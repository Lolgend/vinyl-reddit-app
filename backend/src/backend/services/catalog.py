"""Core Catalog Derivations Service.

Provides deterministic normalization, canonical album_id SHA-256 derivation,
earliest-ingested release display casing selection, and Solo vs. Combined
artist attribution classification.
"""

from __future__ import annotations

import hashlib
import re
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

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
    """Derive deterministic 16-character lowercase hex album_id from normalized attributes."""
    payload = f"{norm_artist}|{norm_album}".encode()
    return hashlib.sha256(payload).hexdigest()[:16]


def classify_artist_attribution(
    artist_name: str,
    combined_artist: str,
    linked_artist_count: int,
) -> str:
    """Classify artist appearance on a release as 'solo' or 'combined'.

    - Solo: when normalize(artist_name) == normalize(combined_artist)
      and exactly 1 artist is linked to the release in release_artists.
    - Combined: when normalized names differ or multiple artists are linked
      (e.g. split releases, collaborations).
    """
    norm_art = normalize_attribute(artist_name)
    norm_comb = normalize_attribute(combined_artist)
    if norm_art == norm_comb and linked_artist_count == 1:
        return "solo"
    return "combined"


@dataclass(frozen=True)
class DerivedAlbum:
    """Canonical album representation derived from grouped physical releases."""

    album_id: str
    norm_artist: str
    norm_album: str
    album_title: str
    combined_artist: str
    release_count: int
    earliest_created_at: datetime


def get_all_derived_albums(session: Session) -> list[DerivedAlbum]:
    """Retrieve and derive all canonical albums by grouping releases.

    Canonical display casing for combined_artist and album_title is deterministically
    selected from the earliest-ingested release (ORDER BY releases.created_at ASC, releases.id ASC).
    """
    rows = session.execute(
        text(
            """
            SELECT id, combined_artist, album_title, created_at
            FROM releases
            ORDER BY created_at ASC, id ASC
            """
        )
    ).fetchall()

    albums_map: dict[str, dict[str, Any]] = {}

    for row in rows:
        norm_art = normalize_attribute(row.combined_artist)
        norm_alb = normalize_attribute(row.album_title)
        album_id = derive_album_id(norm_art, norm_alb)

        if album_id not in albums_map:
            albums_map[album_id] = {
                "album_id": album_id,
                "norm_artist": norm_art,
                "norm_album": norm_alb,
                "album_title": row.album_title,
                "combined_artist": row.combined_artist,
                "release_count": 1,
                "earliest_created_at": row.created_at,
            }
        else:
            albums_map[album_id]["release_count"] += 1

    return [DerivedAlbum(**data) for data in albums_map.values()]


def get_artist_catalog_counts(
    session: Session,
    artist_id: uuid.UUID | str,
) -> tuple[int, int]:
    """Compute (solo_album_count, combined_album_count) for a specific artist.

    Returns:
        tuple[int, int]: (solo_album_count, combined_album_count)
    """
    if isinstance(artist_id, str):
        artist_id = uuid.UUID(artist_id)

    rows = session.execute(
        text(
            """
            SELECT r.id, r.combined_artist, r.album_title,
                   (SELECT COUNT(*) FROM release_artists ra2 WHERE ra2.release_id = r.id) AS artist_count,
                   a.name AS artist_name
            FROM releases r
            JOIN release_artists ra ON r.id = ra.release_id
            JOIN artists a ON ra.artist_id = a.id
            WHERE ra.artist_id = :artist_id
            """
        ),
        {"artist_id": artist_id},
    ).fetchall()

    albums: dict[str, list[bool]] = {}

    for row in rows:
        norm_art = normalize_attribute(row.combined_artist)
        norm_alb = normalize_attribute(row.album_title)
        album_id = derive_album_id(norm_art, norm_alb)

        is_solo = classify_artist_attribution(
            artist_name=row.artist_name,
            combined_artist=row.combined_artist,
            linked_artist_count=row.artist_count,
        ) == "solo"

        if album_id not in albums:
            albums[album_id] = []
        albums[album_id].append(is_solo)

    solo_count = sum(1 for is_solos in albums.values() if any(is_solos))
    combined_count = sum(1 for is_solos in albums.values() if not any(is_solos))

    return solo_count, combined_count


__all__ = [
    "DerivedAlbum",
    "classify_artist_attribution",
    "derive_album_id",
    "get_all_derived_albums",
    "get_artist_catalog_counts",
    "normalize_attribute",
]
