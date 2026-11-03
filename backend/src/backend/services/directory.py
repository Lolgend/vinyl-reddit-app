"""Directory Explorer Service.

Provides paginated listings and facet filtering for Releases, derived Albums,
and Artists, computing window-decayed Hype Indices, velocities, and catalog counts.
"""

from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.schemas.directory import (
    AlbumDirectoryItem,
    ArtistDirectoryItem,
    DirectoryCountsResponse,
    PaginatedAlbumsResponse,
    PaginatedArtistsResponse,
    PaginatedReleasesResponse,
    ReleaseDirectoryItem,
)
from backend.services.catalog import (
    classify_artist_attribution,
)
from backend.services.hype import (
    DEFAULT_WINDOW,
    REFERENCE_FLOOR,
    WINDOW_CONFIG,
    WindowType,
    calculate_hype_index,
    compute_submission_metrics,
    get_hype_tier,
)


def _compute_directory_cohorts(
    session: Session,
    window: WindowType = DEFAULT_WINDOW,
    now: datetime | None = None,
) -> tuple[
    list[ReleaseDirectoryItem],
    list[AlbumDirectoryItem],
    list[ArtistDirectoryItem],
]:
    """Compute all Releases, Albums, and Artists with window scoring."""
    if window not in WINDOW_CONFIG:
        window = DEFAULT_WINDOW

    if now is None:
        now = datetime.now(timezone.utc)

    spec = WINDOW_CONFIG[window]
    t0 = now - timedelta(hours=spec.duration_hours)

    # 1. Fetch releases joined with parent albums in deterministic earliest-ingested order
    rel_rows = session.execute(
        text(
            """
            SELECT
                r.id,
                r.album_id,
                r.variant,
                r.retailer_name,
                r.created_at,
                a.title AS album_title,
                a.combined_artist
            FROM releases r
            JOIN albums a ON r.album_id = a.id
            ORDER BY r.created_at ASC, r.id ASC
            """
        )
    ).fetchall()

    # 2. Fetch linked release submissions
    sub_rows = session.execute(
        text(
            """
            SELECT
                sr.release_id,
                s.id AS submission_id,
                s.created_utc,
                s.latest_score,
                s.latest_num_comments,
                s.latest_upvote_ratio
            FROM submission_releases sr
            JOIN submissions s ON sr.submission_id = s.id
            WHERE s.is_release = TRUE
            """
        )
    ).fetchall()

    # 3. Fetch snapshots
    snap_rows = session.execute(
        text(
            """
            SELECT
                ss.submission_id,
                ss.score,
                ss.num_comments,
                ss.captured_at
            FROM submission_snapshots ss
            JOIN submissions s ON ss.submission_id = s.id
            WHERE s.is_release = TRUE
            ORDER BY ss.submission_id, ss.captured_at ASC
            """
        )
    ).fetchall()

    snapshots_by_sub: dict[str, list[Any]] = defaultdict(list)
    for sn in snap_rows:
        snapshots_by_sub[sn.submission_id].append(sn)

    # 4. Compute submission metrics
    submission_metrics: dict[str, dict[str, Any]] = {}
    release_submissions: dict[str, set[str]] = defaultdict(set)

    for row in sub_rows:
        s_id = row.submission_id
        r_id = str(row.release_id)
        release_submissions[r_id].add(s_id)

        if s_id in submission_metrics:
            continue

        submission_metrics[s_id] = compute_submission_metrics(
            created_utc=row.created_utc,
            latest_score=row.latest_score,
            latest_num_comments=row.latest_num_comments,
            latest_upvote_ratio=row.latest_upvote_ratio,
            snapshots=snapshots_by_sub.get(s_id, []),
            window=window,
            now=now,
            t0=t0,
        )

    # 5. Fetch all persisted albums
    alb_rows = session.execute(
        text(
            """
            SELECT id, combined_artist, title AS album_title, created_at
            FROM albums
            ORDER BY created_at ASC, id ASC
            """
        )
    ).fetchall()

    # 6. Fetch album-artist linkages
    aa_rows = session.execute(
        text(
            """
            SELECT
                aa.album_id,
                aa.artist_id,
                art.name AS artist_name
            FROM album_artists aa
            JOIN artists art ON aa.artist_id = art.id
            ORDER BY aa.album_id, aa.created_at ASC, art.name ASC
            """
        )
    ).fetchall()

    album_artists_by_alb: dict[str, list[str]] = defaultdict(list)
    artist_albums_by_art: dict[str, list[str]] = defaultdict(list)
    for aa in aa_rows:
        album_artists_by_alb[str(aa.album_id)].append(aa.artist_name)
        artist_albums_by_art[str(aa.artist_id)].append(str(aa.album_id))

    # 7. Fetch all artists
    art_rows = session.execute(
        text(
            """
            SELECT id, name, created_at
            FROM artists
            ORDER BY name ASC, id ASC
            """
        )
    ).fetchall()

    # Build Releases data
    raw_releases: list[dict[str, Any]] = []
    releases_by_alb: dict[str, list[Any]] = defaultdict(list)

    for rel_row in rel_rows:
        rel_id = str(rel_row.id)
        alb_id = str(rel_row.album_id)
        releases_by_alb[alb_id].append(rel_row)

        linked_subs = release_submissions.get(rel_id, set())
        rel_velocity = round(sum(submission_metrics[s]["velocity"] for s in linked_subs), 1)
        rel_raw_hype = sum(submission_metrics[s]["raw_hype"] for s in linked_subs)
        rel_score = sum(submission_metrics[s]["score"] for s in linked_subs)
        rel_num_comments = sum(submission_metrics[s]["num_comments"] for s in linked_subs)

        rel_data = {
            "release_id": rel_id,
            "album_id": alb_id,
            "album_title": rel_row.album_title,
            "combined_artist": rel_row.combined_artist,
            "variant": rel_row.variant,
            "retailer_name": rel_row.retailer_name,
            "raw_hype": rel_raw_hype,
            "hype_velocity": rel_velocity,
            "score": rel_score,
            "num_comments": rel_num_comments,
            "submission_count": len(linked_subs),
            "created_at": rel_row.created_at,
            "monogram_key": rel_id,
        }
        raw_releases.append(rel_data)

    # Build Albums data
    raw_albums: list[dict[str, Any]] = []
    for alb_row in alb_rows:
        alb_id = str(alb_row.id)
        child_rels = releases_by_alb.get(alb_id, [])

        union_subs: set[str] = set()
        variants: list[str] = []
        retailers: set[str] = set()

        for r in child_rels:
            r_id = str(r.id)
            union_subs.update(release_submissions.get(r_id, set()))
            if r.variant and r.variant.strip() and r.variant not in variants:
                variants.append(r.variant)
            if r.retailer_name and r.retailer_name.strip():
                retailers.add(r.retailer_name.strip())

        alb_velocity = round(sum(submission_metrics[s]["velocity"] for s in union_subs), 1)
        alb_raw_hype = sum(submission_metrics[s]["raw_hype"] for s in union_subs)
        alb_score = sum(submission_metrics[s]["score"] for s in union_subs)
        alb_num_comments = sum(submission_metrics[s]["num_comments"] for s in union_subs)

        # Attribution: classify via album_artists
        linked_artists = album_artists_by_alb.get(alb_id, [])
        if len(linked_artists) == 1:
            attr = classify_artist_attribution(
                artist_name=linked_artists[0],
                combined_artist=alb_row.combined_artist,
                linked_artist_count=1,
            )
            alb_attribution: Literal["solo", "combined"] = "solo" if attr == "solo" else "combined"
        else:
            alb_attribution = "combined"

        earliest_created_at = child_rels[0].created_at if child_rels else alb_row.created_at

        alb_data = {
            "album_id": alb_id,
            "album_title": alb_row.album_title,
            "combined_artist": alb_row.combined_artist,
            "release_count": len(child_rels),
            "preview_variants": variants[:3],
            "retailers": sorted(retailers),
            "submission_count": len(union_subs),
            "score": alb_score,
            "num_comments": alb_num_comments,
            "hype_velocity": alb_velocity,
            "raw_hype": alb_raw_hype,
            "attribution": alb_attribution,
            "monogram_key": alb_id,
            "created_at": earliest_created_at,
        }
        raw_albums.append(alb_data)

    # Build Artists data
    alb_by_id = {str(a.id): a for a in alb_rows}
    raw_artists: list[dict[str, Any]] = []

    for art_row in art_rows:
        art_id = str(art_row.id)
        linked_alb_ids = artist_albums_by_art.get(art_id, [])

        solo_count = 0
        combined_count = 0
        art_releases: set[str] = set()

        for alb_id in linked_alb_ids:
            alb = alb_by_id.get(alb_id)
            if alb is None:
                continue
            linked_cnt = len(album_artists_by_alb.get(alb_id, []))
            attr = classify_artist_attribution(
                artist_name=art_row.name,
                combined_artist=alb.combined_artist,
                linked_artist_count=linked_cnt,
            )
            if attr == "solo":
                solo_count += 1
            else:
                combined_count += 1

            for r in releases_by_alb.get(alb_id, []):
                art_releases.add(str(r.id))

        art_subs: set[str] = set()
        for r_id in art_releases:
            art_subs.update(release_submissions.get(r_id, set()))

        art_velocity = round(sum(submission_metrics[s]["velocity"] for s in art_subs), 1)
        art_raw_hype = sum(submission_metrics[s]["raw_hype"] for s in art_subs)
        art_score = sum(submission_metrics[s]["score"] for s in art_subs)
        art_num_comments = sum(submission_metrics[s]["num_comments"] for s in art_subs)

        art_data = {
            "artist_id": art_id,
            "name": art_row.name,
            "solo_album_count": solo_count,
            "combined_album_count": combined_count,
            "album_count": solo_count + combined_count,
            "release_count": len(art_releases),
            "submission_count": len(art_subs),
            "score": art_score,
            "num_comments": art_num_comments,
            "hype_velocity": art_velocity,
            "raw_hype": art_raw_hype,
            "monogram_key": art_id,
            "created_at": art_row.created_at,
        }
        raw_artists.append(art_data)

    # 6. Normalize Releases cohort
    max_rel_raw = max((rel_d["raw_hype"] for rel_d in raw_releases), default=0.0)
    final_releases: list[ReleaseDirectoryItem] = []
    for rel_d in raw_releases:
        h_idx = calculate_hype_index(rel_d["raw_hype"], max_rel_raw, REFERENCE_FLOOR)
        final_releases.append(
            ReleaseDirectoryItem(
                release_id=rel_d["release_id"],
                album_id=rel_d["album_id"],
                album_title=rel_d["album_title"],
                combined_artist=rel_d["combined_artist"],
                variant=rel_d["variant"],
                retailer_name=rel_d["retailer_name"],
                hype_index=h_idx,
                hype_velocity=rel_d["hype_velocity"],
                tier=get_hype_tier(h_idx),
                score=rel_d["score"],
                num_comments=rel_d["num_comments"],
                submission_count=rel_d["submission_count"],
                created_at=rel_d["created_at"],
                monogram_key=rel_d["monogram_key"],
            )
        )

    # 7. Normalize Albums cohort
    max_alb_raw = max((alb_d["raw_hype"] for alb_d in raw_albums), default=0.0)
    final_albums: list[AlbumDirectoryItem] = []
    for alb_d in raw_albums:
        h_idx = calculate_hype_index(alb_d["raw_hype"], max_alb_raw, REFERENCE_FLOOR)
        final_albums.append(
            AlbumDirectoryItem(
                album_id=alb_d["album_id"],
                album_title=alb_d["album_title"],
                combined_artist=alb_d["combined_artist"],
                release_count=alb_d["release_count"],
                preview_variants=alb_d["preview_variants"],
                retailers=alb_d["retailers"],
                submission_count=alb_d["submission_count"],
                score=alb_d["score"],
                num_comments=alb_d["num_comments"],
                hype_velocity=alb_d["hype_velocity"],
                hype_index=h_idx,
                tier=get_hype_tier(h_idx),
                attribution=alb_d["attribution"],
                monogram_key=alb_d["monogram_key"],
                created_at=alb_d["created_at"],
            )
        )

    # 8. Normalize Artists cohort
    max_art_raw = max((art_d["raw_hype"] for art_d in raw_artists), default=0.0)
    final_artists: list[ArtistDirectoryItem] = []
    for art_d in raw_artists:
        h_idx = calculate_hype_index(art_d["raw_hype"], max_art_raw, REFERENCE_FLOOR)
        final_artists.append(
            ArtistDirectoryItem(
                artist_id=art_d["artist_id"],
                name=art_d["name"],
                solo_album_count=art_d["solo_album_count"],
                combined_album_count=art_d["combined_album_count"],
                album_count=art_d["album_count"],
                release_count=art_d["release_count"],
                submission_count=art_d["submission_count"],
                score=art_d["score"],
                num_comments=art_d["num_comments"],
                hype_velocity=art_d["hype_velocity"],
                hype_index=h_idx,
                tier=get_hype_tier(h_idx),
                monogram_key=art_d["monogram_key"],
                created_at=art_d["created_at"],
            )
        )

    return final_releases, final_albums, final_artists


