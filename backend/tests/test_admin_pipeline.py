"""HTTP seam tests for GET /api/v1/admin/pipeline."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import psycopg.errors
import pytest
from admin_test_helpers import FakeAdminSession, make_process_row, parse_iso
from fastapi.testclient import TestClient
from sqlalchemy.exc import ProgrammingError

from backend.api.admin import get_utc_now
from backend.db import get_db
from backend.main import app


def _make_loop_row(
    *,
    loop_name: str,
    status: str,
    interval_seconds: int,
    last_started_at: datetime | None = None,
    last_completed_at: datetime | None = None,
    next_run_at: datetime | None = None,
    last_duration_ms: int | None = None,
    last_run_stats: dict[str, int] | None = None,
    last_error: str | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        loop_name=loop_name,
        status=status,
        interval_seconds=interval_seconds,
        last_started_at=last_started_at,
        last_completed_at=last_completed_at,
        next_run_at=next_run_at,
        last_duration_ms=last_duration_ms,
        last_run_stats=last_run_stats,
        last_error=last_error,
    )


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_admin_pipeline_live_readonly_session(client: TestClient) -> None:
    """GET /api/v1/admin/pipeline executes strictly read-only against live PostgreSQL."""
    response = client.get("/api/v1/admin/pipeline")
    assert response.status_code == 200

    data = response.json()
    assert "server_time" in data
    parse_iso(data["server_time"])
    assert isinstance(data["telemetry_available"], bool)
    assert data["process"]["effective_status"] in {
        "online",
        "stopped",
        "offline",
        "unavailable",
    }
    assert isinstance(data["loops"], list)
    assert isinstance(data["runs"], list)


def test_admin_pipeline_online_with_canonical_loop_ordering_and_stats(client: TestClient) -> None:
    """Online process returns all four loops in canonical order with stats, errors, and schedules."""
    fixed_now = datetime(2026, 11, 27, 12, 0, 0, tzinfo=timezone.utc)
    process_row = make_process_row(
        status="running",
        run_mode="continuous",
        host="vinyl-scraper-prod",
        pid=4242,
        heartbeat_interval_seconds=30,
        started_at=fixed_now - timedelta(hours=2),
        last_heartbeat_at=fixed_now - timedelta(seconds=15),
    )
    # Intentionally unsorted in DB to verify canonical ordering
    loop_rows = [
        _make_loop_row(
            loop_name="enrichment_worker",
            status="disabled",
            interval_seconds=600,
            next_run_at=fixed_now + timedelta(minutes=5),  # must be normalized to None
        ),
        _make_loop_row(
            loop_name="extraction_worker",
            status="sleeping",
            interval_seconds=2,
            last_started_at=fixed_now - timedelta(seconds=10),
            last_completed_at=fixed_now - timedelta(seconds=9),
            next_run_at=None,
            last_duration_ms=1000,
            last_run_stats={"extracted": 7},
        ),
        _make_loop_row(
            loop_name="tracking_poll",
            status="error",
            interval_seconds=900,
            last_started_at=fixed_now - timedelta(minutes=2),
            last_completed_at=fixed_now - timedelta(minutes=2) + timedelta(seconds=4),
            next_run_at=fixed_now + timedelta(minutes=13),
            last_duration_ms=4120,
            last_run_stats={"inserted": 0, "updated": 18, "skipped": 2},
            last_error="Reddit HTTP 429 rate limited",
        ),
        _make_loop_row(
            loop_name="discovery_poll",
            status="sleeping",
            interval_seconds=300,
            last_started_at=fixed_now - timedelta(minutes=1),
            last_completed_at=fixed_now - timedelta(seconds=57),
            next_run_at=fixed_now + timedelta(minutes=4, seconds=3),
            last_duration_ms=3000,
            last_run_stats={"inserted": 4, "updated": 12, "skipped": 34},
        ),
    ]

    fake_session = FakeAdminSession(process_row=process_row, loop_rows=loop_rows)
    app.dependency_overrides[get_db] = lambda: fake_session
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        response = client.get("/api/v1/admin/pipeline")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["telemetry_available"] is True
    assert parse_iso(data["server_time"]) == fixed_now

    proc = data["process"]
    assert proc["effective_status"] == "online"
    assert proc["raw_status"] == "running"
    assert proc["run_mode"] == "continuous"
    assert proc["host"] == "vinyl-scraper-prod"
    assert proc["pid"] == 4242
    assert proc["heartbeat_interval_seconds"] == 30
    assert proc["stale_threshold_seconds"] == 90
    assert proc["stopped_at"] is None

    loops = data["loops"]
    assert [loop["loop_name"] for loop in loops] == [
        "discovery_poll",
        "tracking_poll",
        "extraction_worker",
        "enrichment_worker",
    ]
    assert loops[0]["last_run_stats"] == {"inserted": 4, "updated": 12, "skipped": 34}
    assert loops[0]["next_run_at"] is not None
    assert loops[1]["status"] == "error"
    assert loops[1]["last_error"] == "Reddit HTTP 429 rate limited"
    assert loops[2]["next_run_at"] is None
    assert loops[2]["last_run_stats"] == {"extracted": 7}
    assert loops[3]["status"] == "disabled"
    assert loops[3]["next_run_at"] is None


@pytest.mark.parametrize(
    ("heartbeat_interval", "age_seconds", "expected_status", "expected_threshold"),
    [
        (30, 90, "online", 90),
        (30, 91, "offline", 90),
        (45, 135, "online", 135),
        (45, 136, "offline", 135),
    ],
)
def test_admin_pipeline_heartbeat_staleness_threshold(
    client: TestClient,
    heartbeat_interval: int,
    age_seconds: int,
    expected_status: str,
    expected_threshold: int,
) -> None:
    """Running process transitions to offline strictly when heartbeat age > max(90, 3*interval)."""
    fixed_now = datetime(2026, 11, 27, 12, 0, 0, tzinfo=timezone.utc)
    process_row = make_process_row(
        status="running",
        heartbeat_interval_seconds=heartbeat_interval,
        started_at=fixed_now - timedelta(hours=1),
        last_heartbeat_at=fixed_now - timedelta(seconds=age_seconds),
    )
    loop_rows = [
        _make_loop_row(
            loop_name="discovery_poll",
            status="sleeping",
            interval_seconds=300,
            next_run_at=fixed_now - timedelta(seconds=30),
        ),
    ]

    fake_session = FakeAdminSession(process_row=process_row, loop_rows=loop_rows)
    app.dependency_overrides[get_db] = lambda: fake_session
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        response = client.get("/api/v1/admin/pipeline")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["process"]["effective_status"] == expected_status
    assert data["process"]["stale_threshold_seconds"] == expected_threshold
    if expected_status == "offline":
        assert data["loops"][0]["next_run_at"] is None
    else:
        assert data["loops"][0]["next_run_at"] is not None


@pytest.mark.parametrize("run_mode", ["continuous", "once"])
def test_admin_pipeline_stopped_process_clears_next_run_at(
    client: TestClient,
    run_mode: str,
) -> None:
    """Cleanly stopped continuous or --once process reports stopped with stopped_at and no timers."""
    fixed_now = datetime(2026, 11, 27, 12, 0, 0, tzinfo=timezone.utc)
    stopped_at = fixed_now - timedelta(minutes=10)
    process_row = make_process_row(
        status="stopped",
        run_mode=run_mode,
        started_at=fixed_now - timedelta(minutes=15),
        last_heartbeat_at=stopped_at,
        stopped_at=stopped_at,
    )
    loop_rows = [
        _make_loop_row(
            loop_name="discovery_poll",
            status="stopped",
            interval_seconds=300,
            next_run_at=fixed_now + timedelta(minutes=2),
        ),
    ]

    fake_session = FakeAdminSession(process_row=process_row, loop_rows=loop_rows)
    app.dependency_overrides[get_db] = lambda: fake_session
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        response = client.get("/api/v1/admin/pipeline")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["telemetry_available"] is True
    assert data["process"]["effective_status"] == "stopped"
    assert data["process"]["run_mode"] == run_mode
    assert parse_iso(data["process"]["stopped_at"]) == stopped_at
    assert data["loops"][0]["next_run_at"] is None


def test_admin_pipeline_degrades_gracefully_when_telemetry_tables_missing(
    client: TestClient,
) -> None:
    """UndefinedTable (42P01) rolls back session and returns HTTP 200 telemetry_available=False."""
    fixed_now = datetime(2026, 11, 27, 12, 0, 0, tzinfo=timezone.utc)
    undefined_table_err = ProgrammingError(
        "SELECT * FROM pipeline_process_status",
        {},
        psycopg.errors.UndefinedTable('relation "pipeline_process_status" does not exist'),
    )
    fake_session = FakeAdminSession(telemetry_error=undefined_table_err)

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
    assert data["process"]["stale_threshold_seconds"] == 90
    assert data["process"]["host"] is None
    assert data["process"]["pid"] is None
    assert data["loops"] == []
    assert data["runs"] == []


def test_admin_pipeline_degrades_gracefully_when_process_table_empty(client: TestClient) -> None:
    """Empty pipeline_process_status table returns HTTP 200 telemetry_available=False."""
    fixed_now = datetime(2026, 11, 27, 12, 0, 0, tzinfo=timezone.utc)
    fake_session = FakeAdminSession(process_row=None, loop_rows=[])

    app.dependency_overrides[get_db] = lambda: fake_session
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        response = client.get("/api/v1/admin/pipeline")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["telemetry_available"] is False
    assert data["process"]["effective_status"] == "unavailable"
    assert data["loops"] == []


def test_admin_pipeline_query_parameter_validation(client: TestClient) -> None:
    """Valid run filter params return 200; invalid stage, outcome, or limit return 422."""
    fixed_now = datetime(2026, 11, 27, 12, 0, 0, tzinfo=timezone.utc)
    fake_session = FakeAdminSession(process_row=None)

    app.dependency_overrides[get_db] = lambda: fake_session
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        ok = client.get(
            "/api/v1/admin/pipeline?run_stage=discovery_poll&run_outcome=error&run_limit=25"
        )
        bad_stage = client.get("/api/v1/admin/pipeline?run_stage=invalid_loop")
        bad_outcome = client.get("/api/v1/admin/pipeline?run_outcome=partial")
        bad_limit_low = client.get("/api/v1/admin/pipeline?run_limit=0")
        bad_limit_high = client.get("/api/v1/admin/pipeline?run_limit=101")
    finally:
        app.dependency_overrides.clear()

    assert ok.status_code == 200
    assert bad_stage.status_code == 422
    assert bad_outcome.status_code == 422
    assert bad_limit_low.status_code == 422
    assert bad_limit_high.status_code == 422
