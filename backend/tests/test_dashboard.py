from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.hype import get_dashboard_data


@pytest.fixture
def client():
    return TestClient(app)


class TestDashboardService:
    def test_dashboard_service_computes_data(self, readonly_session):
        # Test get_dashboard_data against read-only database
        now = datetime(2026, 10, 31, 15, 30, 0, tzinfo=timezone.utc)
        data = get_dashboard_data(readonly_session, window="24H", now=now)

        assert data.window == "24H"
        assert len(data.top_albums) <= 5
        assert len(data.top_releases) <= 5
        assert len(data.newly_added) <= 5
        assert len(data.live_feed) >= 1

        # Check top_albums schema
        if data.top_albums:
            top_a = data.top_albums[0]
            assert top_a.album_id
            assert top_a.album_title
            assert top_a.combined_artist
            assert 0 <= top_a.hype_index <= 100
            assert top_a.hype_velocity >= 0.0
            assert top_a.tier in ("high", "moderate", "low")
            assert top_a.release_count >= 1
            assert top_a.monogram_key

        # Check top_releases schema
        if data.top_releases:
            top_r = data.top_releases[0]
            assert top_r.release_id
            assert top_r.album_id
            assert top_r.album_title
            assert top_r.combined_artist
            assert 0 <= top_r.hype_index <= 100
            assert top_r.hype_velocity >= 0.0
            assert top_r.tier in ("high", "moderate", "low")
            assert top_r.monogram_key

        # Check newly_added
        if data.newly_added:
            new_r = data.newly_added[0]
            assert new_r.release_id
            assert new_r.first_seen_at <= now

        # Check live_feed
        feed_item = data.live_feed[0]
        assert feed_item.release_id
        assert feed_item.album_id
        assert feed_item.album_title
        assert feed_item.combined_artist
        assert 0 <= feed_item.hype_index <= 100
        assert feed_item.hype_velocity >= 0.0
        assert feed_item.tier in ("high", "moderate", "low")
        assert feed_item.score >= 0
        assert feed_item.num_comments >= 0
        assert feed_item.posted_at


class TestDashboardAPI:
    def test_get_dashboard_default_window(self, client):
        res = client.get("/api/v1/dashboard")
        assert res.status_code == 200
        json_data = res.json()
        assert json_data["window"] == "24H"
        assert "top_albums" in json_data
        assert "top_releases" in json_data
        assert "newly_added" in json_data
        assert "live_feed" in json_data
        assert len(json_data["top_albums"]) <= 5
        assert len(json_data["top_releases"]) <= 5
        assert len(json_data["newly_added"]) <= 5

    def test_get_dashboard_7d_window(self, client):
        res = client.get("/api/v1/dashboard?window=7D")
        assert res.status_code == 200
        json_data = res.json()
        assert json_data["window"] == "7D"

    def test_get_dashboard_1m_window(self, client):
        res = client.get("/api/v1/dashboard?window=1M")
        assert res.status_code == 200
        json_data = res.json()
        assert json_data["window"] == "1M"

    def test_get_dashboard_invalid_window_rejected(self, client):
        res = client.get("/api/v1/dashboard?window=INVALID")
        assert res.status_code == 422