def get_directory_releases(
    session: Session,
    window: WindowType = DEFAULT_WINDOW,
    q: str | None = None,
    tier: Literal["high", "moderate", "low"] | None = None,
    retailer: str | None = None,
    sort: Literal["hype_index", "hype_velocity", "submissions", "created_at"] | str = "hype_index",
    order: Literal["asc", "desc"] = "desc",
    sort_by: str | None = None,
    sort_order: Literal["asc", "desc"] | None = None,
    page: int = 1,
    page_size: int = 20,
    now: datetime | None = None,
) -> PaginatedReleasesResponse:
    """Retrieve filtered, sorted, paginated physical releases."""
    releases, _, _ = _compute_directory_cohorts(session, window=window, now=now)

    filtered = releases

    actual_sort = sort_by or sort
    actual_order = sort_order or order

    # Search filter
    if q and q.strip():
        q_norm = q.strip().lower()
        filtered = [
            r
            for r in filtered
            if q_norm in r.album_title.lower()
            or q_norm in r.combined_artist.lower()
            or (r.variant and q_norm in r.variant.lower())
            or (r.retailer_name and q_norm in r.retailer_name.lower())
        ]

    # Tier filter
    if tier and tier.lower() in ("high", "moderate", "low"):
        tier_lower = tier.lower()
        filtered = [r for r in filtered if r.tier == tier_lower]

    # Retailer filter (excludes null retailers)
    if retailer and retailer.strip() and retailer.strip().lower() not in ("all", "none"):
        ret_norm = retailer.strip().lower()
        filtered = [
            r for r in filtered if r.retailer_name and r.retailer_name.strip().lower() == ret_norm
        ]

    # Sorting
    is_reverse = actual_order.lower() == "desc"
    if actual_sort == "hype_velocity":
        filtered.sort(
            key=lambda r: (r.hype_velocity, r.hype_index, r.created_at.timestamp(), r.release_id),
            reverse=is_reverse,
        )
    elif actual_sort in ("submissions", "submission_count"):
        filtered.sort(
            key=lambda r: (r.submission_count, r.score, r.hype_index, r.release_id),
            reverse=is_reverse,
        )
    elif actual_sort == "created_at":
        filtered.sort(
            key=lambda r: (r.created_at.timestamp(), r.hype_index, r.release_id),
            reverse=is_reverse,
        )
    elif actual_sort in ("title", "album_title"):
        filtered.sort(
            key=lambda r: (r.album_title.lower(), r.combined_artist.lower(), r.release_id),
            reverse=is_reverse,
        )
    else:  # default "hype_index"
        filtered.sort(
            key=lambda r: (r.hype_index, r.hype_velocity, r.created_at.timestamp(), r.release_id),
            reverse=is_reverse,
        )

    total_items = len(filtered)
    total_pages = max(1, math.ceil(total_items / page_size)) if total_items > 0 else 1
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    items = filtered[start_idx:end_idx]

    return PaginatedReleasesResponse(
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        total_items=total_items,
        items=items,
    )


