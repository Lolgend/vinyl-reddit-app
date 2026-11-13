"""Artist Detail Domain Service.

Provides compound entity resolution for Artist Detail view across the 3-tier
schema, including catalog footprint, solo vs combined billing attributions,
4-cell hero KPIs, tracked albums matrix, and child releases discography ledger.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.schemas.artist import (
    ArtistDetailResponse,
    ArtistHeroKPI,
    ArtistIdentity,
    ArtistRedditDemand,
    CatalogFootprint,
    ChildReleaseLedgerRow,
    TrackedAlbumRow,
)
from backend.services.catalog import classify_artist_attribution
from backend.services.hype import (
    DEFAULT_WINDOW,
    REFERENCE_FLOOR,
    WINDOW_CONFIG,
    WindowType,
    calculate_hype_index,
    fetch_submissions_and_metrics,
    get_hype_tier,
)


def get_artist_detail(
    session: Session,
    artist_id: str | uuid.UUID,
    window: WindowType = DEFAULT_WINDOW,
    now: datetime | None = None,
) -> ArtistDetailResponse | None:
    """Compute and construct compound ArtistDetailResponse for a canonical artist_id.

    Pre-validates artist_id as a UUID. Returns None if invalid or not found.
    """
    if isinstance(artist_id, str):
        try:
            art_uuid = uuid.UUID(artist_id)
        except (ValueError, AttributeError):
            return None
    elif isinstance(artist_id, uuid.UUID):
        art_uuid = artist_id
    else:
        return None

    art_id_str = str(art_uuid)

    if window not in WINDOW_CONFIG:
        window = DEFAULT_WINDOW

    if now is None:
        now = datetime.now(timezone.utc)

    # 1. Fetch artist directly from artists table
    artist_row = session.execute(
        text("SELECT id, name, created_at FROM artists WHERE id = :artist_id"),
        {"artist_id": art_uuid},
    ).fetchone()

    if artist_row is None:
        return None

    artist_name = artist_row.name

    # 2. Fetch tracked albums linked to this artist via album_artists
    tracked_album_rows = session.execute(
        text(
            """
            SELECT
                a.id AS album_id,
                a.title AS album_title,
                a.combined_artist,
                a.created_at AS album_created_at,
                (SELECT COUNT(*) FROM album_artists aa2 WHERE aa2.album_id = a.id) AS linked_artist_count
            FROM albums a
            JOIN album_artists aa ON a.id = aa.album_id
            WHERE aa.artist_id = :artist_id
            ORDER BY a.created_at ASC, a.id ASC
            """
        ),
        {"artist_id": art_uuid},
    ).fetchall()

    target_album_ids = [row.album_id for row in tracked_album_rows]
    target_album_id_strs = {str(aid) for aid in target_album_ids}

    # 3. Fetch child releases belonging to those tracked albums
    if target_album_ids:
        releases_query = text(
            """
            SELECT
                r.id AS release_id,
                r.album_id,
                r.variant,
                r.retailer_name,
                r.created_at AS release_created_at,
                a.title AS album_title,
                a.combined_artist
            FROM releases r
            JOIN albums a ON r.album_id = a.id
            WHERE r.album_id = ANY(:album_ids)
            ORDER BY r.created_at ASC, r.id ASC
            """
        )
        target_releases = session.execute(
            releases_query,
            {"album_ids": target_album_ids},
        ).fetchall()
    else:
        target_releases = []

    # 4. Fetch all catalog releases and album_artists links for cohort scaling
    all_releases_rows = session.execute(
        text("SELECT id, album_id FROM releases ORDER BY created_at ASC, id ASC")
    ).fetchall()

    all_album_artists_rows = session.execute(
        text("SELECT album_id, artist_id FROM album_artists")
    ).fetchall()

    # 5. Fetch linked submissions and compute metrics via shared helper
    cohort = fetch_submissions_and_metrics(session=session, window=window, now=now)
    submission_metrics = cohort.submission_metrics
    release_submissions = cohort.release_submissions
    submissions_by_id = cohort.submissions_by_id

    # Map releases by album
    album_releases_map: dict[str, list[str]] = defaultdict(list)
    for r in all_releases_rows:
        album_releases_map[str(r.album_id)].append(str(r.id))

    # Map albums by artist
    artist_albums_map: dict[str, set[str]] = defaultdict(set)
    for aa in all_album_artists_rows:
        artist_albums_map[str(aa.artist_id)].add(str(aa.album_id))

    # Compute cohort raw hypes
    album_subs_map: dict[str, set[str]] = {}
    album_raw_hypes: dict[str, float] = {}
    for alb_id_str, rel_ids in album_releases_map.items():
        alb_subs: set[str] = set()
        for rel_id in rel_ids:
            alb_subs.update(release_submissions.get(rel_id, set()))
        album_subs_map[alb_id_str] = alb_subs
        album_raw_hypes[alb_id_str] = sum(submission_metrics[s]["raw_hype"] for s in alb_subs)

    release_raw_hypes: dict[str, float] = {}
    for r in all_releases_rows:
        r_id = str(r.id)
        linked_subs = release_submissions.get(r_id, set())
        release_raw_hypes[r_id] = sum(submission_metrics[s]["raw_hype"] for s in linked_subs)

    artist_raw_hypes: dict[str, float] = {}
    for a_id, alb_ids in artist_albums_map.items():
        art_subs: set[str] = set()
        for alb_id in alb_ids:
            art_subs.update(album_subs_map.get(alb_id, set()))
        artist_raw_hypes[a_id] = sum(submission_metrics[s]["raw_hype"] for s in art_subs)

    cohort_max_artist = max(artist_raw_hypes.values()) if artist_raw_hypes else 0.0
    cohort_max_album = max(album_raw_hypes.values()) if album_raw_hypes else 0.0
    cohort_max_release = max(release_raw_hypes.values()) if release_raw_hypes else 0.0

    # 7. Target artist calculations
    target_all_subs: set[str] = set()
    for alb_id_str in target_album_id_strs:
        target_all_subs.update(album_subs_map.get(alb_id_str, set()))

    target_subs_list = [submissions_by_id[s_id] for s_id in target_all_subs]
    target_artist_raw = artist_raw_hypes.get(art_id_str, 0.0)
    target_artist_hype_index = calculate_hype_index(
        target_artist_raw, cohort_max_artist, REFERENCE_FLOOR
    )
    target_artist_tier = get_hype_tier(target_artist_hype_index)
    target_artist_velocity = round(
        sum(submission_metrics[s]["velocity"] for s in target_all_subs), 1
    )

    if target_subs_list:
        last_seen_at = max(s["created_utc"] for s in target_subs_list)
        total_score = sum(s["latest_score"] for s in target_subs_list)
        total_comments = sum(s["latest_num_comments"] for s in target_subs_list)
        points_gain = sum(submission_metrics[s["id"]]["delta_e"] for s in target_subs_list)
    else:
        earliest_rel_time = min(
            (r.release_created_at for r in target_releases),
            default=artist_row.created_at,
        )
        last_seen_at = earliest_rel_time
        total_score = 0
        total_comments = 0
        points_gain = 0

    # 8. Build Tracked Albums matrix & Classify Solo vs Combined
    tracked_albums: list[TrackedAlbumRow] = []
    solo_count = 0
    combined_count = 0

    for alb_row in tracked_album_rows:
        alb_id_str = str(alb_row.album_id)
        attribution = classify_artist_attribution(
            artist_name=artist_name,
            combined_artist=alb_row.combined_artist,
            linked_artist_count=int(alb_row.linked_artist_count),
        )
        is_solo = attribution == "solo"
        if is_solo:
            solo_count += 1
            billing_attribution = "Solo"
        else:
            combined_count += 1
            billing_attribution = f"Combined: {alb_row.combined_artist}"

        alb_rel_ids = album_releases_map.get(alb_id_str, [])
        alb_sub_ids = album_subs_map.get(alb_id_str, set())
        alb_sub_objects = [submissions_by_id[s_id] for s_id in alb_sub_ids]
        alb_score = sum(s["latest_score"] for s in alb_sub_objects)
        alb_comments = sum(s["latest_num_comments"] for s in alb_sub_objects)
        alb_velocity = round(sum(submission_metrics[s]["velocity"] for s in alb_sub_ids), 1)
        alb_raw = album_raw_hypes.get(alb_id_str, 0.0)
        alb_hype_index = calculate_hype_index(alb_raw, cohort_max_album, REFERENCE_FLOOR)
        alb_tier = get_hype_tier(alb_hype_index)

        if alb_sub_objects:
            alb_first_seen: datetime | None = min(s["created_utc"] for s in alb_sub_objects)
            alb_last_seen: datetime | None = max(s["created_utc"] for s in alb_sub_objects)
        else:
            alb_first_seen = alb_row.album_created_at
            alb_last_seen = alb_row.album_created_at

        tracked_albums.append(
            TrackedAlbumRow(
                album_id=alb_id_str,
                album_title=alb_row.album_title,
                combined_artist=alb_row.combined_artist,
                billing_attribution=billing_attribution,
                release_count=len(alb_rel_ids),
                submission_count=len(alb_sub_objects),
                score=alb_score,
                num_comments=alb_comments,
                hype_velocity=alb_velocity,
                hype_index=alb_hype_index,
                tier=alb_tier,
                first_seen_at=alb_first_seen,
                last_seen_at=alb_last_seen,
            )
        )

    # Sort tracked albums by hype_index DESC, hype_velocity DESC, release_count DESC
    tracked_albums.sort(
        key=lambda a: (a.hype_index, a.hype_velocity, a.release_count), reverse=True
    )

    total_albums = len(tracked_album_rows)
    total_releases = len(target_releases)

    catalog_footprint = CatalogFootprint(
        total_albums=total_albums,
        solo_album_count=solo_count,
        combined_album_count=combined_count,
        total_releases=total_releases,
    )

    reddit_demand = ArtistRedditDemand(
        total_submissions=len(target_subs_list),
        submission_count=len(target_subs_list),
        total_score=total_score,
        total_comments=total_comments,
        points_gain=points_gain,
        last_seen=last_seen_at,
        last_seen_at=last_seen_at,
    )

    hero_kpi = ArtistHeroKPI(
        hype_index=target_artist_hype_index,
        tier=target_artist_tier,
        hype_velocity=target_artist_velocity,
        catalog_footprint=catalog_footprint,
        reddit_demand=reddit_demand,
        total_albums=total_albums,
        solo_album_count=solo_count,
        combined_album_count=combined_count,
        total_releases=total_releases,
        submission_count=len(target_subs_list),
        total_score=total_score,
        total_comments=total_comments,
        points_gain=points_gain,
        last_seen_at=last_seen_at,
    )

    # 9. Build Child Releases discography ledger
    child_releases: list[ChildReleaseLedgerRow] = []
    for r in target_releases:
        rel_id_str = str(r.release_id)
        alb_id_str = str(r.album_id)
        rel_sub_ids = release_submissions.get(rel_id_str, set())
        rel_subs = [submissions_by_id[s_id] for s_id in rel_sub_ids]

        rel_score = sum(s["latest_score"] for s in rel_subs)
        rel_comments = sum(s["latest_num_comments"] for s in rel_subs)
        rel_velocity = round(sum(submission_metrics[s]["velocity"] for s in rel_sub_ids), 1)
        rel_raw = release_raw_hypes.get(rel_id_str, 0.0)
        rel_hype_index = calculate_hype_index(rel_raw, cohort_max_release, REFERENCE_FLOOR)
        rel_tier = get_hype_tier(rel_hype_index)

        if rel_subs:
            rel_first_seen = min(s["created_utc"] for s in rel_subs)
            rel_last_seen = max(s["created_utc"] for s in rel_subs)
        else:
            rel_first_seen = r.release_created_at
            rel_last_seen = r.release_created_at

        child_releases.append(
            ChildReleaseLedgerRow(
                release_id=rel_id_str,
                album_id=alb_id_str,
                album_title=r.album_title,
                combined_artist=r.combined_artist,
                variant=r.variant,
                retailer_name=r.retailer_name,
                submission_count=len(rel_subs),
                score=rel_score,
                num_comments=rel_comments,
                hype_velocity=rel_velocity,
                hype_index=rel_hype_index,
                tier=rel_tier,
                first_seen_at=rel_first_seen,
                last_seen_at=rel_last_seen,
            )
        )

    # Sort child releases by hype_index DESC, hype_velocity DESC
    child_releases.sort(key=lambda cr: (cr.hype_index, cr.hype_velocity), reverse=True)

    artist_identity = ArtistIdentity(
        artist_id=art_id_str,
        name=artist_name,
        monogram_key=art_id_str,
        last_seen_at=last_seen_at,
    )

    return ArtistDetailResponse(
        artist_id=art_id_str,
        name=artist_name,
        monogram_key=art_id_str,
        last_seen_at=last_seen_at,
        window=window,
        artist=artist_identity,
        hero_kpi=hero_kpi,
        tracked_albums=tracked_albums,
        child_releases=child_releases,
    )


__all__ = ["get_artist_detail"]
