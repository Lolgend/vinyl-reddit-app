import uuid

import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture
def client():
    return TestClient(app)


class TestSearchService:
    def test_short_query_returns_empty_results(self, client):
        res = client.get("/api/v1/search?q=a")
        assert res.status_code == 200
        data = res.json()
        assert data["query"] == "a"
        assert data["albums"] == []
        assert data["releases"] == []
        assert data["artists"] == []

    def test_search_by_artist_name(self, client):
        res = client.get("/api/v1/search?q=cats")
        assert res.status_code == 200
        data = res.json()
        assert data["query"] == "cats"

        # Check albums group
        assert len(data["albums"]) >= 1
        album = data["albums"][0]
        assert "id" in album
        # Validate id is a valid UUID string
        assert str(uuid.UUID(album["id"])) == album["id"]
        assert album["monogram_key"] == album["id"]
        assert "Cats" in album["title"] or "Cats" in album["subtitle"]
        assert album["extra"] is not None
        assert "release_count" in album["extra"]

        # Check releases group
        assert len(data["releases"]) >= 1
        release = data["releases"][0]
        assert "id" in release
        assert str(uuid.UUID(release["id"])) == release["id"]
        assert release["monogram_key"] == release["id"]
        assert "Cats" in release["title"] or "Cats" in release["subtitle"]

        # Check artists group
        assert len(data["artists"]) >= 1
        artist = data["artists"][0]
        assert "id" in artist
        assert str(uuid.UUID(artist["id"])) == artist["id"]
        assert "Cats" in artist["title"]
        assert artist["monogram_key"] == artist["id"]
        assert "solo" in artist["subtitle"] or "combined" in artist["subtitle"]

    def test_search_by_variant(self, client):
        # Query a known variant keyword like "splatter"
        res = client.get("/api/v1/search?q=splatter")
        assert res.status_code == 200
        data = res.json()
        assert len(data["releases"]) >= 1
        matching = any("splatter" in (r["subtitle"] + r["title"]).lower() for r in data["releases"])
        assert matching

    def test_search_by_retailer(self, client):
        # Query a known retailer keyword like "Magnolia"
        res = client.get("/api/v1/search?q=magnolia")
        assert res.status_code == 200
        data = res.json()
        assert len(data["releases"]) >= 1
        matching = any("magnolia" in (r["subtitle"] + r["title"]).lower() for r in data["releases"])
        assert matching

    def test_search_limit_parameter(self, client):
        res = client.get("/api/v1/search?q=a&limit=2")
        assert res.status_code == 200
        # If q='a' (len < 2), empty
        res2 = client.get("/api/v1/search?q=th&limit=2")
        assert res2.status_code == 200
        data2 = res2.json()
        assert len(data2["albums"]) <= 2
        assert len(data2["releases"]) <= 2
        assert len(data2["artists"]) <= 2

    def test_search_case_insensitivity(self, client):
        res_lower = client.get("/api/v1/search?q=cats")
        res_upper = client.get("/api/v1/search?q=CATS")
        assert res_lower.status_code == 200
        assert res_upper.status_code == 200
        assert len(res_lower.json()["albums"]) == len(res_upper.json()["albums"])
        assert len(res_lower.json()["albums"]) > 0
        assert len(res_lower.json()["artists"]) == len(res_upper.json()["artists"])
        assert len(res_lower.json()["artists"]) > 0

    def test_search_nonexistent_returns_empty(self, client):
        res = client.get("/api/v1/search?q=nonexistentartist12345")
        assert res.status_code == 200
        data = res.json()
        assert data["albums"] == []
        assert data["releases"] == []
        assert data["artists"] == []
