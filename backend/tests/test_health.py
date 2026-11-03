from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from backend.db import get_db
from backend.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_health_endpoint_success(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "connected"
    assert "latest_snapshot_at" in data
    assert data["latest_snapshot_at"] is not None


def test_health_endpoint_database_error(client):
    mock_db = MagicMock()
    mock_db.execute.side_effect = Exception("DB Connection Timeout")

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        response = client.get("/api/v1/health")
        assert response.status_code == 503
        data = response.json()
        assert data["detail"]["status"] == "error"
        assert data["detail"]["database"] == "disconnected"
    finally:
        app.dependency_overrides.clear()
