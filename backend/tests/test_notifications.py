"""Tests for notification endpoints."""
import pytest
from httpx import AsyncClient
from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_list_notifications_as_student(client: AsyncClient):
    """GET /notifications/ as STUDENT → 200."""
    resp = await client.get(
        "/api/v1/notifications/",
        headers=auth_headers("STUDENT"),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, (list, dict))


@pytest.mark.asyncio
async def test_mark_all_read(client: AsyncClient):
    """PATCH /notifications/read-all → 200."""
    resp = await client.patch(
        "/api/v1/notifications/read-all",
        headers=auth_headers("STUDENT"),
    )
    assert resp.status_code in (200, 204)


@pytest.mark.asyncio
async def test_notifications_unauthenticated(client: AsyncClient):
    """GET /notifications/ without auth → 401/403."""
    resp = await client.get("/api/v1/notifications/")
    assert resp.status_code in (401, 403)
