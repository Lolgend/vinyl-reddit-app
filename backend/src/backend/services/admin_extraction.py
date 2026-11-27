"""Read-only Extraction Queue metrics and pending submission inspector queries."""

from __future__ import annotations

from reddit_scrape.models import Submission
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.schemas.admin import ExtractionQueueStatus, PendingExtractionItem
from backend.services.admin_common import ensure_utc

PENDING_EXTRACTION_LIMIT = 25


def _count_submissions(
    session: Session,
    *,
    is_extracted: bool,
    is_release: bool,
) -> int:
    stmt = select(func.count(Submission.id)).where(
        Submission.is_extracted.is_(is_extracted),
        Submission.is_release.is_(is_release),
    )
    count = session.execute(stmt).scalar_one_or_none()
    return int(count or 0)


def get_extraction_queue_status(session: Session) -> ExtractionQueueStatus:
    """Query live Extraction Queue counts and oldest pending submissions from `submissions`."""
    pending = _count_submissions(session, is_extracted=False, is_release=True)
    extracted_releases = _count_submissions(session, is_extracted=True, is_release=True)
    filtered_non_releases = _count_submissions(session, is_extracted=True, is_release=False)

    total = pending + extracted_releases + filtered_non_releases
    completed = extracted_releases + filtered_non_releases
    completion_pct = round((completed / total) * 100.0, 1) if total > 0 else 0.0

    pending_stmt = (
        select(Submission)
        .where(
            Submission.is_extracted.is_(False),
            Submission.is_release.is_(True),
        )
        .order_by(Submission.created_utc.asc(), Submission.id.asc())
        .limit(PENDING_EXTRACTION_LIMIT)
    )
    pending_rows = list(session.execute(pending_stmt).scalars().all())

    pending_items = [
        PendingExtractionItem(
            id=row.id,
            title=row.title,
            flair=row.flair,
            url=row.url,
            created_utc=ensure_utc(row.created_utc),
            ingested_at=ensure_utc(row.created_at),
        )
        for row in pending_rows
    ]
    oldest_pending_at = pending_items[0].created_utc if pending_items else None

    return ExtractionQueueStatus(
        pending=pending,
        extracted_releases=extracted_releases,
        filtered_non_releases=filtered_non_releases,
        total=total,
        completion_pct=completion_pct,
        oldest_pending_at=oldest_pending_at,
        pending_items=pending_items,
    )
