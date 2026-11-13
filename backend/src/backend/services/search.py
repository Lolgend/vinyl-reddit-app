"""Multi-entity substring search service for catalog albums, releases, and artists."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.schemas.search import QuickSearchResponse, SearchResultItem
from backend.services.catalog import get_artist_catalog_counts


def search_catalog(session: Session, query: str, limit: int = 5) -> QuickSearchResponse:
    """Execute case-insensitive substring search across albums, releases, and artists.

    Returns empty lists if query is fewer than 2 non-whitespace characters.
    """
    clean_query = query.strip()
    if len(clean_query) < 2:
        return QuickSearchResponse(query=query)

    search_term = f"%{clean_query}%"

    # 1. Search Persisted Albums
    album_sql = text(
        """
        SELECT
            a.id,
            a.combined_artist,
            a.title AS album_title,
            a.created_at,
            COUNT(r.id) AS release_count
        FROM albums a
        LEFT JOIN releases r ON r.album_id = a.id
        WHERE a.combined_artist ILIKE :term
           OR a.title ILIKE :term
        GROUP BY a.id, a.combined_artist, a.title, a.created_at
        ORDER BY a.created_at DESC, a.combined_artist ASC
        LIMIT :limit
        """
    )
    album_rows = session.execute(album_sql, {"term": search_term, "limit": limit}).fetchall()
    album_items: list[SearchResultItem] = []
    for row in album_rows:
        alb_id = str(row.id)
        rel_count = int(row.release_count)
        pressings_suffix = "pressing" if rel_count == 1 else "pressings"
        album_items.append(
            SearchResultItem(
                id=alb_id,
                title=row.album_title,
                subtitle=f"{row.combined_artist} · {rel_count} {pressings_suffix}",
                monogram_key=alb_id,
                extra={
                    "combined_artist": row.combined_artist,
                    "album_title": row.album_title,
                    "release_count": rel_count,
                },
            )
        )

    # 2. Search Physical Releases
    release_sql = text(
        """
        SELECT
            r.id,
            r.album_id,
            a.combined_artist,
            a.title AS album_title,
            r.variant,
            r.retailer_name,
            r.created_at
        FROM releases r
        JOIN albums a ON r.album_id = a.id
        WHERE a.combined_artist ILIKE :term
           OR a.title ILIKE :term
           OR r.variant ILIKE :term
           OR r.retailer_name ILIKE :term
        ORDER BY r.created_at DESC, r.id ASC
        LIMIT :limit
        """
    )
    release_rows = session.execute(release_sql, {"term": search_term, "limit": limit}).fetchall()
    release_items: list[SearchResultItem] = []
    for row in release_rows:
        variant_desc = row.variant or "Standard Pressing"
        if row.retailer_name:
            subtitle = f"{row.combined_artist} · {variant_desc} · {row.retailer_name}"
        else:
            subtitle = f"{row.combined_artist} · {variant_desc}"

        rel_id = str(row.id)
        release_items.append(
            SearchResultItem(
                id=rel_id,
                title=row.album_title,
                subtitle=subtitle,
                monogram_key=rel_id,
                extra={
                    "album_id": str(row.album_id),
                    "combined_artist": row.combined_artist,
                    "album_title": row.album_title,
                    "variant": row.variant,
                    "retailer_name": row.retailer_name,
                },
            )
        )

    # 3. Search Artists
    artist_sql = text(
        """
        SELECT id, name
        FROM artists
        WHERE name ILIKE :term
        ORDER BY name ASC
        LIMIT :limit
        """
    )
    artist_rows = session.execute(artist_sql, {"term": search_term, "limit": limit}).fetchall()
    artist_items: list[SearchResultItem] = []
    for row in artist_rows:
        solo_cnt, comb_cnt = get_artist_catalog_counts(session, row.id)
        total_albums = solo_cnt + comb_cnt
        album_word = "album" if total_albums == 1 else "albums"
        subtitle = f"{solo_cnt} solo · {comb_cnt} combined ({total_albums} {album_word})"
        art_id = str(row.id)
        artist_items.append(
            SearchResultItem(
                id=art_id,
                title=row.name,
                subtitle=subtitle,
                monogram_key=art_id,
                extra={
                    "solo_album_count": solo_cnt,
                    "combined_album_count": comb_cnt,
                },
            )
        )

    return QuickSearchResponse(
        query=query,
        albums=album_items,
        releases=release_items,
        artists=artist_items,
    )


__all__ = ["search_catalog"]
