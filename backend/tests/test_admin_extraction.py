"""HTTP seam tests for Extraction Queue visibility on GET /api/v1/admin/pipeline (#43)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import psycopg.errors
from admin_test_helpers import FakeResult, make_process_row, parse_iso
from fastapi.testclient import TestClient
from reddit_scrape.models import Submission
from sqlalchemy import create_engine
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.api.admin import get_utc_now
from backend.db import get_db
from backend.main import app


class _HybridSubmissionSession:
    """Executes real SQLAlchemy queries against an in-memory SQLite submissions table,
    while allowing deterministic telemetry table simulation (healthy, empty, or UndefinedTable).
    """

    def __init__(
        self,
        sqlite_session: Session,
        *,
        process_row: Any = None,
        loop_rows: list[Any] | None = None,
        telemetry_error: Exception | None = None,
    ) -> None:
        self._sqlite_session = sqlite_session
        self._process_row = process_row
        self._loop_rows = loop_rows if loop_rows is not None else []
        self._telemetry_error = telemetry_error
        self.rollback_calls = 0
        self._aborted = False

    def execute(self, statement: Any, *args: Any, **kwargs: Any) -> Any:
        if self._aborted:
            raise RuntimeError("InFailedSqlTransaction: session was not rolled back after error")

        sql = str(statement)
        if "pipeline_process_status" in sql:
            if self._telemetry_error is not None:
                self._aborted = True
                raise self._telemetry_error
            return FakeResult(scalar_item=self._process_row)
        if "pipeline_loop_states" in sql:
            if self._telemetry_error is not None:
                self._aborted = True
                raise self._telemetry_error
            return FakeResult(scalar_items=self._loop_rows)
        if "pipeline_runs" in sql:
            if self._telemetry_error is not None:
                self._aborted = True
                raise self._telemetry_error
            return FakeResult(scalar_items=[])
        if "FROM albums" in sql:
            return FakeResult(scalar_items=[])
        return self._sqlite_session.execute(statement, *args, **kwargs)

    def rollback(self) -> None:
        self.rollback_calls += 1
        self._aborted = False
        self._sqlite_session.rollback()


def _create_sqlite_submissions_session(submissions: list[Submission]) -> Session:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Submission.__table__.create(bind=engine)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()
    if submissions:
        session.add_all(submissions)
        session.commit()
    return session


def _make_submission(
    *,
    sub_id: str,
    title: str,
    created_utc: datetime,
    ingested_at: datetime,
    is_extracted: bool,
    is_release: bool,
    flair: str | None = "PRE-ORDER",
    url: str | None = None,
) -> Submission:
    return Submission(
        id=sub_id,
        reddit_id=sub_id.replace("t3_", ""),
        title=title,
        url=url or f"https://reddit.com/r/vinylreleases/comments/{sub_id}",
        flair=flair,
        latest_score=42,
        latest_upvote_ratio=0.95,
        latest_num_comments=7,
        created_utc=created_utc,
        is_extracted=is_extracted,
        is_release=is_release,
        created_at=ingested_at,
        updated_at=ingested_at,
    )


def test_extraction_queue_counts_completion_and_oldest_first_pending_items() -> None:
    """GET /api/v1/admin/pipeline returns exact Extraction Queue counts and oldest-first pending rows."""
    fixed_now = datetime(2026, 11, 27, 12, 0, 0, tzinfo=timezone.utc)
    oldest_time = fixed_now - timedelta(hours=3)
    middle_time = fixed_now - timedelta(hours=1, minutes=30)
    newest_time = fixed_now - timedelta(minutes=15)

    submissions = [
        # Pending release-eligible items (intentionally inserted out of order)
        _make_submission(
            sub_id="t3_pend_new",
            title="Newest Pending Vinyl",
            created_utc=newest_time,
            ingested_at=newest_time + timedelta(minutes=2),
            is_extracted=False,
            is_release=True,
            flair=None,
            url="https://example.com/new",
        ),
        _make_submission(
            sub_id="t3_pend_old",
            title="Oldest Stuck Vinyl",
            created_utc=oldest_time,
            ingested_at=oldest_time + timedelta(minutes=5),
            is_extracted=False,
            is_release=True,
            flair="PRE-ORDER",
            url="https://example.com/old",
        ),
        _make_submission(
            sub_id="t3_pend_mid",
            title="Middle Pending Vinyl",
            created_utc=middle_time,
            ingested_at=middle_time + timedelta(minutes=1),
            is_extracted=False,
            is_release=True,
            flair="RESTOCK",
            url="https://example.com/mid",
        ),
        # Extracted releases (2)
        _make_submission(
            sub_id="t3_ext_1",
            title="Extracted Release 1",
            created_utc=fixed_now - timedelta(days=1),
            ingested_at=fixed_now - timedelta(days=1),
            is_extracted=True,
            is_release=True,
        ),
        _make_submission(
            sub_id="t3_ext_2",
            title="Extracted Release 2",
            created_utc=fixed_now - timedelta(days=2),
            ingested_at=fixed_now - timedelta(days=2),
            is_extracted=True,
            is_release=True,
        ),
        # Filtered non-releases (1)
        _make_submission(
            sub_id="t3_filt_1",
            title="[DISCUSSION] Weekly thread",
            created_utc=fixed_now - timedelta(days=1),
            ingested_at=fixed_now - timedelta(days=1),
            is_extracted=True,
            is_release=False,
            flair="DISCUSSION",
        ),
        # Unextracted non-release (must be excluded from counts & pending list)
        _make_submission(
            sub_id="t3_ignored",
            title="Unextracted non-release noise",
            created_utc=fixed_now - timedelta(days=10),
            ingested_at=fixed_now - timedelta(days=10),
            is_extracted=False,
            is_release=False,
        ),
    ]

    sqlite_session = _create_sqlite_submissions_session(submissions)
    hybrid_session = _HybridSubmissionSession(sqlite_session)
    client = TestClient(app)

    app.dependency_overrides[get_db] = lambda: hybrid_session
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        response = client.get("/api/v1/admin/pipeline")
    finally:
        app.dependency_overrides.clear()
        sqlite_session.close()

    assert response.status_code == 200
    eq = response.json()["extraction_queue"]
    assert eq is not None
    assert eq["pending"] == 3
    assert eq["extracted_releases"] == 2
    assert eq["filtered_non_releases"] == 1
    assert eq["total"] == 6
    assert eq["completion_pct"] == 50.0
    assert parse_iso(eq["oldest_pending_at"]) == oldest_time

    items = eq["pending_items"]
    assert [item["id"] for item in items] == ["t3_pend_old", "t3_pend_mid", "t3_pend_new"]
    assert items[0] == {
        "id": "t3_pend_old",
        "title": "Oldest Stuck Vinyl",
        "flair": "PRE-ORDER",
        "url": "https://example.com/old",
        "created_utc": oldest_time.isoformat().replace("+00:00", "Z"),
        "ingested_at": (oldest_time + timedelta(minutes=5)).isoformat().replace("+00:00", "Z"),
    }
    assert items[2]["flair"] is None


def test_extraction_queue_caps_pending_items_at_25_oldest_first_with_tie_breaker() -> None:
    """When >25 submissions are pending, pending count reflects all rows while pending_items caps at 25 oldest."""
    fixed_now = datetime(2026, 11, 27, 12, 0, 0, tzinfo=timezone.utc)
    base_time = fixed_now - timedelta(hours=5)

    submissions: list[Submission] = []
    # Two oldest items with identical created_utc to confirm deterministic id ASC tie-breaker
    submissions.append(
        _make_submission(
            sub_id="t3_tie_b",
            title="Tie B",
            created_utc=base_time,
            ingested_at=base_time + timedelta(seconds=10),
            is_extracted=False,
            is_release=True,
        )
    )
    submissions.append(
        _make_submission(
            sub_id="t3_tie_a",
            title="Tie A",
            created_utc=base_time,
            ingested_at=base_time + timedelta(seconds=5),
            is_extracted=False,
            is_release=True,
        )
    )
    # 28 newer pending submissions -> 30 pending total
    for idx in range(28):
        created = base_time + timedelta(minutes=idx + 1)
        submissions.append(
            _make_submission(
                sub_id=f"t3_item_{idx:02d}",
                title=f"Pending Vinyl #{idx:02d}",
                created_utc=created,
                ingested_at=created + timedelta(seconds=30),
                is_extracted=False,
                is_release=True,
            )
        )

    sqlite_session = _create_sqlite_submissions_session(submissions)
    hybrid_session = _HybridSubmissionSession(sqlite_session)
    client = TestClient(app)

    app.dependency_overrides[get_db] = lambda: hybrid_session
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        response = client.get("/api/v1/admin/pipeline")
    finally:
        app.dependency_overrides.clear()
        sqlite_session.close()

    assert response.status_code == 200
    eq = response.json()["extraction_queue"]
    assert eq["pending"] == 30
    assert eq["total"] == 30
    assert eq["completion_pct"] == 0.0
    assert parse_iso(eq["oldest_pending_at"]) == base_time

    items = eq["pending_items"]
    assert len(items) == 25
    assert items[0]["id"] == "t3_tie_a"
    assert items[1]["id"] == "t3_tie_b"
    assert items[2]["id"] == "t3_item_00"
    assert items[-1]["id"] == "t3_item_22"


def test_extraction_queue_empty_and_completed_states() -> None:
    """Empty table yields 0.0% and None lag; fully extracted table yields 100.0% and empty pending_items."""
    fixed_now = datetime(2026, 11, 27, 12, 0, 0, tzinfo=timezone.utc)
    client = TestClient(app)

    # Empty catalog
    empty_sqlite = _create_sqlite_submissions_session([])
    app.dependency_overrides[get_db] = lambda: _HybridSubmissionSession(empty_sqlite)
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        empty_resp = client.get("/api/v1/admin/pipeline")
    finally:
        app.dependency_overrides.clear()
        empty_sqlite.close()

    assert empty_resp.status_code == 200
    empty_eq = empty_resp.json()["extraction_queue"]
    assert empty_eq == {
        "pending": 0,
        "extracted_releases": 0,
        "filtered_non_releases": 0,
        "total": 0,
        "completion_pct": 0.0,
        "oldest_pending_at": None,
        "pending_items": [],
    }

    # Fully extracted catalog (0 pending)
    done_subs = [
        _make_submission(
            sub_id="t3_done_1",
            title="Done Release",
            created_utc=fixed_now - timedelta(hours=2),
            ingested_at=fixed_now - timedelta(hours=2),
            is_extracted=True,
            is_release=True,
        ),
        _make_submission(
            sub_id="t3_done_2",
            title="Done Filtered",
            created_utc=fixed_now - timedelta(hours=1),
            ingested_at=fixed_now - timedelta(hours=1),
            is_extracted=True,
            is_release=False,
        ),
    ]
    done_sqlite = _create_sqlite_submissions_session(done_subs)
    app.dependency_overrides[get_db] = lambda: _HybridSubmissionSession(done_sqlite)
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        done_resp = client.get("/api/v1/admin/pipeline")
    finally:
        app.dependency_overrides.clear()
        done_sqlite.close()

    assert done_resp.status_code == 200
    done_eq = done_resp.json()["extraction_queue"]
    assert done_eq["pending"] == 0
    assert done_eq["extracted_releases"] == 1
    assert done_eq["filtered_non_releases"] == 1
    assert done_eq["total"] == 2
    assert done_eq["completion_pct"] == 100.0
    assert done_eq["oldest_pending_at"] is None
    assert done_eq["pending_items"] == []


def test_extraction_queue_populated_both_when_telemetry_healthy_and_missing() -> None:
    """Extraction Queue populates accurately with healthy, empty, and missing telemetry tables."""
    fixed_now = datetime(2026, 11, 27, 12, 0, 0, tzinfo=timezone.utc)
    oldest = fixed_now - timedelta(minutes=45)

    def make_submissions() -> list[Submission]:
        return [
            _make_submission(
                sub_id="t3_degraded_pending",
                title="Pending During Outage",
                created_utc=oldest,
                ingested_at=oldest + timedelta(seconds=20),
                is_extracted=False,
                is_release=True,
                flair="NEW RELEASE",
            ),
            _make_submission(
                sub_id="t3_degraded_done",
                title="Already Extracted",
                created_utc=fixed_now - timedelta(hours=4),
                ingested_at=fixed_now - timedelta(hours=4),
                is_extracted=True,
                is_release=True,
            ),
        ]

    process_row = make_process_row(now=fixed_now, pid=2222)

    client = TestClient(app)

    # 1) Healthy telemetry
    sqlite_healthy = _create_sqlite_submissions_session(make_submissions())
    healthy_session = _HybridSubmissionSession(sqlite_healthy, process_row=process_row)
    app.dependency_overrides[get_db] = lambda: healthy_session
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        healthy_resp = client.get("/api/v1/admin/pipeline")
    finally:
        app.dependency_overrides.clear()
        sqlite_healthy.close()

    assert healthy_resp.status_code == 200
    healthy_data = healthy_resp.json()
    assert healthy_data["telemetry_available"] is True
    assert healthy_data["process"]["effective_status"] == "online"
    assert healthy_data["extraction_queue"]["pending"] == 1
    assert healthy_data["extraction_queue"]["extracted_releases"] == 1
    assert healthy_data["extraction_queue"]["completion_pct"] == 50.0
    assert healthy_data["extraction_queue"]["pending_items"][0]["id"] == "t3_degraded_pending"

    # 2) Missing telemetry tables (UndefinedTable -> rollback -> extraction_queue still succeeds)
    sqlite_missing = _create_sqlite_submissions_session(make_submissions())
    undefined_err = ProgrammingError(
        "SELECT * FROM pipeline_process_status",
        {},
        psycopg.errors.UndefinedTable('relation "pipeline_process_status" does not exist'),
    )
    degraded_session = _HybridSubmissionSession(sqlite_missing, telemetry_error=undefined_err)
    app.dependency_overrides[get_db] = lambda: degraded_session
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        degraded_resp = client.get("/api/v1/admin/pipeline")
    finally:
        app.dependency_overrides.clear()
        sqlite_missing.close()

    assert degraded_resp.status_code == 200
    assert degraded_session.rollback_calls == 1
    degraded_data = degraded_resp.json()
    assert degraded_data["telemetry_available"] is False
    assert degraded_data["process"]["effective_status"] == "unavailable"
    assert degraded_data["extraction_queue"]["pending"] == 1
    assert degraded_data["extraction_queue"]["extracted_releases"] == 1
    assert degraded_data["extraction_queue"]["total"] == 2
    assert degraded_data["extraction_queue"]["completion_pct"] == 50.0
    assert parse_iso(degraded_data["extraction_queue"]["oldest_pending_at"]) == oldest
    assert degraded_data["extraction_queue"]["pending_items"][0]["id"] == "t3_degraded_pending"

    # 3) Empty telemetry table (process_row=None -> telemetry_available=False, extraction_queue intact)
    sqlite_empty_tel = _create_sqlite_submissions_session(make_submissions())
    empty_tel_session = _HybridSubmissionSession(sqlite_empty_tel, process_row=None)
    app.dependency_overrides[get_db] = lambda: empty_tel_session
    app.dependency_overrides[get_utc_now] = lambda: fixed_now
    try:
        empty_tel_resp = client.get("/api/v1/admin/pipeline")
    finally:
        app.dependency_overrides.clear()
        sqlite_empty_tel.close()

    assert empty_tel_resp.status_code == 200
    empty_tel_data = empty_tel_resp.json()
    assert empty_tel_data["telemetry_available"] is False
    assert empty_tel_data["process"]["effective_status"] == "unavailable"
    assert empty_tel_data["extraction_queue"]["pending"] == 1
    assert empty_tel_data["extraction_queue"]["total"] == 2
    assert empty_tel_data["extraction_queue"]["pending_items"][0]["id"] == "t3_degraded_pending"


def test_extraction_queue_live_readonly_postgresql() -> None:
    """GET /api/v1/admin/pipeline populates consistent Extraction Queue metrics over live read-only Postgres."""
    client = TestClient(app)
    response = client.get("/api/v1/admin/pipeline")
    assert response.status_code == 200

    eq = response.json()["extraction_queue"]
    assert eq is not None
    assert eq["pending"] >= 0
    assert eq["extracted_releases"] >= 0
    assert eq["filtered_non_releases"] >= 0
    assert eq["total"] == eq["pending"] + eq["extracted_releases"] + eq["filtered_non_releases"]
    assert 0.0 <= eq["completion_pct"] <= 100.0
    assert len(eq["pending_items"]) <= 25

    created_times = [parse_iso(item["created_utc"]) for item in eq["pending_items"]]
    assert created_times == sorted(created_times)
    if eq["pending_items"]:
        assert parse_iso(eq["oldest_pending_at"]) == created_times[0]
    else:
        assert eq["oldest_pending_at"] is None

