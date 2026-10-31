"""Multi-entity substring search service for catalog albums, releases, and artists."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.schemas.search import QuickSearchResponse, SearchResultItem
from backend.services.catalog import derive_album_id, get_artist_catalog_counts


def search_catalog(session: Session, query: str, limit: int = 5) -> QuickSearchResponse:
    """Execute case-insensitive substring search across albums, releases, and artists.

    Returns empty lists if query is fewer than 2 non-whitespace characters.
    """
    clean_query = query.strip()
    if len(clean_query) < 2:
        return QuickSearchResponse(query=query)

    search_term = f"%{clean_query}%"

    # 1. Search Derived Albums
    album_sql = text(
        r"""
        WITH normalized_releases AS (
            SELECT
                id,
                combined_artist,
                album_title,
                created_at,
                LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(combined_artist, '[\u2010-\u2015\u2212]', '-', 'g'), '\s+', ' ', 'g'))) AS norm_artist,
                LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(album_title, '[\u2010-\u2015\u2212]', '-', 'g'), '\s+', ' ', 'g'))) AS norm_album
            FROM releases
        ),
        ranked_releases AS (
            SELECT
                id,
                combined_artist,
                album_title,
                norm_artist,
                norm_album,
                created_at,
                ROW_NUMBER() OVER (PARTITION BY norm_artist, norm_album ORDER BY created_at ASC, id ASC) AS rn,
                COUNT(*) OVER (PARTITION BY norm_artist, norm_album) AS release_count
            FROM normalized_releases
        )
        SELECT norm_artist, norm_album, combined_artist, album_title, release_count, created_at
        FROM ranked_releases
        WHERE rn = 1
          AND (combined_artist ILIKE :term OR album_title ILIKE :term)
        ORDER BY created_at DESC, combined_artist ASC
        LIMIT :limit
        """
    )
    album_rows = session.execute(album_sql, {"term": search_term, "limit": limit}).fetchall()
    album_items: list[SearchResultItem] = []
    for row in album_rows:
        alb_id = derive_album_id(row.norm_artist, row.norm_album)
        pressings_suffix = "pressing" if row.release_count == 1 else "pressings"
        album_items.append(
            SearchResultItem(
                id=alb_id,
                title=row.album_title,
                subtitle=f"{row.combined_artist} · {row.release_count} {pressings_suffix}",
                monogram_key=alb_id,
                extra={
                    "combined_artist": row.combined_artist,
                    "album_title": row.album_title,
                    "release_count": row.release_count,
                },
            )
        )

    # 2. Search Physical Releases
    release_sql = text(
        """
        SELECT id, combined_artist, album_title, variant, retailer_name, created_at
        FROM releases
        WHERE combined_artist ILIKE :term
           OR album_title ILIKE :term
           OR variant ILIKE :term
           OR retailer_name ILIKE :term
        ORDER BY created_at DESC, id ASC
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
