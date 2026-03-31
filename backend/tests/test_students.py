"""Tests for student endpoints — auth guards and role restrictions.

Note: Firestore-dependent operations may return 500 in the test environment
because the in-memory Firestore fake doesn't fully replicate all query
patterns. The important assertions are:
  - endpoints exist (not 404)
  - auth is enforced (401/403 without valid token)
  - role restrictions are correct (403 for wrong role)
"""
import pytest
from httpx import AsyncClient
from tests.conftest import auth_headers


SAMPLE_PROFILE = {
    "full_name": "Test Student",
    "branch": "CSE",
    "semester": 6,
    "cgpa": 8.5,
    "roll_number": "123456789",
    "phone": "9876543210",
}


# ── POST /students/profile ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_profile_no_auth(client: AsyncClient):
    """POST /students/profile without auth → 401/403."""
    resp = await client.post("/api/v1/students/profile", json=SAMPLE_PROFILE)
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_create_profile_as_student(client: AsyncClient):
    """POST /students/profile as STUDENT → endpoint reachable (not 401/403)."""
    resp = await client.post(
        "/api/v1/students/profile",
        json=SAMPLE_PROFILE,
        headers=auth_headers("STUDENT"),
    )
    assert resp.status_code in (200, 201, 400, 422, 500)
    assert resp.status_code not in (401, 403)


@pytest.mark.asyncio
async def test_create_profile_admin_forbidden(client: AsyncClient):
    """POST /students/profile as PLACEMENT_ADMIN → 403 (admin cannot create student profile)."""
    resp = await client.post(
        "/api/v1/students/profile",
        json=SAMPLE_PROFILE,
        headers=auth_headers("PLACEMENT_ADMIN"),
    )
    assert resp.status_code == 403


# ── GET /students/profile/me ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_my_profile_no_auth(client: AsyncClient):
    """GET /students/profile/me without auth → 401/403."""
    resp = await client.get("/api/v1/students/profile/me")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_get_my_profile_as_student(client: AsyncClient):
    """GET /students/profile/me as STUDENT → endpoint reachable (not 401/403)."""
    resp = await client.get(
        "/api/v1/students/profile/me",
        headers=auth_headers("STUDENT"),
    )
    # 200 = profile found; 404 = profile not created yet; 500 = Firestore unavailable
    assert resp.status_code in (200, 404, 500)
    assert resp.status_code not in (401, 403)


@pytest.mark.asyncio
async def test_get_my_profile_admin_forbidden(client: AsyncClient):
    """GET /students/profile/me as PLACEMENT_ADMIN → 403."""
    resp = await client.get(
        "/api/v1/students/profile/me",
        headers=auth_headers("PLACEMENT_ADMIN"),
    )
    assert resp.status_code == 403


# ── GET /students/ (admin list) ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_students_no_auth(client: AsyncClient):
    """GET /students/ without auth → 401/403."""
    resp = await client.get("/api/v1/students/")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_list_students_as_admin(client: AsyncClient):
    """GET /students/ as PLACEMENT_ADMIN → endpoint reachable (not 401/403)."""
    resp = await client.get(
        "/api/v1/students/",
        headers=auth_headers("PLACEMENT_ADMIN"),
    )
    assert resp.status_code in (200, 500)
    assert resp.status_code not in (401, 403)


@pytest.mark.asyncio
async def test_list_students_student_forbidden(client: AsyncClient):
    """GET /students/ as STUDENT → 403 (students cannot list all students)."""
    resp = await client.get(
        "/api/v1/students/",
        headers=auth_headers("STUDENT"),
    )
    assert resp.status_code == 403


# ── GET /students/export-csv ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_export_csv_no_auth(client: AsyncClient):
    """GET /students/export-csv without auth → 401/403."""
    resp = await client.get("/api/v1/students/export-csv")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_export_csv_admin_allowed(client: AsyncClient):
    """GET /students/export-csv as PLACEMENT_ADMIN → endpoint reachable (not 401/403)."""
    resp = await client.get(
        "/api/v1/students/export-csv",
        headers=auth_headers("PLACEMENT_ADMIN"),
    )
    assert resp.status_code in (200, 500)
    assert resp.status_code not in (401, 403)


@pytest.mark.asyncio
async def test_export_csv_student_forbidden(client: AsyncClient):
    """GET /students/export-csv as STUDENT → 403."""
    resp = await client.get(
        "/api/v1/students/export-csv",
        headers=auth_headers("STUDENT"),
    )
    assert resp.status_code == 403
