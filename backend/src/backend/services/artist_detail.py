"""Artist Detail Domain Service.

Provides compound entity resolution for Artist Detail view, including
catalog footprint, solo vs combined billing attributions, 4-cell hero KPIs,
tracked albums matrix, and child releases discography ledger.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

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
from backend.services.catalog import (
    classify_artist_attribution,
    derive_album_id,
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


def get_artist_detail(
    session: Session,
    artist_id: str | uuid.UUID,
    window: WindowType = DEFAULT_WINDOW,
    now: datetime | None = None,
) -> ArtistDetailResponse | None:
    """Compute and construct compound ArtistDetailResponse for an artist_id."""
    if isinstance(artist_id, str):
        try:
            art_uuid = uuid.UUID(artist_id)
        except ValueError:
            return None
    else:
        art_uuid = artist_id

    art_id_str = str(art_uuid)

    if window not in WINDOW_CONFIG:
        window = DEFAULT_WINDOW

    if now is None:
        now = datetime.now(timezone.utc)

    spec = WINDOW_CONFIG[window]
    t0 = now - timedelta(hours=spec.duration_hours)

    # 1. Fetch artist
    artist_row = session.execute(
        text("SELECT id, name, created_at FROM artists WHERE id = :artist_id"),
        {"artist_id": art_uuid},
    ).fetchone()

    if artist_row is None:
        return None

    artist_name = artist_row.name

    # 2. Fetch all releases ordered by created_at ASC, id ASC for deterministic album display casing
    release_sql = text(
        r"""
        SELECT
            r.id,
            r.combined_artist,
            r.album_title,
            r.variant,
            r.retailer_name,
            r.created_at,
            LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(r.combined_artist, '[\u2010-\u2015\u2212]', '-', 'g'), '\s+', ' ', 'g'))) AS norm_artist,
            LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(r.album_title, '[\u2010-\u2015\u2212]', '-', 'g'), '\s+', ' ', 'g'))) AS norm_album
        FROM releases r
        ORDER BY r.created_at ASC, r.id ASC
        """
    )
    releases_rows = session.execute(release_sql).fetchall()

    # Map releases and albums across catalog
    albums_dict: dict[str, dict[str, Any]] = {}
    releases_by_id: dict[str, Any] = {}
    for r in releases_rows:
        r_str = str(r.id)
        releases_by_id[r_str] = r
        alb_id = derive_album_id(r.norm_artist, r.norm_album)

        if alb_id not in albums_dict:
            albums_dict[alb_id] = {
                "album_id": alb_id,
                "album_title": r.album_title,
                "combined_artist": r.combined_artist,
                "release_count": 1,
                "earliest_created_at": r.created_at,
                "release_ids": [r_str],
            }
        else:
            albums_dict[alb_id]["release_count"] += 1
            albums_dict[alb_id]["release_ids"].append(r_str)

    # 3. Fetch artist-release links across catalog
    artist_links_sql = text(
        """
        SELECT
            ra.release_id,
            ra.artist_id,
            a.name AS artist_name
        FROM release_artists ra
        JOIN artists a ON ra.artist_id = a.id
        """
    )
    artist_links = session.execute(artist_links_sql).fetchall()

    artists_by_rel: dict[str, list[dict[str, Any]]] = defaultdict(list)
    releases_by_artist: dict[str, set[str]] = defaultdict(set)

    for al in artist_links:
        r_id = str(al.release_id)
        a_id = str(al.artist_id)
        artists_by_rel[r_id].append({"artist_id": a_id, "name": al.artist_name})
        releases_by_artist[a_id].add(r_id)

    target_release_ids = releases_by_artist.get(art_id_str, set())
    if not target_release_ids:
        target_releases = []
    else:
        target_releases = [releases_by_id[r_id] for r_id in target_release_ids if r_id in releases_by_id]

    # 4. Fetch linked submissions where is_release = TRUE
    sub_sql = text(
        """
        SELECT
            sr.release_id,
            s.id AS submission_id,
            s.reddit_id,
            s.title,
            s.url,
            s.created_utc,
            s.latest_score,
            s.latest_num_comments,
            s.latest_upvote_ratio
        FROM submission_releases sr
        JOIN submissions s ON sr.submission_id = s.id
        WHERE s.is_release = TRUE
        """
    )
    sub_rows = session.execute(sub_sql).fetchall()

    # 5. Fetch snapshots
    snap_sql = text(
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
    snap_rows = session.execute(snap_sql).fetchall()

    snapshots_by_sub: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for sn in snap_rows:
        snapshots_by_sub[sn.submission_id].append(
            {
                "captured_at": sn.captured_at,
                "score": sn.score,
                "num_comments": sn.num_comments,
            }
        )

    # Compute submission metrics
    submission_metrics: dict[str, dict[str, Any]] = {}
    release_submissions: dict[str, set[str]] = defaultdict(set)
    submissions_by_id: dict[str, dict[str, Any]] = {}

    for row in sub_rows:
        s_id = row.submission_id
        r_id = str(row.release_id)
        release_submissions[r_id].add(s_id)

        submissions_by_id[s_id] = {
            "id": s_id,
            "reddit_id": row.reddit_id,
            "title": row.title,
            "url": row.url,
            "created_utc": row.created_utc,
            "latest_score": row.latest_score,
            "latest_num_comments": row.latest_num_comments,
            "latest_upvote_ratio": row.latest_upvote_ratio,
        }

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

    # Compute cohort raw hypes
    album_raw_hypes: dict[str, float] = {}
    for alb_id, alb_data in albums_dict.items():
        cohort_alb_subs: set[str] = set()
        for r_id in alb_data["release_ids"]:
            cohort_alb_subs.update(release_submissions.get(r_id, set()))
        album_raw_hypes[alb_id] = sum(submission_metrics[s]["raw_hype"] for s in cohort_alb_subs)

    release_raw_hypes: dict[str, float] = {}
    for r in releases_rows:
        r_id = str(r.id)
        linked_subs = release_submissions.get(r_id, set())
        release_raw_hypes[r_id] = sum(submission_metrics[s]["raw_hype"] for s in linked_subs)

    artist_raw_hypes: dict[str, float] = {}
    for a_id, a_rel_ids in releases_by_artist.items():
        art_subs: set[str] = set()
        for r_id in a_rel_ids:
            art_subs.update(release_submissions.get(r_id, set()))
        artist_raw_hypes[a_id] = sum(submission_metrics[s]["raw_hype"] for s in art_subs)

    cohort_max_artist = max(artist_raw_hypes.values()) if artist_raw_hypes else 0.0
    cohort_max_album = max(album_raw_hypes.values()) if album_raw_hypes else 0.0
    cohort_max_release = max(release_raw_hypes.values()) if release_raw_hypes else 0.0

    # 6. Target artist calculations
    target_all_subs: set[str] = set()
    for r_id in target_release_ids:
        target_all_subs.update(release_submissions.get(r_id, set()))

    target_subs_list = [submissions_by_id[s_id] for s_id in target_all_subs]
    target_artist_raw = artist_raw_hypes.get(art_id_str, 0.0)
    target_artist_hype_index = calculate_hype_index(target_artist_raw, cohort_max_artist, REFERENCE_FLOOR)
    target_artist_tier = get_hype_tier(target_artist_hype_index)
    target_artist_velocity = round(sum(submission_metrics[s]["velocity"] for s in target_all_subs), 1)

    if target_subs_list:
        last_seen_at = max(s["created_utc"] for s in target_subs_list)
        total_score = sum(s["latest_score"] for s in target_subs_list)
        total_comments = sum(s["latest_num_comments"] for s in target_subs_list)
        points_gain = sum(submission_metrics[s["id"]]["delta_e"] for s in target_subs_list)
    else:
        earliest_rel_time = min((r.created_at for r in target_releases), default=artist_row.created_at)
        last_seen_at = earliest_rel_time
        total_score = 0
        total_comments = 0
        points_gain = 0

    # 7. Group artist releases into derived albums & classify Solo vs Combined
    target_albums_map: dict[str, dict[str, Any]] = {}
    for r in target_releases:
        alb_id = derive_album_id(r.norm_artist, r.norm_album)
        is_solo = (
            classify_artist_attribution(
                artist_name=artist_name,
                combined_artist=r.combined_artist,
                linked_artist_count=len(artists_by_rel.get(str(r.id), [])),
            )
            == "solo"
        )

        if alb_id not in target_albums_map:
            target_albums_map[alb_id] = {
                "album_id": alb_id,
                "album_title": albums_dict[alb_id]["album_title"],
                "combined_artist": albums_dict[alb_id]["combined_artist"],
                "release_count": 0,
                "has_solo": is_solo,
                "releases": [],
            }
        target_albums_map[alb_id]["release_count"] += 1
        target_albums_map[alb_id]["releases"].append(r)
        if is_solo:
            target_albums_map[alb_id]["has_solo"] = True

    solo_count = sum(1 for a in target_albums_map.values() if a["has_solo"])
    combined_count = len(target_albums_map) - solo_count
    total_albums = len(target_albums_map)
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

    # 8. Build Tracked Albums matrix
    tracked_albums: list[TrackedAlbumRow] = []
    for alb_id, alb_info in target_albums_map.items():
        # Album submissions across all child releases of that album
        parent_release_ids = albums_dict[alb_id]["release_ids"]
        alb_sub_ids: set[str] = set()
        for r_id in parent_release_ids:
            alb_sub_ids.update(release_submissions.get(r_id, set()))

        alb_sub_objects = [submissions_by_id[s_id] for s_id in alb_sub_ids]
        alb_score = sum(s["latest_score"] for s in alb_sub_objects)
        alb_comments = sum(s["latest_num_comments"] for s in alb_sub_objects)
        alb_velocity = round(sum(submission_metrics[s]["velocity"] for s in alb_sub_ids), 1)
        alb_raw = album_raw_hypes.get(alb_id, 0.0)
        alb_hype_index = calculate_hype_index(alb_raw, cohort_max_album, REFERENCE_FLOOR)
        alb_tier = get_hype_tier(alb_hype_index)

        if alb_sub_objects:
            alb_first_seen: datetime | None = min(s["created_utc"] for s in alb_sub_objects)
            alb_last_seen: datetime | None = max(s["created_utc"] for s in alb_sub_objects)
        else:
            alb_first_seen = albums_dict[alb_id]["earliest_created_at"]
            alb_last_seen = albums_dict[alb_id]["earliest_created_at"]

        attribution = "Solo" if alb_info["has_solo"] else f"Combined: {alb_info['combined_artist']}"

        tracked_albums.append(
            TrackedAlbumRow(
                album_id=alb_id,
                album_title=alb_info["album_title"],
                combined_artist=alb_info["combined_artist"],
                billing_attribution=attribution,
                release_count=albums_dict[alb_id]["release_count"],
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
    tracked_albums.sort(key=lambda a: (a.hype_index, a.hype_velocity, a.release_count), reverse=True)

    # 9. Build Child Releases discography ledger
    child_releases: list[ChildReleaseLedgerRow] = []
    for r in target_releases:
        r_id = str(r.id)
        alb_id = derive_album_id(r.norm_artist, r.norm_album)
        rel_sub_ids = release_submissions.get(r_id, set())
        rel_subs = [submissions_by_id[s_id] for s_id in rel_sub_ids]

        rel_score = sum(s["latest_score"] for s in rel_subs)
        rel_comments = sum(s["latest_num_comments"] for s in rel_subs)
        rel_velocity = round(sum(submission_metrics[s]["velocity"] for s in rel_sub_ids), 1)
        rel_raw = release_raw_hypes.get(r_id, 0.0)
        rel_hype_index = calculate_hype_index(rel_raw, cohort_max_release, REFERENCE_FLOOR)
        rel_tier = get_hype_tier(rel_hype_index)

        if rel_subs:
            rel_first_seen = min(s["created_utc"] for s in rel_subs)
            rel_last_seen = max(s["created_utc"] for s in rel_subs)
        else:
            rel_first_seen = r.created_at
            rel_last_seen = r.created_at

        child_releases.append(
            ChildReleaseLedgerRow(
                release_id=r_id,
                album_id=alb_id,
                album_title=albums_dict[alb_id]["album_title"],
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

    # Sort child releases by hype_index DESC, hype_velocity DESC, created_at DESC
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
