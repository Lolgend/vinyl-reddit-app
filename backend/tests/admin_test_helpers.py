"""Shared read-only Session stubs and row builders for Pipeline Admin HTTP seam tests."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any

import psycopg.errors
from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import ProgrammingError


def parse_iso(value: str) -> datetime:
    """Parse an ISO-8601 timestamp string (including trailing Z) into an aware datetime."""
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


class FakeScalarResult:
    """Minimal SQLAlchemy ScalarResult stand-in."""

    def __init__(self, items: list[Any]) -> None:
        self._items = items

    def all(self) -> list[Any]:
        return list(self._items)


class FakeResult:
    """Minimal SQLAlchemy Result stand-in supporting scalar_one_or_none() and scalars().all()."""

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

    def scalars(self) -> FakeScalarResult:
        return FakeScalarResult(self._scalar_items)


class FakeAdminSession:
    """Controlled read-only Session stub for deterministic Pipeline Admin HTTP-seam tests."""

    def __init__(
        self,
        *,
        process_row: Any = None,
        loop_rows: list[Any] | None = None,
        albums: list[Any] | None = None,
        run_rows: list[Any] | None = None,
        telemetry_error: Exception | None = None,
        runs_error: Exception | None = None,
    ) -> None:
        self._process_row = process_row
        self._loop_rows = list(loop_rows) if loop_rows is not None else []
        self._albums = list(albums) if albums is not None else []
        self._run_rows = list(run_rows) if run_rows is not None else []
        self._telemetry_error = telemetry_error
        self._runs_error = runs_error
        self._in_failed_tx = False
        self.rollback_calls = 0
        self.last_runs_sql: str | None = None
        self.last_runs_params: dict[str, Any] = {}

    def execute(self, statement: Any, *args: Any, **kwargs: Any) -> FakeResult:
        if self._in_failed_tx:
            raise ProgrammingError(
                str(statement),
                {},
                psycopg.errors.InFailedSqlTransaction(
                    "current transaction is aborted, commands ignored until end of transaction block"
                ),
            )

        compiled = statement.compile(dialect=postgresql.dialect())
        sql = str(compiled)
        params = dict(compiled.params)

        if "FROM pipeline_process_status" in sql:
            if self._telemetry_error is not None:
                self._in_failed_tx = True
                raise self._telemetry_error
            return FakeResult(scalar_item=self._process_row)

        if "FROM pipeline_loop_states" in sql:
            if self._telemetry_error is not None:
                self._in_failed_tx = True
                raise self._telemetry_error
            return FakeResult(scalar_items=self._loop_rows)

        if "FROM pipeline_runs" in sql:
            self.last_runs_sql = sql
            self.last_runs_params = params
            if self._runs_error is not None:
                self._in_failed_tx = True
                raise self._runs_error
            if self._telemetry_error is not None:
                self._in_failed_tx = True
                raise self._telemetry_error

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

            return FakeResult(scalar_items=rows)

        if "FROM albums" in sql:
            return FakeResult(scalar_items=self._albums)

        return FakeResult()

    def rollback(self) -> None:
        self.rollback_calls += 1
        self._in_failed_tx = False


def make_process_row(
    *,
    now: datetime | None = None,
    status: str = "running",
    run_mode: str = "continuous",
    host: str = "scraper-host-01",
    pid: int = 12345,
    heartbeat_interval_seconds: int = 30,
    started_at: datetime | None = None,
    last_heartbeat_at: datetime | None = None,
    stopped_at: datetime | None = None,
) -> SimpleNamespace:
    """Build a synthetic PipelineProcessStatus row for admin tests."""
    ref_now = now or datetime.now(timezone.utc)
    return SimpleNamespace(
        process_name="default",
        status=status,
        run_mode=run_mode,
        host=host,
        pid=pid,
        heartbeat_interval_seconds=heartbeat_interval_seconds,
        started_at=started_at if started_at is not None else ref_now - timedelta(hours=1),
        last_heartbeat_at=(
            last_heartbeat_at if last_heartbeat_at is not None else ref_now - timedelta(seconds=10)
        ),
        stopped_at=stopped_at,
    )
