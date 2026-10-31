from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.directory import (
    get_directory_albums,
    get_directory_artists,
    get_directory_counts,
    get_directory_releases,
    get_directory_retailers,
)


@pytest.fixture
def client():
    return TestClient(app)


class TestDirectoryServiceUnit:
    """Unit tests for directory service logic against read-only test database."""

    def test_get_directory_releases_pagination_and_sorting(self, readonly_session):
        now = datetime(2026, 10, 31, 15, 30, 0, tzinfo=timezone.utc)
        result_p1 = get_directory_releases(
            readonly_session,
            window="24H",
            page=1,
            page_size=10,
            sort="hype_index",
            order="desc",
            now=now,
        )
        assert result_p1.page == 1
        assert result_p1.page_size == 10
        assert result_p1.total_items >= 50
        assert result_p1.total_pages == (result_p1.total_items + 9) // 10
        assert len(result_p1.items) == 10

        # Verify sorted descending by hype_index
        indices = [item.hype_index for item in result_p1.items]
        assert indices == sorted(indices, reverse=True)

        # Page 2 should not duplicate page 1 items
        result_p2 = get_directory_releases(
            readonly_session,
            window="24H",
            page=2,
            page_size=10,
            sort="hype_index",
            order="desc",
            now=now,
        )
        assert result_p2.page == 2
        p1_ids = {item.release_id for item in result_p1.items}
        p2_ids = {item.release_id for item in result_p2.items}
        assert p1_ids.isdisjoint(p2_ids)

    def test_get_directory_releases_filters(self, readonly_session):
        now = datetime(2026, 10, 31, 15, 30, 0, tzinfo=timezone.utc)
        
        # Test retailer filter (excluding nulls)
        retailers = get_directory_retailers(readonly_session)
        assert len(retailers) > 0
        target_retailer = retailers[0]
        
        filtered = get_directory_releases(
            readonly_session,
            window="24H",
            retailer=target_retailer,
            now=now,
        )
        assert filtered.total_items > 0
        for item in filtered.items:
            assert item.retailer_name == target_retailer

        # Test tier filter
        for tier in ["high", "moderate", "low"]:
            tier_res = get_directory_releases(
                readonly_session,
                window="24H",
                tier=tier,
                now=now,
            )
            for item in tier_res.items:
                assert item.tier == tier

        # Test search query filter
        sample_title = "Spirit"
        search_res = get_directory_releases(readonly_session, window="24H", q=sample_title, now=now)
        assert search_res.total_items > 0
        for item in search_res.items:
            q_lower = sample_title.strip().lower()
            matches = (
                q_lower in item.album_title.lower()
                or q_lower in item.combined_artist.lower()
                or (item.variant is not None and q_lower in item.variant.lower())
                or (item.retailer_name is not None and q_lower in item.retailer_name.lower())
            )
            assert matches

    def test_get_directory_albums(self, readonly_session):
        now = datetime(2026, 10, 31, 15, 30, 0, tzinfo=timezone.utc)
        result = get_directory_albums(
            readonly_session,
            window="24H",
            page=1,
            page_size=20,
            sort="hype_index",
            order="desc",
            now=now,
        )
        assert result.page == 1
        assert result.total_items >= 40
        assert len(result.items) > 0

        first_album = result.items[0]
        assert first_album.album_id
        assert first_album.album_title
        assert first_album.combined_artist
        assert first_album.release_count >= 1
        assert isinstance(first_album.preview_variants, list)
        assert isinstance(first_album.retailers, list)
        assert 0 <= first_album.hype_index <= 100
        assert first_album.tier in ("high", "moderate", "low")

    def test_get_directory_artists(self, readonly_session):
        now = datetime(2026, 10, 31, 15, 30, 0, tzinfo=timezone.utc)
        result = get_directory_artists(
            readonly_session,
            window="24H",
            page=1,
            page_size=20,
            sort="hype_index",
            order="desc",
            now=now,
        )
        assert result.page == 1
        assert result.total_items >= 35
        assert len(result.items) > 0

        first_artist = result.items[0]
        assert first_artist.artist_id
        assert first_artist.name
        assert first_artist.solo_album_count >= 0
        assert first_artist.combined_album_count >= 0
        assert first_artist.release_count >= 0
        assert 0 <= first_artist.hype_index <= 100
        assert first_artist.tier in ("high", "moderate", "low")

    def test_get_directory_retailers(self, readonly_session):
        retailers = get_directory_retailers(readonly_session)
        assert isinstance(retailers, list)
        assert len(retailers) > 0
        # No None, empty string, or duplicates
        assert all(isinstance(r, str) and len(r.strip()) > 0 for r in retailers)
        assert len(retailers) == len(set(retailers))
        # Alphabetical sort
        assert retailers == sorted(retailers, key=lambda s: s.lower())

    def test_get_directory_counts(self, readonly_session):
        counts = get_directory_counts(readonly_session)
        assert counts.releases >= 50
        assert counts.albums >= 40
        assert counts.artists >= 35


