import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.main import app
from backend.services.dashboard import get_dashboard_data


@pytest.fixture
def client():
    return TestClient(app)


class TestDashboardService:
    def test_dashboard_service_computes_data(self, readonly_session):
        # Test get_dashboard_data against read-only database
        now = datetime(2026, 11, 3, 16, 0, 0, tzinfo=timezone.utc)
        data = get_dashboard_data(readonly_session, window="24H", now=now)

        assert data.window == "24H"
        assert len(data.top_albums) <= 5
        assert len(data.top_releases) <= 5
        assert len(data.newly_added) <= 5
        assert len(data.live_feed) >= 1

        # Check top_albums schema and UUID identity
        if data.top_albums:
            top_a = data.top_albums[0]
            assert top_a.album_id
            parsed_album_uuid = uuid.UUID(top_a.album_id)
            assert str(parsed_album_uuid) == top_a.album_id
            assert top_a.monogram_key == top_a.album_id
            assert top_a.album_title
            assert top_a.combined_artist
            assert 0 <= top_a.hype_index <= 100
            assert top_a.hype_velocity >= 0.0
            assert top_a.tier in ("high", "moderate", "low")
            assert top_a.release_count >= 1
            assert top_a.submission_count >= 0

            # Verify persisted entity in albums table
            alb_row = readonly_session.execute(
                text("SELECT id, title, combined_artist FROM albums WHERE id = :id"),
                {"id": parsed_album_uuid},
            ).fetchone()
            assert alb_row is not None
            assert alb_row.title == top_a.album_title
            assert alb_row.combined_artist == top_a.combined_artist

        # Check top_releases schema and UUID links
        if data.top_releases:
            top_r = data.top_releases[0]
            assert top_r.release_id
            uuid.UUID(top_r.release_id)
            assert top_r.album_id
            parsed_rel_album_uuid = uuid.UUID(top_r.album_id)
            assert top_r.album_title
            assert top_r.combined_artist
            assert 0 <= top_r.hype_index <= 100
            assert top_r.hype_velocity >= 0.0
            assert top_r.tier in ("high", "moderate", "low")
            assert top_r.monogram_key

            # Verify parent album link in albums table
            parent_alb = readonly_session.execute(
                text("SELECT id, title, combined_artist FROM albums WHERE id = :id"),
                {"id": parsed_rel_album_uuid},
            ).fetchone()
            assert parent_alb is not None
            assert parent_alb.title == top_r.album_title
            assert parent_alb.combined_artist == top_r.combined_artist

        # Check newly_added
        if data.newly_added:
            new_r = data.newly_added[0]
            assert new_r.release_id
            uuid.UUID(new_r.release_id)
            uuid.UUID(new_r.album_id)
            assert new_r.first_seen_at <= now
            assert new_r.latest_score >= 0
            assert 0 <= new_r.hype_index <= 100

        # Check live_feed
        feed_item = data.live_feed[0]
        assert feed_item.release_id
        uuid.UUID(feed_item.release_id)
        assert feed_item.album_id
        uuid.UUID(feed_item.album_id)
        assert feed_item.album_title
        assert feed_item.combined_artist
        assert 0 <= feed_item.hype_index <= 100
        assert feed_item.hype_velocity >= 0.0
        assert feed_item.tier in ("high", "moderate", "low")
        assert feed_item.score >= 0
        assert feed_item.num_comments >= 0
        assert feed_item.posted_at

    def test_dashboard_service_windows(self, readonly_session):
        now = datetime(2026, 11, 3, 16, 0, 0, tzinfo=timezone.utc)
        for w in ("7D", "1M"):
            data = get_dashboard_data(readonly_session, window=w, now=now)
            assert data.window == w
            for alb in data.top_albums:
                alb_uuid = uuid.UUID(alb.album_id)
                assert str(alb_uuid) == alb.album_id
                assert alb.monogram_key == alb.album_id
            for rel in data.top_releases:
                uuid.UUID(rel.release_id)
                uuid.UUID(rel.album_id)
            for feed_item in data.live_feed:
                uuid.UUID(feed_item.release_id)
                uuid.UUID(feed_item.album_id)


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

        # Verify UUID format in API response
        for alb in json_data["top_albums"]:
            uuid.UUID(alb["album_id"])
            assert alb["monogram_key"] == alb["album_id"]
        for rel in json_data["top_releases"]:
            uuid.UUID(rel["release_id"])
            uuid.UUID(rel["album_id"])
        for feed in json_data["live_feed"]:
            uuid.UUID(feed["release_id"])
            uuid.UUID(feed["album_id"])

    def test_get_dashboard_7d_window(self, client):
        res = client.get("/api/v1/dashboard?window=7D")
        assert res.status_code == 200
        json_data = res.json()
        assert json_data["window"] == "7D"
        for alb in json_data["top_albums"]:
            uuid.UUID(alb["album_id"])

    def test_get_dashboard_1m_window(self, client):
        res = client.get("/api/v1/dashboard?window=1M")
        assert res.status_code == 200
        json_data = res.json()
        assert json_data["window"] == "1M"
        for alb in json_data["top_albums"]:
            uuid.UUID(alb["album_id"])

    def test_get_dashboard_invalid_window_rejected(self, client):
        res = client.get("/api/v1/dashboard?window=INVALID")
        assert res.status_code == 422
