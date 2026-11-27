"""HTTP seam tests for Enrichment Queue on GET /api/v1/admin/pipeline (#44)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any

import psycopg.errors
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import ProgrammingError

from backend.api.admin import get_utc_now
from backend.db import get_db
from backend.main import app


def _parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


class _FakeScalarResult:
    def __init__(self, items: list[Any]) -> None:
        self._items = items

    def all(self) -> list[Any]:
        return list(self._items)


class _FakeResult:
    def __init__(
        self,
        *,
        scalar_item: Any = None,
        scalar_items: list[Any] | None = None,
    ) -> None:
        self._scalar_item = scalar_item
        self._scalar_items = scalar_items if scalar_items is not None else []

    def scalar_one_or_none(self) -> Any:
        return self._scalar_item

    def scalars(self) -> _FakeScalarResult:
        return _FakeScalarResult(self._scalar_items)


class _FakeEnrichmentSession:
    """Controlled read-only Session stub for deterministic Enrichment Queue HTTP-seam tests."""

    def __init__(
        self,
        *,
        albums: list[Any],
        process_row: Any = None,
        loop_rows: list[Any] | None = None,
        telemetry_error: Exception | None = None,
    ) -> None:
        self._albums = albums
        self._process_row = process_row
        self._loop_rows = loop_rows if loop_rows is not None else []
        self._telemetry_error = telemetry_error
        self._in_failed_tx = False
        self.rollback_calls = 0

    def execute(self, statement: Any, *args: Any, **kwargs: Any) -> _FakeResult:
        if self._in_failed_tx:
            raise ProgrammingError(
                str(statement),
                {},
                psycopg.errors.InFailedSqlTransaction(
                    "current transaction is aborted, commands ignored until end of transaction block"
                ),
            )
        sql = str(statement)
        if "pipeline_process_status" in sql:
            if self._telemetry_error is not None:
                self._in_failed_tx = True
                raise self._telemetry_error
            return _FakeResult(scalar_item=self._process_row)
        if "pipeline_loop_states" in sql:
            if self._telemetry_error is not None:
                self._in_failed_tx = True
                raise self._telemetry_error
            return _FakeResult(scalar_items=self._loop_rows)
        if "albums" in sql:
            return _FakeResult(scalar_items=self._albums)
        return _FakeResult()

    def rollback(self) -> None:
        self.rollback_calls += 1
        self._in_failed_tx = False


def _make_process_row(now: datetime) -> SimpleNamespace:
    return SimpleNamespace(
        process_name="default",
        status="running",
        run_mode="continuous",
        host="scraper-host-01",
        pid=12345,
        heartbeat_interval_seconds=30,
        started_at=now - timedelta(hours=1),
        last_heartbeat_at=now - timedelta(seconds=10),
        stopped_at=None,
    )


def _make_album(
    *,
    album_id: str | None = None,
    combined_artist: str = "Radiohead",
    title: str = "In Rainbows",
    discogs_status: str = "matched",
    enrichment_attempts: int = 0,
    last_enriched_at: datetime | None = None,
    enrichment_error: str | None = None,
    created_at: datetime | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.UUID(album_id) if album_id else uuid.uuid4(),
        combined_artist=combined_artist,
        title=title,
        discogs_status=discogs_status,
        enrichment_attempts=enrichment_attempts,
        last_enriched_at=last_enriched_at,
        enrichment_error=enrichment_error,
        created_at=created_at or datetime(2026, 11, 20, 12, 0, 0, tzinfo=timezone.utc),
    )


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_enrichment_queue_live_readonly_session(client: TestClient) -> None:
    """GET /api/v1/admin/pipeline populates enrichment_queue read-only against live PostgreSQL."""
    response = client.get("/api/v1/admin/pipeline")
    assert response.status_code == 200

    data = response.json()
    eq = data["enrichment_queue"]
    assert eq is not None

    expected_failed_total = eq["failed_due"] + eq["failed_backoff"] + eq["failed_exhausted"]
    assert eq["failed_total"] == expected_failed_total

    expected_total = (
        eq["pending"]
        + eq["matched"]
        + eq["partial_matched"]
        + eq["not_found"]
        + eq["failed_total"]
    )
    assert eq["total"] == expected_total
    assert 0 <= eq["partial_matched_due"] <= eq["partial_matched"]

    expected_resolved_pct = (
        round(((eq["matched"] + eq["partial_matched"] + eq["not_found"]) / eq["total"]) * 100.0, 1)
        if eq["total"] > 0
        else 0.0
    )
    assert eq["resolved_pct"] == expected_resolved_pct
    assert isinstance(eq["failed_items"], list)
    assert len(eq["failed_items"]) <= 25
    assert _parse_iso(data["server_time"]).tzinfo is not None


def test_enrichment_queue_full_status_classification_and_resolved_pct(
    client: TestClient,
) -> None:
    """Accurately classifies pending, matched, partial_matched, not_found, and failed buckets."""
    fixed_now = datetime(2026, 11, 27, 12, 0, 0, tzinfo=timezone.utc)
    albums = [
        _make_album(discogs_status="pending"),
        _make_album(discogs_status="pending"),
        _make_album(discogs_status="matched"),
        _make_album(discogs_status="matched"),
        _make_album(discogs_status="matched"),
        _make_album(discogs_status="not_found"),
        # partial_matched due (last_enriched_at > 7d ago, created within 60d)
        _make_album(
            discogs_status="partial_matched",
            last_enriched_at=fixed_now - timedelta(days=8),
            created_at=fixed_now - timedelta(days=20),
        ),
        # partial_matched cooling (enriched 3d ago)
        _make_album(
            discogs_status="partial_matched",
            last_enriched_at=fixed_now - timedelta(days=3),
            created_at=fixed_now - timedelta(days=20),
        ),
        # failed due (attempt 2 -> 10m backoff, elapsed 12m)
        _make_album(
            album_id="11111111-1111-1111-1111-111111111111",
            combined_artist="Portishead",
            title="Dummy",
            discogs_status="failed",
            enrichment_attempts=2,
            last_enriched_at=fixed_now - timedelta(minutes=12),
            enrichment_error="Discogs timeout",
        ),
        # failed backoff (attempt 3 -> 20m backoff, elapsed 10m)
        _make_album(
            album_id="22222222-2222-2222-2222-222222222222",
            combined_artist="Massive Attack",
            title="Mezzanine",
            discogs_status="failed",
            enrichment_attempts=3,
            last_enriched_at=fixed_now - timedelta(minutes=10),
            enrichment_error="Discogs HTTP 429",
        ),
        # failed exhausted (attempt 5)
        _make_album(
            album_id="33333333-3333-3333-3333-333333333333",
            combined_artist="Boards of Canada",
            title="Music Has the Right to Children",
            discogs_status="failed",
            enrichment_attempts=5,
            last_enriched_at=fixed_now - timedelta(hours=2),
            enrichment_error="Discogs API 500 Internal Server Error",
        ),
    ]

    fake_session = _FakeEnrichmentSession(
        albums=albums,
        process_row=_make_process_row(fixed_now),
    )
    app.dependency_overrides[get_db] = lambda: fake_session
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        response = client.get("/api/v1/admin/pipeline")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    eq = response.json()["enrichment_queue"]
    assert eq["pending"] == 2
    assert eq["matched"] == 3
    assert eq["partial_matched"] == 2
    assert eq["partial_matched_due"] == 1
    assert eq["not_found"] == 1
    assert eq["failed_due"] == 1
    assert eq["failed_backoff"] == 1
    assert eq["failed_exhausted"] == 1
    assert eq["failed_total"] == 3
    assert eq["total"] == 11
    # resolved = matched(3) + partial_matched(2) + not_found(1) = 6 / 11 = 54.5%
    assert eq["resolved_pct"] == 54.5

    # Failed items sorted: exhausted -> due -> backoff
    failed = eq["failed_items"]
    assert [item["state"] for item in failed] == ["exhausted", "due", "backoff"]
    assert failed[0]["album_id"] == "33333333-3333-3333-3333-333333333333"
    assert failed[0]["enrichment_attempts"] == 5
    assert failed[0]["max_attempts"] == 5
    assert failed[0]["next_retry_at"] is None

    assert failed[1]["album_id"] == "11111111-1111-1111-1111-111111111111"
    assert _parse_iso(failed[1]["next_retry_at"]) == fixed_now - timedelta(minutes=2)

    assert failed[2]["album_id"] == "22222222-2222-2222-2222-222222222222"
    assert _parse_iso(failed[2]["next_retry_at"]) == fixed_now + timedelta(minutes=10)


@pytest.mark.parametrize(
    ("attempts", "elapsed_seconds", "expected_state", "expected_backoff_minutes"),
    [
        # Attempt 1 -> 5m = 300s
        (1, 300, "due", 5),
        (1, 299, "backoff", 5),
        # Attempt 2 -> 10m = 600s
        (2, 600, "due", 10),
        (2, 599, "backoff", 10),
        # Attempt 3 -> 20m = 1200s
        (3, 1200, "due", 20),
        (3, 1199, "backoff", 20),
        # Attempt 4 -> 40m = 2400s
        (4, 2400, "due", 40),
        (4, 2399, "backoff", 40),
        # Attempt 5 & 6 -> exhausted regardless of elapsed time
        (5, 86400, "exhausted", None),
        (6, 10, "exhausted", None),
    ],
)
def test_enrichment_exponential_backoff_boundaries(
    client: TestClient,
    attempts: int,
    elapsed_seconds: int,
    expected_state: str,
    expected_backoff_minutes: int | None,
) -> None:
    """Enforces exact 5m * 2^(enrichment_attempts - 1) backoff and attempts >= 5 exhaustion."""
    fixed_now = datetime(2026, 11, 27, 12, 0, 0, tzinfo=timezone.utc)
    last_enriched_at = fixed_now - timedelta(seconds=elapsed_seconds)
    album = _make_album(
        discogs_status="failed",
        enrichment_attempts=attempts,
        last_enriched_at=last_enriched_at,
        enrichment_error="Upstream 502",
    )

    fake_session = _FakeEnrichmentSession(albums=[album], process_row=_make_process_row(fixed_now))
    app.dependency_overrides[get_db] = lambda: fake_session
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        response = client.get("/api/v1/admin/pipeline")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    eq = response.json()["enrichment_queue"]
    assert eq["failed_due"] == (1 if expected_state == "due" else 0)
    assert eq["failed_backoff"] == (1 if expected_state == "backoff" else 0)
    assert eq["failed_exhausted"] == (1 if expected_state == "exhausted" else 0)

    item = eq["failed_items"][0]
    assert item["state"] == expected_state
    assert item["enrichment_attempts"] == attempts
    assert item["max_attempts"] == 5
    if expected_backoff_minutes is None:
        assert item["next_retry_at"] is None
    else:
        assert _parse_iso(item["next_retry_at"]) == last_enriched_at + timedelta(
            minutes=expected_backoff_minutes
        )


def test_enrichment_failed_with_null_last_enriched_at_is_due_with_null_retry(
    client: TestClient,
) -> None:
    """Failed album with attempts < 5 and NULL last_enriched_at is immediately due."""
    fixed_now = datetime(2026, 11, 27, 12, 0, 0, tzinfo=timezone.utc)
    album = _make_album(
        discogs_status="failed",
        enrichment_attempts=1,
        last_enriched_at=None,
        enrichment_error="Connection reset",
    )

    fake_session = _FakeEnrichmentSession(albums=[album], process_row=_make_process_row(fixed_now))
    app.dependency_overrides[get_db] = lambda: fake_session
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        response = client.get("/api/v1/admin/pipeline")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    eq = response.json()["enrichment_queue"]
    assert eq["failed_due"] == 1
    assert eq["failed_items"][0]["state"] == "due"
    assert eq["failed_items"][0]["last_enriched_at"] is None
    assert eq["failed_items"][0]["next_retry_at"] is None


@pytest.mark.parametrize(
    ("last_enriched_offset", "created_offset", "expected_due"),
    [
        # Exact 7d recheck & exact 60d age boundary -> due
        (timedelta(days=7), timedelta(days=60), 1),
        # 1 second short of 7d recheck -> cooling (not due)
        (timedelta(days=7) - timedelta(seconds=1), timedelta(days=10), 0),
        # 1 second older than 60d max age -> too old (not due)
        (timedelta(days=10), timedelta(days=60, seconds=1), 0),
        # NULL last_enriched_at within 60d -> due
        (None, timedelta(days=30), 1),
        # NULL last_enriched_at older than 60d -> not due
        (None, timedelta(days=61), 0),
    ],
)
def test_enrichment_partial_matched_due_7d_60d_boundaries(
    client: TestClient,
    last_enriched_offset: timedelta | None,
    created_offset: timedelta,
    expected_due: int,
) -> None:
    """Enforces exact 7-day re-check interval and 60-day created_at window for partial_matched."""
    fixed_now = datetime(2026, 11, 27, 12, 0, 0, tzinfo=timezone.utc)
    album = _make_album(
        discogs_status="partial_matched",
        last_enriched_at=(fixed_now - last_enriched_offset) if last_enriched_offset else None,
        created_at=fixed_now - created_offset,
    )

    fake_session = _FakeEnrichmentSession(albums=[album], process_row=_make_process_row(fixed_now))
    app.dependency_overrides[get_db] = lambda: fake_session
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        response = client.get("/api/v1/admin/pipeline")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    eq = response.json()["enrichment_queue"]
    assert eq["partial_matched"] == 1
    assert eq["partial_matched_due"] == expected_due


def test_enrichment_failed_items_priority_sorting_and_25_row_cap(client: TestClient) -> None:
    """Caps failed_items at 25, ordering exhausted -> due -> backoff and NULLS FIRST DESC."""
    fixed_now = datetime(2026, 11, 27, 12, 0, 0, tzinfo=timezone.utc)
    albums: list[SimpleNamespace] = []

    # 10 backoff albums (attempt 4 -> 40m backoff, elapsed 1m..10m)
    for idx in range(10):
        albums.append(
            _make_album(
                title=f"Backoff {idx}",
                discogs_status="failed",
                enrichment_attempts=4,
                last_enriched_at=fixed_now - timedelta(minutes=idx + 1),
                created_at=fixed_now - timedelta(days=idx + 1),
            )
        )

    # 10 due albums (attempt 1 -> 5m backoff, elapsed 10m..19m)
    for idx in range(10):
        albums.append(
            _make_album(
                title=f"Due {idx}",
                discogs_status="failed",
                enrichment_attempts=1,
                last_enriched_at=fixed_now - timedelta(minutes=10 + idx),
                created_at=fixed_now - timedelta(days=idx + 1),
            )
        )

    # 10 exhausted albums: 1 with NULL last_enriched_at (must sort #1), 9 with timestamps
    albums.append(
        _make_album(
            title="Exhausted Null LastEnriched",
            discogs_status="failed",
            enrichment_attempts=5,
            last_enriched_at=None,
            created_at=fixed_now - timedelta(days=5),
        )
    )
    for idx in range(9):
        albums.append(
            _make_album(
                title=f"Exhausted {idx}",
                discogs_status="failed",
                enrichment_attempts=5,
                last_enriched_at=fixed_now - timedelta(minutes=idx + 1),
                created_at=fixed_now - timedelta(days=idx + 1),
            )
        )

    fake_session = _FakeEnrichmentSession(albums=albums, process_row=_make_process_row(fixed_now))
    app.dependency_overrides[get_db] = lambda: fake_session
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        response = client.get("/api/v1/admin/pipeline")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    eq = response.json()["enrichment_queue"]
    assert eq["failed_exhausted"] == 10
    assert eq["failed_due"] == 10
    assert eq["failed_backoff"] == 10
    assert eq["failed_total"] == 30

    failed_items = eq["failed_items"]
    assert len(failed_items) == 25
    assert [item["state"] for item in failed_items[:10]] == ["exhausted"] * 10
    assert [item["state"] for item in failed_items[10:20]] == ["due"] * 10
    assert [item["state"] for item in failed_items[20:25]] == ["backoff"] * 5

    # Within exhausted: NULL last_enriched_at first, then most recent last_enriched_at DESC
    assert failed_items[0]["album_title"] == "Exhausted Null LastEnriched"
    assert failed_items[1]["album_title"] == "Exhausted 0"
    assert failed_items[9]["album_title"] == "Exhausted 8"

    # Within backoff: only top 5 most recently attempted survive the 25-row cap
    assert [item["album_title"] for item in failed_items[20:25]] == [
        "Backoff 0",
        "Backoff 1",
        "Backoff 2",
        "Backoff 3",
        "Backoff 4",
    ]


def test_enrichment_queue_empty_albums_returns_zero_resolved_pct(client: TestClient) -> None:
    """Empty albums table returns all-zero counts and resolved_pct == 0.0 without ZeroDivision."""
    fixed_now = datetime(2026, 11, 27, 12, 0, 0, tzinfo=timezone.utc)
    fake_session = _FakeEnrichmentSession(albums=[], process_row=_make_process_row(fixed_now))
    app.dependency_overrides[get_db] = lambda: fake_session
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        response = client.get("/api/v1/admin/pipeline")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    eq = response.json()["enrichment_queue"]
    assert eq["total"] == 0
    assert eq["resolved_pct"] == 0.0
    assert eq["failed_total"] == 0
    assert eq["failed_items"] == []


def test_enrichment_queue_populates_when_telemetry_tables_missing(client: TestClient) -> None:
    """UndefinedTable (42P01) rolls back aborted transaction so enrichment_queue still populates."""
    fixed_now = datetime(2026, 11, 27, 12, 0, 0, tzinfo=timezone.utc)
    undefined_table_err = ProgrammingError(
        "SELECT * FROM pipeline_process_status",
        {},
        psycopg.errors.UndefinedTable('relation "pipeline_process_status" does not exist'),
    )
    albums = [
        _make_album(discogs_status="matched"),
        _make_album(
            album_id="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            combined_artist="Aphex Twin",
            title="Selected Ambient Works 85-92",
            discogs_status="failed",
            enrichment_attempts=5,
            last_enriched_at=fixed_now - timedelta(hours=1),
            enrichment_error="Discogs 503 Service Unavailable",
        ),
    ]

    fake_session = _FakeEnrichmentSession(albums=albums, telemetry_error=undefined_table_err)
    app.dependency_overrides[get_db] = lambda: fake_session
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        response = client.get("/api/v1/admin/pipeline")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert fake_session.rollback_calls == 1
    data = response.json()
    assert data["telemetry_available"] is False
    assert data["process"]["effective_status"] == "unavailable"

    eq = data["enrichment_queue"]
    assert eq["matched"] == 1
    assert eq["failed_exhausted"] == 1
    assert eq["total"] == 2
    assert eq["resolved_pct"] == 50.0
    assert len(eq["failed_items"]) == 1
    assert eq["failed_items"][0]["album_id"] == "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"


def test_enrichment_queue_populates_when_telemetry_tables_empty(client: TestClient) -> None:
    """Empty telemetry tables still return accurate enrichment_queue counts and failed_items."""
    fixed_now = datetime(2026, 11, 27, 12, 0, 0, tzinfo=timezone.utc)
    albums = [
        _make_album(discogs_status="pending"),
        _make_album(discogs_status="matched"),
        _make_album(
            discogs_status="failed",
            enrichment_attempts=1,
            last_enriched_at=fixed_now - timedelta(minutes=2),
            enrichment_error="Rate limited",
        ),
    ]

    fake_session = _FakeEnrichmentSession(albums=albums, process_row=None, loop_rows=[])
    app.dependency_overrides[get_db] = lambda: fake_session
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        response = client.get("/api/v1/admin/pipeline")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["telemetry_available"] is False
    eq = data["enrichment_queue"]
    assert eq["pending"] == 1
    assert eq["matched"] == 1
    assert eq["failed_backoff"] == 1
    assert eq["total"] == 3
    assert eq["resolved_pct"] == 33.3
    assert len(eq["failed_items"]) == 1
    assert eq["failed_items"][0]["state"] == "backoff"