def get_directory_albums(
    session: Session,
    window: WindowType = DEFAULT_WINDOW,
    q: str | None = None,
    tier: Literal["high", "moderate", "low"] | None = None,
    retailer: str | None = None,
    attribution: Literal["all", "solo", "combined"] | None = None,
    sort: Literal["hype_index", "hype_velocity", "submissions", "created_at", "release_count"]
    | str = "hype_index",
    order: Literal["asc", "desc"] = "desc",
    sort_by: str | None = None,
    sort_order: Literal["asc", "desc"] | None = None,
    page: int = 1,
    page_size: int = 20,
    now: datetime | None = None,
) -> PaginatedAlbumsResponse:
    """Retrieve filtered, sorted, paginated derived albums."""
    _, albums, _ = _compute_directory_cohorts(session, window=window, now=now)

    filtered = albums

    actual_sort = sort_by or sort
    actual_order = sort_order or order

    # Search filter
    if q and q.strip():
        q_norm = q.strip().lower()
        filtered = [
            a
            for a in filtered
            if q_norm in a.album_title.lower()
            or q_norm in a.combined_artist.lower()
            or any(q_norm in v.lower() for v in a.preview_variants)
            or any(q_norm in ret.lower() for ret in a.retailers)
        ]

    # Tier filter
    if tier and tier.lower() in ("high", "moderate", "low"):
        tier_lower = tier.lower()
        filtered = [a for a in filtered if a.tier == tier_lower]

    # Retailer filter
    if retailer and retailer.strip() and retailer.strip().lower() not in ("all", "none"):
        ret_norm = retailer.strip().lower()
        filtered = [
            a for a in filtered if any(r.strip().lower() == ret_norm for r in a.retailers)
        ]

    # Attribution filter (solo vs combined)
    if attribution and attribution.lower() in ("solo", "combined"):
        target_attr = attribution.lower()
        filtered = [a for a in filtered if a.attribution == target_attr]

    # Sorting
    is_reverse = actual_order.lower() == "desc"
    if actual_sort == "hype_velocity":
        filtered.sort(
            key=lambda a: (a.hype_velocity, a.hype_index, a.created_at.timestamp(), a.album_id),
            reverse=is_reverse,
        )
    elif actual_sort in ("submissions", "submission_count"):
        filtered.sort(
            key=lambda a: (a.submission_count, a.score, a.hype_index, a.album_id),
            reverse=is_reverse,
        )
    elif actual_sort == "created_at":
        filtered.sort(
            key=lambda a: (a.created_at.timestamp(), a.hype_index, a.album_id),
            reverse=is_reverse,
        )
    elif actual_sort == "release_count":
        filtered.sort(
            key=lambda a: (a.release_count, a.hype_index, a.album_id),
            reverse=is_reverse,
        )
    elif actual_sort in ("title", "album_title"):
        filtered.sort(
            key=lambda a: (a.album_title.lower(), a.combined_artist.lower(), a.album_id),
            reverse=is_reverse,
        )
    else:  # default "hype_index"
        filtered.sort(
            key=lambda a: (a.hype_index, a.hype_velocity, a.created_at.timestamp(), a.album_id),
            reverse=is_reverse,
        )

    total_items = len(filtered)
    total_pages = max(1, math.ceil(total_items / page_size)) if total_items > 0 else 1
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    items = filtered[start_idx:end_idx]

    return PaginatedAlbumsResponse(
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        total_items=total_items,
        items=items,
    )


