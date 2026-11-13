import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.main import app
from backend.services.artist_detail import get_artist_detail


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def sample_artist_id(readonly_session):
    row = readonly_session.execute(
        text(
            """
            SELECT a.id
            FROM artists a
            JOIN album_artists aa ON a.id = aa.artist_id
            GROUP BY a.id
            HAVING COUNT(aa.album_id) > 0
            LIMIT 1
            """
        )
    ).fetchone()
    assert row is not None, "No artist with albums found in database"
    return str(row.id)


class TestArtistDetailService:
    def test_get_artist_detail_valid_artist(self, readonly_session, sample_artist_id):
        now = datetime(2026, 10, 31, 15, 30, 0, tzinfo=timezone.utc)
        detail = get_artist_detail(readonly_session, artist_id=sample_artist_id, window="24H", now=now)

        assert detail is not None
        assert detail.artist_id == sample_artist_id
        assert detail.name
        assert detail.monogram_key
        assert detail.window == "24H"

        # Artist identity
        assert detail.artist.artist_id == sample_artist_id
        assert detail.artist.name == detail.name

        # Hero KPIs
        hero = detail.hero_kpi
        assert 0 <= hero.hype_index <= 100
        assert hero.tier in ("high", "moderate", "low")
        assert hero.hype_velocity >= 0.0

        # Catalog footprint
        footprint = hero.catalog_footprint
        assert footprint.total_albums >= 1
        assert footprint.solo_album_count >= 0
        assert footprint.combined_album_count >= 0
        assert footprint.total_albums == footprint.solo_album_count + footprint.combined_album_count
        assert footprint.total_releases >= 1

        # Reddit demand
        demand = hero.reddit_demand
        assert demand.total_submissions >= 0
        assert demand.total_score >= 0
        assert demand.total_comments >= 0

        # Tracked Albums matrix
        assert len(detail.tracked_albums) == footprint.total_albums
        for alb in detail.tracked_albums:
            assert alb.album_id
            assert alb.album_title
            assert alb.combined_artist
            assert alb.billing_attribution == "Solo" or alb.billing_attribution.startswith("Combined: ")
            assert alb.release_count >= 1
            assert alb.submission_count >= 0
            assert alb.score >= 0
            assert alb.num_comments >= 0
            assert alb.hype_velocity >= 0.0
            assert 0 <= alb.hype_index <= 100
            assert alb.tier in ("high", "moderate", "low")

        # Child Releases ledger
        assert len(detail.child_releases) == footprint.total_releases
        for rel in detail.child_releases:
            assert rel.release_id
            assert rel.album_id
            assert rel.album_title
            assert rel.submission_count >= 0
            assert rel.score >= 0
            assert rel.num_comments >= 0
            assert rel.hype_velocity >= 0.0
            assert 0 <= rel.hype_index <= 100
            assert rel.tier in ("high", "moderate", "low")

    def test_get_artist_detail_7d_window(self, readonly_session, sample_artist_id):
        now = datetime(2026, 10, 31, 15, 30, 0, tzinfo=timezone.utc)
        detail = get_artist_detail(readonly_session, artist_id=sample_artist_id, window="7D", now=now)

        assert detail is not None
        assert detail.window == "7D"

    def test_get_artist_detail_1m_window(self, readonly_session, sample_artist_id):
        now = datetime(2026, 10, 31, 15, 30, 0, tzinfo=timezone.utc)
        detail = get_artist_detail(readonly_session, artist_id=sample_artist_id, window="1M", now=now)

        assert detail is not None
        assert detail.window == "1M"

    def test_get_artist_detail_nonexistent_returns_none(self, readonly_session):
        fake_id = str(uuid.uuid4())
        detail = get_artist_detail(readonly_session, artist_id=fake_id)
        assert detail is None

    def test_get_artist_detail_invalid_uuid_returns_none(self, readonly_session):
        detail = get_artist_detail(readonly_session, artist_id="not-a-valid-uuid")
        assert detail is None


class TestArtistDetailAPI:
    def test_api_get_artist_default_window(self, client, sample_artist_id):
        res = client.get(f"/api/v1/artists/{sample_artist_id}")
        assert res.status_code == 200
        data = res.json()

        assert data["artist_id"] == sample_artist_id
        assert data["window"] == "24H"
        assert "artist" in data
        assert "hero_kpi" in data
        assert "tracked_albums" in data
        assert "child_releases" in data

    def test_api_get_artist_custom_window(self, client, sample_artist_id):
        res = client.get(f"/api/v1/artists/{sample_artist_id}?window=7D")
        assert res.status_code == 200
        data = res.json()
        assert data["window"] == "7D"

    def test_api_get_artist_404_nonexistent(self, client):
        fake_id = str(uuid.uuid4())
        res = client.get(f"/api/v1/artists/{fake_id}")
        assert res.status_code == 404
        assert res.json()["detail"] == "Artist not found"

    def test_api_get_artist_404_invalid_uuid(self, client):
        res = client.get("/api/v1/artists/invalid-id")
        assert res.status_code == 404
