"""HTTP seam tests for Pipeline Run history on GET /api/v1/admin/pipeline (#45)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any

import psycopg.errors
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.dialects import postgresql
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


class _FakeRunsSession:
    """Controlled read-only Session evaluating compiled PostgreSQL queries on pipeline_runs."""

    def __init__(
        self,
        *,
        process_row: Any = None,
        loop_rows: list[Any] | None = None,
        run_rows: list[Any] | None = None,
        runs_error: Exception | None = None,
    ) -> None:
        self._process_row = process_row
        self._loop_rows = loop_rows if loop_rows is not None else []
        self._run_rows = list(run_rows) if run_rows is not None else []
        self._runs_error = runs_error
        self.rollback_calls = 0
        self.last_runs_sql: str | None = None
        self.last_runs_params: dict[str, Any] = {}

    def execute(self, statement: Any, *args: Any, **kwargs: Any) -> _FakeResult:
        compiled = statement.compile(dialect=postgresql.dialect())
        sql = str(compiled)
        params = dict(compiled.params)

        if "FROM pipeline_process_status" in sql:
            return _FakeResult(scalar_item=self._process_row)

        if "FROM pipeline_loop_states" in sql:
            return _FakeResult(scalar_items=self._loop_rows)

        if "FROM pipeline_runs" in sql:
            self.last_runs_sql = sql
            self.last_runs_params = params
            if self._runs_error is not None:
                raise self._runs_error

            rows = list(self._run_rows)
            for key, value in params.items():
                if key.startswith("loop_name"):
                    rows = [r for r in rows if r.loop_name == value]
                elif key.startswith("status"):
                    rows = [r for r in rows if r.status == value]

            if "ORDER BY pipeline_runs.started_at DESC" in sql:
                rows.sort(key=lambda r: (r.started_at, r.id), reverse=True)

            limit_val = next((v for k, v in params.items() if "param" in k), None)
            if isinstance(limit_val, int):
                rows = rows[:limit_val]

            return _FakeResult(scalar_items=rows)

        return _FakeResult()

    def rollback(self) -> None:
        self.rollback_calls += 1


def _make_process_row(now: datetime) -> SimpleNamespace:
    return SimpleNamespace(
        process_name="default",
        status="running",
        run_mode="continuous",
        host="scraper-host-01",
        pid=12345,
        heartbeat_interval_seconds=30,
        started_at=now - timedelta(hours=2),
        last_heartbeat_at=now - timedelta(seconds=10),
        stopped_at=None,
    )


def _make_run_row(
    *,
    run_id: int,
    loop_name: str,
    status: str,
    started_at: datetime,
    duration_ms: int = 1200,
    stats: dict[str, int] | None = None,
    error_message: str | None = None,
    host: str | None = "scraper-host-01",
    pid: int | None = 12345,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=run_id,
        loop_name=loop_name,
        status=status,
        started_at=started_at,
        completed_at=started_at + timedelta(milliseconds=duration_ms),
        duration_ms=duration_ms,
        stats=stats,
        error_message=error_message,
        host=host,
        pid=pid,
    )


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_admin_pipeline_returns_runs_newest_first_with_all_fields(client: TestClient) -> None:
    """GET /api/v1/admin/pipeline returns pipeline_runs newest-first with stats and errors."""
    fixed_now = datetime(2026, 11, 27, 12, 0, 0, tzinfo=timezone.utc)
    older_run = _make_run_row(
        run_id=101,
        loop_name="discovery_poll",
        status="success",
        started_at=fixed_now - timedelta(minutes=10),
        duration_ms=2450,
        stats={"inserted": 3, "updated": 9, "skipped": 12},
        error_message=None,
        host="scraper-host-01",
        pid=12345,
    )
    newer_error_run = _make_run_row(
        run_id=102,
        loop_name="tracking_poll",
        status="error",
        started_at=fixed_now - timedelta(minutes=2),
        duration_ms=850,
        stats=None,
        error_message="Reddit HTTP 429 rate limited",
        host="scraper-host-01",
        pid=12345,
    )

    # Pass unsorted rows so ORDER BY started_at DESC is actually exercised
    fake_session = _FakeRunsSession(
        process_row=_make_process_row(fixed_now),
        run_rows=[older_run, newer_error_run],
    )
    app.dependency_overrides[get_db] = lambda: fake_session
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        response = client.get("/api/v1/admin/pipeline")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    runs = response.json()["runs"]
    assert [r["id"] for r in runs] == [102, 101]

    first = runs[0]
    assert first["stage"] == "tracking_poll"
    assert first["outcome"] == "error"
    assert _parse_iso(first["started_at"]) == newer_error_run.started_at
    assert _parse_iso(first["completed_at"]) == newer_error_run.completed_at
    assert first["duration_ms"] == 850
    assert first["stats"] is None
    assert first["error_message"] == "Reddit HTTP 429 rate limited"
    assert first["host"] == "scraper-host-01"
    assert first["pid"] == 12345

    second = runs[1]
    assert second["stage"] == "discovery_poll"
    assert second["outcome"] == "success"
    assert second["duration_ms"] == 2450
    assert second["stats"] == {"inserted": 3, "updated": 9, "skipped": 12}
    assert second["error_message"] is None


def test_admin_pipeline_runs_degrades_to_empty_list_when_table_missing(
    client: TestClient,
) -> None:
    """Missing pipeline_runs table (UndefinedTable 42P01) rolls back session and returns runs=[]."""
    fixed_now = datetime(2026, 11, 27, 12, 0, 0, tzinfo=timezone.utc)
    undefined_err = ProgrammingError(
        "SELECT * FROM pipeline_runs",
        {},
        psycopg.errors.UndefinedTable('relation "pipeline_runs" does not exist'),
    )
    fake_session = _FakeRunsSession(
        process_row=_make_process_row(fixed_now),
        runs_error=undefined_err,
    )
    app.dependency_overrides[get_db] = lambda: fake_session
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        response = client.get("/api/v1/admin/pipeline")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert fake_session.rollback_calls == 1
    assert response.json()["runs"] == []


def test_admin_pipeline_runs_filters_by_stage_outcome_and_limit(client: TestClient) -> None:
    """run_stage, run_outcome, and run_limit filter and bound Pipeline Run history accurately."""
    fixed_now = datetime(2026, 11, 27, 12, 0, 0, tzinfo=timezone.utc)
    run_rows = [
        _make_run_row(
            run_id=1,
            loop_name="discovery_poll",
            status="success",
            started_at=fixed_now - timedelta(minutes=20),
            stats={"inserted": 1, "updated": 2, "skipped": 3},
        ),
        _make_run_row(
            run_id=2,
            loop_name="discovery_poll",
            status="error",
            started_at=fixed_now - timedelta(minutes=15),
            error_message="Timeout",
        ),
        _make_run_row(
            run_id=3,
            loop_name="extraction_worker",
            status="success",
            started_at=fixed_now - timedelta(minutes=10),
            stats={"extracted": 5},
        ),
        _make_run_row(
            run_id=4,
            loop_name="enrichment_worker",
            status="error",
            started_at=fixed_now - timedelta(minutes=5),
            error_message="Discogs 503",
        ),
        _make_run_row(
            run_id=5,
            loop_name="discovery_poll",
            status="success",
            started_at=fixed_now - timedelta(minutes=1),
            stats={"inserted": 4, "updated": 0, "skipped": 10},
        ),
    ]
    fake_session = _FakeRunsSession(
        process_row=_make_process_row(fixed_now),
        run_rows=run_rows,
    )
    app.dependency_overrides[get_db] = lambda: fake_session
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        by_stage = client.get("/api/v1/admin/pipeline?run_stage=discovery_poll")
        by_outcome = client.get("/api/v1/admin/pipeline?run_outcome=error")
        combined = client.get("/api/v1/admin/pipeline?run_stage=discovery_poll&run_outcome=success")
        limited = client.get("/api/v1/admin/pipeline?run_limit=2")
    finally:
        app.dependency_overrides.clear()

    assert by_stage.status_code == 200
    assert [r["id"] for r in by_stage.json()["runs"]] == [5, 2, 1]

    assert by_outcome.status_code == 200
    assert [r["id"] for r in by_outcome.json()["runs"]] == [4, 2]

    assert combined.status_code == 200
    assert [r["id"] for r in combined.json()["runs"]] == [5, 1]

    assert limited.status_code == 200
    assert [r["id"] for r in limited.json()["runs"]] == [5, 4]


def test_admin_pipeline_runs_default_limit_is_50_and_max_is_100(client: TestClient) -> None:
    """Default run_limit caps results at 50; run_limit=100 returns up to 100 newest runs."""
    fixed_now = datetime(2026, 11, 27, 12, 0, 0, tzinfo=timezone.utc)
    run_rows = [
        _make_run_row(
            run_id=idx,
            loop_name="discovery_poll",
            status="success",
            started_at=fixed_now - timedelta(minutes=120 - idx),
            stats={"inserted": idx, "updated": 0, "skipped": 0},
        )
        for idx in range(1, 111)
    ]
    fake_session = _FakeRunsSession(
        process_row=_make_process_row(fixed_now),
        run_rows=run_rows,
    )
    app.dependency_overrides[get_db] = lambda: fake_session
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        default_resp = client.get("/api/v1/admin/pipeline")
        max_resp = client.get("/api/v1/admin/pipeline?run_limit=100")
    finally:
        app.dependency_overrides.clear()

    assert default_resp.status_code == 200
    default_runs = default_resp.json()["runs"]
    assert len(default_runs) == 50
    assert default_runs[0]["id"] == 110
    assert default_runs[-1]["id"] == 61

    assert max_resp.status_code == 200
    max_runs = max_resp.json()["runs"]
    assert len(max_runs) == 100
    assert max_runs[0]["id"] == 110
    assert max_runs[-1]["id"] == 11


@pytest.mark.parametrize(
    "query_string",
    [
        "run_stage=unknown_stage",
        "run_outcome=warning",
        "run_limit=0",
        "run_limit=-5",
        "run_limit=101",
        "run_limit=notanint",
    ],
)
def test_admin_pipeline_runs_rejects_invalid_query_params_with_422(
    client: TestClient,
    query_string: str,
) -> None:
    """Invalid run_stage, run_outcome, or run_limit query parameters return HTTP 422."""
    fixed_now = datetime(2026, 11, 27, 12, 0, 0, tzinfo=timezone.utc)
    fake_session = _FakeRunsSession(process_row=_make_process_row(fixed_now))
    app.dependency_overrides[get_db] = lambda: fake_session
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        response = client.get(f"/api/v1/admin/pipeline?{query_string}")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422


def test_admin_pipeline_runs_empty_table_returns_empty_list(client: TestClient) -> None:
    """Empty pipeline_runs table returns HTTP 200 with runs=[]."""
    fixed_now = datetime(2026, 11, 27, 12, 0, 0, tzinfo=timezone.utc)
    fake_session = _FakeRunsSession(process_row=_make_process_row(fixed_now), run_rows=[])
    app.dependency_overrides[get_db] = lambda: fake_session
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        response = client.get("/api/v1/admin/pipeline")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["runs"] == []


def test_admin_pipeline_runs_live_readonly_postgresql_filters(client: TestClient) -> None:
    """Filtered Pipeline Run queries execute strictly read-only against live PostgreSQL."""
    response = client.get(
        "/api/v1/admin/pipeline?run_stage=discovery_poll&run_outcome=success&run_limit=10"
    )
    assert response.status_code == 200
    runs = response.json()["runs"]
    assert isinstance(runs, list)
    assert len(runs) <= 10
    for run in runs:
        assert run["stage"] == "discovery_poll"
        assert run["outcome"] == "success"