def get_directory_artists(
    session: Session,
    window: WindowType = DEFAULT_WINDOW,
    q: str | None = None,
    tier: Literal["high", "moderate", "low"] | None = None,
    attribution: Literal["all", "solo", "combined"] | None = None,
    sort: Literal[
        "hype_index", "hype_velocity", "submissions", "created_at", "album_count", "release_count"
    ]
    | str = "hype_index",
    order: Literal["asc", "desc"] = "desc",
    sort_by: str | None = None,
    sort_order: Literal["asc", "desc"] | None = None,
    page: int = 1,
    page_size: int = 20,
    now: datetime | None = None,
) -> PaginatedArtistsResponse:
    """Retrieve filtered, sorted, paginated artists."""
    _, _, artists = _compute_directory_cohorts(session, window=window, now=now)

    filtered = artists

    actual_sort = sort_by or sort
    actual_order = sort_order or order

    # Search filter
    if q and q.strip():
        q_norm = q.strip().lower()
        filtered = [a for a in filtered if q_norm in a.name.lower()]

    # Tier filter
    if tier and tier.lower() in ("high", "moderate", "low"):
        tier_lower = tier.lower()
        filtered = [a for a in filtered if a.tier == tier_lower]

    # Attribution filter (solo vs combined)
    if attribution and attribution.lower() in ("solo", "combined"):
        target_attr = attribution.lower()
        if target_attr == "solo":
            filtered = [a for a in filtered if a.solo_album_count > 0]
        elif target_attr == "combined":
            filtered = [a for a in filtered if a.combined_album_count > 0]

    # Sorting
    is_reverse = actual_order.lower() == "desc"
    if actual_sort == "hype_velocity":
        filtered.sort(
            key=lambda a: (a.hype_velocity, a.hype_index, a.created_at.timestamp(), a.artist_id),
            reverse=is_reverse,
        )
    elif actual_sort in ("submissions", "submission_count"):
        filtered.sort(
            key=lambda a: (a.submission_count, a.score, a.hype_index, a.artist_id),
            reverse=is_reverse,
        )
    elif actual_sort == "created_at":
        filtered.sort(
            key=lambda a: (a.created_at.timestamp(), a.hype_index, a.artist_id),
            reverse=is_reverse,
        )
    elif actual_sort == "album_count":
        filtered.sort(
            key=lambda a: (a.album_count, a.release_count, a.hype_index, a.artist_id),
            reverse=is_reverse,
        )
    elif actual_sort == "release_count":
        filtered.sort(
            key=lambda a: (a.release_count, a.album_count, a.hype_index, a.artist_id),
            reverse=is_reverse,
        )
    elif actual_sort in ("name", "artist_name"):
        filtered.sort(
            key=lambda a: (a.name.lower(), a.artist_id),
            reverse=is_reverse,
        )
    else:  # default "hype_index"
        filtered.sort(
            key=lambda a: (a.hype_index, a.hype_velocity, a.created_at.timestamp(), a.artist_id),
            reverse=is_reverse,
        )

    total_items = len(filtered)
    total_pages = max(1, math.ceil(total_items / page_size)) if total_items > 0 else 1
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    items = filtered[start_idx:end_idx]

    return PaginatedArtistsResponse(
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        total_items=total_items,
        items=items,
    )


def get_directory_retailers(session: Session) -> list[str]:
    """Return distinct non-null, non-empty retailer names sorted alphabetically."""
    rows = session.execute(
        text(
            """
            SELECT DISTINCT retailer_name
            FROM releases
            WHERE retailer_name IS NOT NULL AND TRIM(retailer_name) != ''
            ORDER BY retailer_name ASC
            """
        )
    ).fetchall()
    return [r.retailer_name for r in rows if r.retailer_name and r.retailer_name.strip()]


def get_directory_counts(session: Session) -> DirectoryCountsResponse:
    """Return total catalog entity counts for live tab badges."""
    rel_count = session.execute(text("SELECT COUNT(*) FROM releases")).scalar() or 0
    art_count = session.execute(text("SELECT COUNT(*) FROM artists")).scalar() or 0
    alb_count = session.execute(text("SELECT COUNT(*) FROM albums")).scalar() or 0

    return DirectoryCountsResponse(
        releases=int(rel_count),
        albums=int(alb_count),
        artists=int(art_count),
    )


__all__ = [
    "get_directory_albums",
    "get_directory_artists",
    "get_directory_counts",
    "get_directory_releases",
    "get_directory_retailers",
]
