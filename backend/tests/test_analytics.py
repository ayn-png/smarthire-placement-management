"""Tests for analytics endpoints."""
import pytest
from httpx import AsyncClient
from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_system_status(client: AsyncClient):
    """GET /analytics/system-status → 200 with smtp/openai/mistral."""
    resp = await client.get(
        "/api/v1/analytics/system-status",
        headers=auth_headers("PLACEMENT_ADMIN"),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "smtp" in data
    assert "openai" in data
    assert "mistral" in data


@pytest.mark.asyncio
async def test_dashboard_as_admin(client: AsyncClient):
    """GET /analytics/dashboard as PLACEMENT_ADMIN → 200."""
    resp = await client.get(
        "/api/v1/analytics/dashboard",
        headers=auth_headers("PLACEMENT_ADMIN"),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_dashboard_as_student_forbidden(client: AsyncClient):
    """GET /analytics/dashboard as STUDENT → 403."""
    resp = await client.get(
        "/api/v1/analytics/dashboard",
        headers=auth_headers("STUDENT"),
    )
    assert resp.status_code == 403
