"""Album Detail Domain Service.

Provides compound entity resolution for Album Detail view, including
identity derivations, hero KPIs, LOCF time-series buckets, submission event
markers, child pressing share-of-demand, and comparison matrix.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

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
from backend.services.catalog import derive_album_id
from backend.services.hype import (
    DEFAULT_WINDOW,
    REFERENCE_FLOOR,
    WINDOW_CONFIG,
    WindowType,
    calculate_hype_index,
    calculate_points,
    calculate_raw_hype,
    calculate_velocity,
    get_hype_tier,
)
from backend.services.timeseries import (
    calculate_share_of_demand,
    compute_locf_time_series,
    get_submission_markers,
)


def get_album_detail(
    session: Session,
    album_id: str,
    window: WindowType = DEFAULT_WINDOW,
    now: datetime | None = None,
) -> AlbumDetailResponse | None:
    """Compute and construct compound AlbumDetailResponse for a derived album_id."""
    if window not in WINDOW_CONFIG:
        window = DEFAULT_WINDOW

    if now is None:
        now = datetime.now(timezone.utc)

    spec = WINDOW_CONFIG[window]
    t0 = now - timedelta(hours=spec.duration_hours)

    # 1. Fetch all releases ordered by created_at ASC, id ASC for deterministic album display casing
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

    # Group releases into derived albums
    albums_dict: dict[str, dict[str, Any]] = {}
    target_album: dict[str, Any] | None = None

    for r in releases_rows:
        rel_id = str(r.id)
        alb_id = derive_album_id(r.norm_artist, r.norm_album)

        if alb_id not in albums_dict:
            albums_dict[alb_id] = {
                "album_id": alb_id,
                "album_title": r.album_title,
                "combined_artist": r.combined_artist,
                "release_count": 1,
                "earliest_created_at": r.created_at,
                "release_ids": [rel_id],
                "releases": [r],
            }
        else:
            albums_dict[alb_id]["release_count"] += 1
            albums_dict[alb_id]["release_ids"].append(rel_id)
            albums_dict[alb_id]["releases"].append(r)

    if album_id not in albums_dict:
        return None

    target_album = albums_dict[album_id]

    # 2. Fetch linked submissions where is_release = TRUE
    sub_sql = text(
        """
        SELECT
            sr.release_id,
            s.id AS submission_id,
            s.title,
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

    # 3. Fetch snapshots for release submissions
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

    # Group snapshots by submission_id
    snapshots_by_sub: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for sn in snap_rows:
        snapshots_by_sub[sn.submission_id].append(
            {
                "captured_at": sn.captured_at,
                "score": sn.score,
                "num_comments": sn.num_comments,
            }
        )

    # 4. Fetch artist links
    artist_sql = text(
        """
        SELECT
            ra.release_id,
            a.id AS artist_id,
            a.name AS artist_name
        FROM release_artists ra
        JOIN artists a ON ra.artist_id = a.id
        """
    )
    artist_rows = session.execute(artist_sql).fetchall()
    artists_by_release: dict[str, list[ArtistRef]] = defaultdict(list)
    for ar in artist_rows:
        artists_by_release[str(ar.release_id)].append(
            ArtistRef(artist_id=str(ar.artist_id), name=ar.artist_name)
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
            "title": row.title,
            "created_utc": row.created_utc,
            "latest_score": row.latest_score,
            "latest_num_comments": row.latest_num_comments,
            "latest_upvote_ratio": row.latest_upvote_ratio,
        }

        if s_id in submission_metrics:
            continue

        s_created_utc = row.created_utc
        snaps = snapshots_by_sub.get(s_id, [])

        # Baseline Anchor (E_base, t_base)
        if s_created_utc >= t0:
            e_base = 0
            t_base = s_created_utc
        else:
            snaps_before_t0 = [sn for sn in snaps if sn["captured_at"] <= t0]
            if snaps_before_t0:
                anchor_snap = snaps_before_t0[-1]
                e_base = calculate_points(anchor_snap["score"], anchor_snap["num_comments"])
                t_base = anchor_snap["captured_at"]
            else:
                snaps_in_window = [sn for sn in snaps if sn["captured_at"] > t0]
                if snaps_in_window:
                    anchor_snap = snaps_in_window[0]
                    e_base = calculate_points(anchor_snap["score"], anchor_snap["num_comments"])
                    t_base = anchor_snap["captured_at"]
                else:
                    e_base = calculate_points(row.latest_score, row.latest_num_comments)
                    t_base = s_created_utc

        # Current state (E_curr)
        if snaps:
            latest_snap = snaps[-1]
            e_curr = calculate_points(latest_snap["score"], latest_snap["num_comments"])
        else:
            e_curr = calculate_points(row.latest_score, row.latest_num_comments)

        delta_e = max(0, e_curr - e_base)
        v_s = calculate_velocity(delta_e, t_base, now)
        h_s = calculate_raw_hype(
            velocity=v_s,
            delta_e=delta_e,
            created_utc=s_created_utc,
            upvote_ratio=row.latest_upvote_ratio,
            window=window,
            now=now,
        )

        submission_metrics[s_id] = {
            "velocity": v_s,
            "delta_e": delta_e,
            "raw_hype": h_s,
            "created_utc": s_created_utc,
            "score": row.latest_score,
            "num_comments": row.latest_num_comments,
        }

    # Compute raw hypes across all albums and releases for cohort scaling
    album_raw_hypes: list[float] = []
    release_raw_hypes: dict[str, float] = {}

    for alb in albums_dict.values():
        union_subs: set[str] = set()
        for r_id in alb["release_ids"]:
            union_subs.update(release_submissions.get(r_id, set()))

        alb_velocity = round(sum(submission_metrics[s]["velocity"] for s in union_subs), 1)
        alb_raw_hype = sum(submission_metrics[s]["raw_hype"] for s in union_subs)
        alb["velocity"] = alb_velocity
        alb["raw_hype"] = alb_raw_hype
        alb["union_subs"] = union_subs
        album_raw_hypes.append(alb_raw_hype)

    for r in releases_rows:
        rel_id = str(r.id)
        linked_subs = release_submissions.get(rel_id, set())
        rel_raw = sum(submission_metrics[s]["raw_hype"] for s in linked_subs)
        release_raw_hypes[rel_id] = rel_raw

    cohort_max_album = max(album_raw_hypes) if album_raw_hypes else 0.0
    cohort_max_release = max(release_raw_hypes.values()) if release_raw_hypes else 0.0

    # Target album calculation
    target_union_subs = target_album["union_subs"]
    target_album_raw_hype = target_album["raw_hype"]
    target_album_hype_index = calculate_hype_index(target_album_raw_hype, cohort_max_album, REFERENCE_FLOOR)
    target_album_tier = get_hype_tier(target_album_hype_index)
    target_album_velocity = target_album["velocity"]

    # Target album deduplicated submissions list
    target_subs_list = [submissions_by_id[s_id] for s_id in target_union_subs]

    # Dates
    if target_subs_list:
        first_seen_at = min(s["created_utc"] for s in target_subs_list)
        last_seen_at = max(s["created_utc"] for s in target_subs_list)
        total_score = sum(s["latest_score"] for s in target_subs_list)
        total_comments = sum(s["latest_num_comments"] for s in target_subs_list)
        points_gain = sum(submission_metrics[s["id"]]["delta_e"] for s in target_subs_list)
    else:
        first_seen_at = target_album["earliest_created_at"]
        last_seen_at = target_album["earliest_created_at"]
        total_score = 0
        total_comments = 0
        points_gain = 0

    # Unique artists linked to target album's releases
    seen_artists: dict[str, ArtistRef] = {}
    for r_id in target_album["release_ids"]:
        for art in artists_by_release.get(r_id, []):
            if art.artist_id not in seen_artists:
                seen_artists[art.artist_id] = art
    target_artists = list(seen_artists.values())

    # Stepped LOCF Time Series
    raw_buckets = compute_locf_time_series(
        submissions=target_subs_list,
        snapshots_by_sub=snapshots_by_sub,
        window=window,
        now=now,
    )
    time_series = [TimeSeriesBucket(**b) for b in raw_buckets]

    # Submission event markers
    raw_markers = get_submission_markers(target_subs_list, t0, now)
    submission_markers = [SubmissionMarker(**m) for m in raw_markers]

    # Target releases for share-of-demand
    target_rel_dicts = [
        {
            "release_id": str(r.id),
            "variant": r.variant,
            "retailer_name": r.retailer_name,
        }
        for r in target_album["releases"]
    ]
    subs_by_release_map: dict[str, list[dict[str, Any]]] = {}
    for r in target_album["releases"]:
        rel_id = str(r.id)
        subs_by_release_map[rel_id] = [
            submissions_by_id[s_id]
            for s_id in release_submissions.get(rel_id, set())
        ]

    raw_shares = calculate_share_of_demand(target_rel_dicts, subs_by_release_map)
    share_of_demand = [ShareOfDemandItem(**s) for s in raw_shares]
    share_pct_by_rel_id = {s["release_id"]: s["share_percentage"] for s in raw_shares}

    # Child releases comparison matrix
    child_releases: list[ChildReleaseRow] = []
    for r in target_album["releases"]:
        rel_id = str(r.id)
        rel_subs = subs_by_release_map.get(rel_id, [])
        rel_sub_ids = release_submissions.get(rel_id, set())

        rel_vel = round(sum(submission_metrics[s]["velocity"] for s in rel_sub_ids), 1)
        rel_raw = release_raw_hypes.get(rel_id, 0.0)
        rel_hype_idx = calculate_hype_index(rel_raw, cohort_max_release, REFERENCE_FLOOR)
        rel_tier = get_hype_tier(rel_hype_idx)

        rel_score = sum(s["latest_score"] for s in rel_subs)
        rel_comm = sum(s["latest_num_comments"] for s in rel_subs)

        if rel_subs:
            rel_first_seen = min(s["created_utc"] for s in rel_subs)
            rel_last_seen = max(s["created_utc"] for s in rel_subs)
        else:
            rel_first_seen = r.created_at
            rel_last_seen = r.created_at

        child_releases.append(
            ChildReleaseRow(
                release_id=rel_id,
                variant=r.variant,
                retailer_name=r.retailer_name,
                share_percentage=share_pct_by_rel_id.get(rel_id, 0.0),
                hype_velocity=rel_vel,
                hype_index=rel_hype_idx,
                tier=rel_tier,
                submission_count=len(rel_subs),
                total_score=rel_score,
                total_comments=rel_comm,
                first_seen_at=rel_first_seen,
                last_seen_at=rel_last_seen,
            )
        )

    # Sort child releases by share_percentage DESC, then hype_velocity DESC
    child_releases.sort(key=lambda cr: (cr.share_percentage, cr.hype_velocity), reverse=True)

    # Assemble Identity and Hero KPIs
    album_identity = AlbumIdentity(
        album_id=album_id,
        album_title=target_album["album_title"],
        combined_artist=target_album["combined_artist"],
        monogram_key=album_id,
        first_seen_at=first_seen_at,
        last_seen_at=last_seen_at,
        artists=target_artists,
    )

    reddit_demand = RedditDemand(
        points_gain=points_gain,
        total_score=total_score,
        total_comments=total_comments,
        submission_count=len(target_subs_list),
    )

    provenance = PressingsProvenance(
        release_count=target_album["release_count"],
        submission_count=len(target_subs_list),
        first_seen_at=first_seen_at,
        last_seen_at=last_seen_at,
    )

    hero_kpi = AlbumHeroKPI(
        hype_index=target_album_hype_index,
        tier=target_album_tier,
        hype_velocity=target_album_velocity,
        reddit_demand=reddit_demand,
        pressings_provenance=provenance,
        points_gain=points_gain,
        total_score=total_score,
        total_comments=total_comments,
        submission_count=len(target_subs_list),
        release_count=target_album["release_count"],
        first_seen_at=first_seen_at,
        last_seen_at=last_seen_at,
    )

    return AlbumDetailResponse(
        album_id=album_id,
        album_title=target_album["album_title"],
        combined_artist=target_album["combined_artist"],
        monogram_key=album_id,
        first_seen_at=first_seen_at,
        last_seen_at=last_seen_at,
        window=window,
        album=album_identity,
        hero_kpi=hero_kpi,
        time_series=time_series,
        submission_markers=submission_markers,
        share_of_demand=share_of_demand,
        child_releases=child_releases,
    )


__all__ = ["get_album_detail"]
