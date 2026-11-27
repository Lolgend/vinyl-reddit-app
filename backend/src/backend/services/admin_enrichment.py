"""Read-only Enrichment Queue classification and failed-album inspection service."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import NamedTuple

from reddit_scrape.models import Album
from sqlalchemy import select
from sqlalchemy.orm import Session, load_only

from backend.schemas.admin import (
    EnrichmentQueueStatus,
    FailedEnrichmentItem,
    FailedEnrichmentState,
)
from backend.services.admin_common import ensure_utc

MAX_ENRICHMENT_ATTEMPTS = 5
MAX_FAILED_ITEMS = 25
BASE_BACKOFF_MINUTES = 5
PARTIAL_RECHECK_INTERVAL = timedelta(days=7)
PARTIAL_MAX_AGE = timedelta(days=60)

_FAILED_STATE_PRIORITY: dict[FailedEnrichmentState, int] = {
    "exhausted": 0,
    "due": 1,
    "backoff": 2,
}


class _FailedCandidate(NamedTuple):
    item: FailedEnrichmentItem
    created_at: datetime | None


def _failed_item_sort_key(
    candidate: _FailedCandidate,
) -> tuple[int, tuple[int, float], tuple[int, float], str]:
    """Prioritize exhausted -> due -> backoff, then last_enriched_at DESC NULLS FIRST, created_at ASC, album_id ASC."""
    item = candidate.item
    last_enriched_key = (
        (0, 0.0) if item.last_enriched_at is None else (1, -item.last_enriched_at.timestamp())
    )
    created_key = (
        (0, candidate.created_at.timestamp()) if candidate.created_at is not None else (1, 0.0)
    )
    return (
        _FAILED_STATE_PRIORITY[item.state],
        last_enriched_key,
        created_key,
        item.album_id,
    )


def _backoff_duration(attempts: int) -> timedelta:
    """Match scraper SQL backoff: interval '5 minutes' * power(2, enrichment_attempts - 1)."""
    return timedelta(minutes=BASE_BACKOFF_MINUTES * (2 ** (attempts - 1)))


def get_enrichment_queue_status(
    session: Session,
    now: datetime | None = None,
) -> EnrichmentQueueStatus:
    """Compute live Enrichment Queue counts, backoff states, and top 25 failed albums."""
    now_utc = ensure_utc(now) or datetime.now(timezone.utc)
    partial_recheck_cutoff = now_utc - PARTIAL_RECHECK_INTERVAL
    partial_age_cutoff = now_utc - PARTIAL_MAX_AGE

    stmt = select(Album).options(
        load_only(
            Album.id,
            Album.combined_artist,
            Album.title,
            Album.discogs_status,
            Album.enrichment_attempts,
            Album.last_enriched_at,
            Album.enrichment_error,
            Album.created_at,
        )
    )
    albums = list(session.execute(stmt).scalars().all())

    pending = 0
    matched = 0
    partial_matched = 0
    partial_matched_due = 0
    not_found = 0
    failed_due = 0
    failed_backoff = 0
    failed_exhausted = 0

    failed_candidates: list[_FailedCandidate] = []

    for album in albums:
        status = album.discogs_status
        last_enriched_utc = ensure_utc(album.last_enriched_at)
        created_utc = ensure_utc(album.created_at)

        if status == "pending":
            pending += 1
        elif status == "matched":
            matched += 1
        elif status == "not_found":
            not_found += 1
        elif status == "partial_matched":
            partial_matched += 1
            recheck_elapsed = (
                last_enriched_utc is None or last_enriched_utc <= partial_recheck_cutoff
            )
            within_age_window = created_utc is not None and created_utc >= partial_age_cutoff
            if recheck_elapsed and within_age_window:
                partial_matched_due += 1
        elif status == "failed":
            attempts = album.enrichment_attempts or 0
            state: FailedEnrichmentState
            next_retry_at: datetime | None

            if attempts >= MAX_ENRICHMENT_ATTEMPTS:
                state = "exhausted"
                next_retry_at = None
                failed_exhausted += 1
            elif last_enriched_utc is None:
                state = "due"
                next_retry_at = None
                failed_due += 1
            else:
                computed_next_retry = last_enriched_utc + _backoff_duration(attempts)
                next_retry_at = computed_next_retry
                if computed_next_retry <= now_utc:
                    state = "due"
                    failed_due += 1
                else:
                    state = "backoff"
                    failed_backoff += 1

            item = FailedEnrichmentItem(
                album_id=str(album.id),
                combined_artist=album.combined_artist,
                album_title=album.title,
                enrichment_attempts=attempts,
                max_attempts=MAX_ENRICHMENT_ATTEMPTS,
                enrichment_error=album.enrichment_error,
                last_enriched_at=last_enriched_utc,
                next_retry_at=next_retry_at,
                state=state,
            )
            failed_candidates.append(_FailedCandidate(item=item, created_at=created_utc))

    failed_candidates.sort(key=_failed_item_sort_key)
    failed_items = [candidate.item for candidate in failed_candidates[:MAX_FAILED_ITEMS]]

    failed_total = failed_due + failed_backoff + failed_exhausted
    total = pending + matched + partial_matched + not_found + failed_total
    resolved_pct = (
        round(((matched + partial_matched + not_found) / total) * 100.0, 1) if total > 0 else 0.0
    )

    return EnrichmentQueueStatus(
        pending=pending,
        matched=matched,
        partial_matched=partial_matched,
        partial_matched_due=partial_matched_due,
        not_found=not_found,
        failed_due=failed_due,
        failed_backoff=failed_backoff,
        failed_exhausted=failed_exhausted,
        failed_total=failed_total,
        total=total,
        resolved_pct=resolved_pct,
        failed_items=failed_items,
    )
