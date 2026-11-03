import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.album_detail import get_album_detail
from backend.services.catalog import get_all_derived_albums


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def sample_album_id(readonly_session):
    albums = get_all_derived_albums(readonly_session)
    assert len(albums) > 0, "No albums found in database"
    return albums[0].album_id


class TestAlbumDetailService:
    def test_get_album_detail_valid_album(self, readonly_session, sample_album_id):
        now = datetime(2026, 10, 31, 15, 30, 0, tzinfo=timezone.utc)
        detail = get_album_detail(readonly_session, album_id=sample_album_id, window="24H", now=now)

        assert detail is not None
        assert detail.album_id == sample_album_id
        assert detail.album_title
        assert detail.combined_artist
        assert detail.monogram_key == sample_album_id
        assert detail.window == "24H"

        # Artist chips resolved from album_artists
        assert len(detail.album.artists) >= 1
        for art in detail.album.artists:
            assert art.artist_id
            assert art.name

        # Hero KPIs
        hero = detail.hero_kpi
        assert 0 <= hero.hype_index <= 100
        assert hero.tier in ("high", "moderate", "low")
        assert hero.hype_velocity >= 0.0
        assert hero.release_count >= 1
        assert hero.points_gain >= 0
        assert hero.total_score >= 0
        assert hero.total_comments >= 0

        # Time series buckets (24H => 24 buckets)
        assert len(detail.time_series) == 24
        for b in detail.time_series:
            assert b.cumulative_points >= 0
            assert b.velocity_pts_per_hr >= 0.0
            assert b.points >= 0
            assert b.velocity >= 0.0
            assert b.timestamp is not None
            assert b.bucket_start < b.bucket_end

        # Share of demand
        assert len(detail.share_of_demand) == hero.release_count
        total_share = sum(s.share_percentage for s in detail.share_of_demand)
        assert round(total_share, 1) == 100.0

        # Child releases comparison matrix
        assert len(detail.child_releases) == hero.release_count
        for cr in detail.child_releases:
            assert cr.release_id
            assert 0 <= cr.hype_index <= 100
            assert cr.tier in ("high", "moderate", "low")
            assert cr.hype_velocity >= 0.0
            assert cr.submission_count >= 0

    def test_get_album_detail_7d_window(self, readonly_session, sample_album_id):
        now = datetime(2026, 10, 31, 15, 30, 0, tzinfo=timezone.utc)
        detail = get_album_detail(readonly_session, album_id=sample_album_id, window="7D", now=now)

        assert detail is not None
        assert detail.window == "7D"
        # 7D => 28 buckets * 6 hours
        assert len(detail.time_series) == 28

    def test_get_album_detail_1m_window(self, readonly_session, sample_album_id):
        now = datetime(2026, 10, 31, 15, 30, 0, tzinfo=timezone.utc)
        detail = get_album_detail(readonly_session, album_id=sample_album_id, window="1M", now=now)

        assert detail is not None
        assert detail.window == "1M"
        # 1M => 30 buckets * 24 hours
        assert len(detail.time_series) == 30

    def test_get_album_detail_nonexistent_returns_none(self, readonly_session):
        detail = get_album_detail(readonly_session, album_id="deadbeefdeadbeef")
        assert detail is None

    def test_get_album_detail_valid_uuid_nonexistent_returns_none(self, readonly_session):
        fake_uuid = str(uuid.uuid4())
        detail = get_album_detail(readonly_session, album_id=fake_uuid)
        assert detail is None

    def test_get_album_detail_fallback_dates_when_no_submissions(self, readonly_session, sample_album_id, monkeypatch):
        orig_execute = readonly_session.execute

        def mock_execute(statement, *args, **kwargs):
            query_str = str(statement)
            if "FROM submission_releases" in query_str:
                mock_result = type("MockResult", (), {"fetchall": lambda self: []})()
                return mock_result
            return orig_execute(statement, *args, **kwargs)

        monkeypatch.setattr(readonly_session, "execute", mock_execute)
        detail = get_album_detail(readonly_session, album_id=sample_album_id)
        assert detail is not None
        assert detail.hero_kpi.submission_count == 0
        assert detail.first_seen_at is not None
        assert detail.last_seen_at is not None
        assert detail.first_seen_at == detail.last_seen_at


class TestAlbumDetailAPI:
    def test_api_get_album_default_window(self, client, sample_album_id):
        res = client.get(f"/api/v1/albums/{sample_album_id}")
        assert res.status_code == 200
        data = res.json()

        assert data["album_id"] == sample_album_id
        assert data["window"] == "24H"
        assert "album" in data
        assert "hero_kpi" in data
        assert "time_series" in data
        assert "submission_markers" in data
        assert "share_of_demand" in data
        assert "child_releases" in data

        assert len(data["time_series"]) == 24
        assert len(data["child_releases"]) >= 1

        # Check artists in album identity
        assert len(data["album"]["artists"]) >= 1
        for art in data["album"]["artists"]:
            assert art["artist_id"]
            assert art["name"]

    def test_api_get_album_7d_window(self, client, sample_album_id):
        res = client.get(f"/api/v1/albums/{sample_album_id}?window=7D")
        assert res.status_code == 200
        data = res.json()
        assert data["window"] == "7D"
        assert len(data["time_series"]) == 28

    def test_api_get_album_1m_window(self, client, sample_album_id):
        res = client.get(f"/api/v1/albums/{sample_album_id}?window=1M")
        assert res.status_code == 200
        data = res.json()
        assert data["window"] == "1M"
        assert len(data["time_series"]) == 30

    def test_api_get_album_not_found(self, client):
        res = client.get("/api/v1/albums/nonexistent123456")
        assert res.status_code == 404
        assert res.json()["detail"] == "Album not found"

    def test_api_get_album_valid_uuid_not_found(self, client):
        fake_uuid = str(uuid.uuid4())
        res = client.get(f"/api/v1/albums/{fake_uuid}")
        assert res.status_code == 404
        assert res.json()["detail"] == "Album not found"

    def test_api_get_album_invalid_window_rejected(self, client, sample_album_id):
        res = client.get(f"/api/v1/albums/{sample_album_id}?window=INVALID")
        assert res.status_code == 422
