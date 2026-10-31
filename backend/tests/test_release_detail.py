import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.main import app
from backend.services.release_detail import get_release_detail


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def sample_release_id(readonly_session):
    row = readonly_session.execute(
        text("SELECT id FROM releases ORDER BY created_at ASC LIMIT 1")
    ).fetchone()
    assert row is not None, "No releases found in database"
    return str(row.id)


class TestReleaseDetailService:
    def test_get_release_detail_valid_release(self, readonly_session, sample_release_id):
        now = datetime(2026, 10, 31, 15, 30, 0, tzinfo=timezone.utc)
        detail = get_release_detail(readonly_session, release_id=sample_release_id, window="24H", now=now)

        assert detail is not None
        assert detail.release_id == sample_release_id
        assert detail.album_id
        assert detail.album_title
        assert detail.combined_artist
        assert detail.variant is not None
        assert detail.retailer_name is not None
        assert detail.monogram_key
        assert detail.window == "24H"

        # Physical specs
        specs = detail.specs
        assert specs.release_id == sample_release_id
        assert specs.album_id == detail.album_id
        assert specs.album_title == detail.album_title
        assert specs.combined_artist == detail.combined_artist
        assert specs.variant
        assert specs.retailer_name

        # Parent album info
        parent = detail.parent_album
        assert parent.album_id == detail.album_id
        assert parent.album_title == detail.album_title
        assert parent.release_count >= 1

        # Hero KPIs
        hero = detail.hero_kpi
        assert 0 <= hero.hype_index <= 100
        assert hero.tier in ("high", "moderate", "low")
        assert hero.hype_velocity >= 0.0
        assert hero.submission_engagement.submission_count >= 0
        assert hero.submission_engagement.total_score >= 0
        assert hero.submission_engagement.total_comments >= 0
        assert hero.submission_engagement.points_gain >= 0
        assert hero.provenance_summary.linked_submissions_count >= 0

        # Time series buckets (24H => 24 buckets)
        assert len(detail.time_series) == 24
        for b in detail.time_series:
            assert b.cumulative_points >= 0
            assert b.velocity_pts_per_hr >= 0.0
            assert b.points >= 0
            assert b.velocity >= 0.0
            assert b.bucket_start < b.bucket_end

        # Submissions provenance list
        for sub in detail.submissions:
            assert sub.submission_id.startswith("t3_") or len(sub.submission_id) > 0
            assert sub.title
            assert sub.created_utc is not None
            assert sub.latest_score >= 0
            assert sub.latest_upvote_ratio >= 0.0
            assert sub.latest_num_comments >= 0
            assert sub.window_velocity >= 0.0
            assert sub.url.startswith("http")

    def test_get_release_detail_7d_window(self, readonly_session, sample_release_id):
        now = datetime(2026, 10, 31, 15, 30, 0, tzinfo=timezone.utc)
        detail = get_release_detail(readonly_session, release_id=sample_release_id, window="7D", now=now)

        assert detail is not None
        assert detail.window == "7D"
        assert len(detail.time_series) == 28

    def test_get_release_detail_1m_window(self, readonly_session, sample_release_id):
        now = datetime(2026, 10, 31, 15, 30, 0, tzinfo=timezone.utc)
        detail = get_release_detail(readonly_session, release_id=sample_release_id, window="1M", now=now)

        assert detail is not None
        assert detail.window == "1M"
        assert len(detail.time_series) == 30

    def test_get_release_detail_nonexistent_returns_none(self, readonly_session):
        fake_id = str(uuid.uuid4())
        detail = get_release_detail(readonly_session, release_id=fake_id)
        assert detail is None

    def test_get_release_detail_invalid_uuid_returns_none(self, readonly_session):
        detail = get_release_detail(readonly_session, release_id="not-a-valid-uuid")
        assert detail is None


class TestReleaseDetailAPI:
    def test_api_get_release_default_window(self, client, sample_release_id):
        res = client.get(f"/api/v1/releases/{sample_release_id}")
        assert res.status_code == 200
        data = res.json()

        assert data["release_id"] == sample_release_id
        assert data["window"] == "24H"
        assert "specs" in data
        assert "parent_album" in data
        assert "hero_kpi" in data
        assert "time_series" in data
        assert "submissions" in data

    def test_api_get_release_custom_window(self, client, sample_release_id):
        res = client.get(f"/api/v1/releases/{sample_release_id}?window=7D")
        assert res.status_code == 200
        data = res.json()
        assert data["window"] == "7D"
        assert len(data["time_series"]) == 28

    def test_api_get_release_404_nonexistent(self, client):
        fake_id = str(uuid.uuid4())
        res = client.get(f"/api/v1/releases/{fake_id}")
        assert res.status_code == 404
        assert res.json()["detail"] == "Release not found"

    def test_api_get_release_404_invalid_uuid(self, client):
        res = client.get("/api/v1/releases/invalid-id")
        assert res.status_code == 404
