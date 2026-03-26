"""
B-20: Basic smoke test — verify the API health endpoint is reachable.
Run with: cd backend && pytest tests/test_health.py -v
"""
import pytest
from unittest.mock import patch, MagicMock


@pytest.fixture
def client():
    """Create a test client with Firebase mocked out."""
    # Mock Firebase init so tests don't require credentials
    mock_app = MagicMock()
    mock_db = MagicMock()

    with patch("app.core.firebase_init.get_firebase_app", return_value=mock_app), \
         patch("app.db.database.get_database", return_value=mock_db):
        from fastapi.testclient import TestClient
        from app.main import app
        yield TestClient(app)


def test_health_endpoint(client):
    """GET /health returns 200 with status=healthy."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data


def test_health_returns_version(client):
    """GET /health includes a version field."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["version"] == "1.0.0"