class TestDirectoryAPIEndpoints:
    """Integration tests for FastAPI /api/v1/directory endpoints."""

    def test_api_directory_releases_endpoint(self, client):
        response = client.get("/api/v1/directory/releases?window=24H&page=1&page_size=15&sort=hype_index&order=desc")
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 15
        assert "total_pages" in data
        assert "total_items" in data
        assert "items" in data
        assert len(data["items"]) == 15

        first = data["items"][0]
        assert "release_id" in first
        assert "album_id" in first
        assert "album_title" in first
        assert "combined_artist" in first
        assert "variant" in first
        assert "retailer_name" in first
        assert "hype_index" in first
        assert "hype_velocity" in first
        assert "tier" in first
        assert "score" in first
        assert "num_comments" in first
        assert "submission_count" in first
        assert "created_at" in first
        assert "monogram_key" in first

    def test_api_directory_releases_filter_tier_and_retailer(self, client):
        # Fetch retailers first
        ret_res = client.get("/api/v1/directory/retailers")
        assert ret_res.status_code == 200
        retailers = ret_res.json()
        assert len(retailers) > 0

        ret = retailers[0]
        res = client.get(f"/api/v1/directory/releases?retailer={ret}")
        assert res.status_code == 200
        data = res.json()
        for item in data["items"]:
            assert item["retailer_name"] == ret

        tier_res = client.get("/api/v1/directory/releases?tier=low")
        assert tier_res.status_code == 200
        tier_data = tier_res.json()
        for item in tier_data["items"]:
            assert item["tier"] == "low"

    def test_api_directory_albums_endpoint(self, client):
        response = client.get("/api/v1/directory/albums?window=7D&page=1&page_size=10")
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 10
        assert data["total_items"] >= 40
        assert len(data["items"]) == 10

        first = data["items"][0]
        assert "album_id" in first
        assert "album_title" in first
        assert "combined_artist" in first
        assert "release_count" in first
        assert "preview_variants" in first
        assert "retailers" in first
        assert "hype_index" in first
        assert "hype_velocity" in first
        assert "tier" in first
        assert "monogram_key" in first

    def test_api_directory_artists_endpoint(self, client):
        response = client.get("/api/v1/directory/artists?window=1M&page=1&page_size=10")
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 10
        assert data["total_items"] >= 35
        assert len(data["items"]) == 10

        first = data["items"][0]
        assert "artist_id" in first
        assert "name" in first
        assert "solo_album_count" in first
        assert "combined_album_count" in first
        assert "release_count" in first
        assert "submission_count" in first
        assert "hype_index" in first
        assert "hype_velocity" in first
        assert "tier" in first
        assert "monogram_key" in first

    def test_api_directory_retailers_endpoint(self, client):
        response = client.get("/api/v1/directory/retailers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert all(isinstance(r, str) for r in data)

    def test_api_directory_counts_endpoint(self, client):
        response = client.get("/api/v1/directory/counts")
        assert response.status_code == 200
        data = response.json()
        assert data["releases"] >= 50
        assert data["albums"] >= 40
        assert data["artists"] >= 35
