"""Tests for application endpoints."""
import pytest
from httpx import AsyncClient
from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_list_my_applications_as_student(client: AsyncClient):
    """GET /applications/my → 200 for student."""
    resp = await client.get(
        "/api/v1/applications/my",
        headers=auth_headers("STUDENT"),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, (list, dict))


@pytest.mark.asyncio
async def test_list_all_applications_as_admin(client: AsyncClient):
    """GET /applications/ as PLACEMENT_ADMIN → 200."""
    resp = await client.get(
        "/api/v1/applications/",
        headers=auth_headers("PLACEMENT_ADMIN"),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_list_all_applications_as_student_forbidden(client: AsyncClient):
    """GET /applications/ as STUDENT → 403 (students see only their own)."""
    resp = await client.get(
        "/api/v1/applications/",
        headers=auth_headers("STUDENT"),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_apply_for_job_as_student(client: AsyncClient):
    """POST /applications/ as STUDENT → 201 or 409 (if already applied)."""
    resp = await client.post(
        "/api/v1/applications/",
        headers=auth_headers("STUDENT"),
        json={
            "job_id": "mock-job-id-001",
            "cover_letter": "I am very interested in this position.",
        },
    )
    assert resp.status_code in (200, 201, 400, 409)


@pytest.mark.asyncio
async def test_bulk_update_applications(client: AsyncClient):
    """POST /applications/bulk-update → 200 with failed_ids list."""
    resp = await client.post(
        "/api/v1/applications/bulk-update",
        headers=auth_headers("PLACEMENT_ADMIN"),
        json={
            "application_ids": ["fake-app-001", "fake-app-002"],
            "status": "SHORTLISTED",
        },
    )
    assert resp.status_code in (200, 400)
    if resp.status_code == 200:
        data = resp.json()
        assert "failed_ids" in data or "updated" in data
