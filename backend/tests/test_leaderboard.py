"""
Tests for GET /api/v1/leaderboard.
Covers: RBAC, response shape, limit param, sort order.
"""
import pytest
from httpx import AsyncClient
from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


# ─── ACCESS CONTROL ───────────────────────────────────────────────────────────

async def test_student_can_access_leaderboard(client: AsyncClient):
    """Students can view the leaderboard."""
    resp = await client.get("/api/v1/leaderboard", headers=auth_headers("STUDENT"))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_management_can_access_leaderboard(client: AsyncClient):
    """College Management can view the leaderboard."""
    resp = await client.get("/api/v1/leaderboard", headers=auth_headers("COLLEGE_MANAGEMENT"))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_admin_can_access_leaderboard(client: AsyncClient):
    """Placement Admins can view the leaderboard."""
    resp = await client.get("/api/v1/leaderboard", headers=auth_headers("PLACEMENT_ADMIN"))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_leaderboard_unauthenticated_rejected(client: AsyncClient):
    """Unauthenticated access must be rejected."""
    resp = await client.get("/api/v1/leaderboard")
    assert resp.status_code in (401, 403, 422)


# ─── RESPONSE SHAPE ───────────────────────────────────────────────────────────

REQUIRED_FIELDS = {"id", "name", "department", "cgpa", "total_score", "placement_status", "skills"}


async def test_leaderboard_entry_shape(client: AsyncClient):
    """Each leaderboard entry must contain all required fields."""
    resp = await client.get("/api/v1/leaderboard", headers=auth_headers("STUDENT"))
    assert resp.status_code == 200
    entries = resp.json()
    # If there are entries, validate shape; if empty, that is acceptable (no profiles seeded)
    for entry in entries:
        missing = REQUIRED_FIELDS - set(entry.keys())
        assert not missing, f"Leaderboard entry missing fields: {missing}"


async def test_leaderboard_cgpa_is_numeric(client: AsyncClient):
    """CGPA field must be a number (float/int)."""
    resp = await client.get("/api/v1/leaderboard", headers=auth_headers("STUDENT"))
    assert resp.status_code == 200
    for entry in resp.json():
        assert isinstance(entry["cgpa"], (int, float)), f"cgpa is not numeric: {entry['cgpa']}"


async def test_leaderboard_total_score_is_numeric(client: AsyncClient):
    """total_score field must be a number."""
    resp = await client.get("/api/v1/leaderboard", headers=auth_headers("STUDENT"))
    assert resp.status_code == 200
    for entry in resp.json():
        assert isinstance(entry["total_score"], (int, float))


async def test_leaderboard_skills_is_list(client: AsyncClient):
    """skills field must be a list."""
    resp = await client.get("/api/v1/leaderboard", headers=auth_headers("STUDENT"))
    assert resp.status_code == 200
    for entry in resp.json():
        assert isinstance(entry["skills"], list)


async def test_leaderboard_placement_status_valid(client: AsyncClient):
    """placement_status must be 'Placed' or 'Open'."""
    resp = await client.get("/api/v1/leaderboard", headers=auth_headers("STUDENT"))
    assert resp.status_code == 200
    for entry in resp.json():
        assert entry["placement_status"] in ("Placed", "Open"), (
            f"Unexpected placement_status: {entry['placement_status']}"
        )


# ─── LIMIT PARAM ──────────────────────────────────────────────────────────────

async def test_limit_param_respected(client: AsyncClient):
    """The limit param restricts the number of results returned."""
    resp = await client.get(
        "/api/v1/leaderboard",
        params={"limit": 5},
        headers=auth_headers("STUDENT"),
    )
    assert resp.status_code == 200
    assert len(resp.json()) <= 5


async def test_limit_default_is_20(client: AsyncClient):
    """Without limit param, at most 20 results should be returned."""
    resp = await client.get("/api/v1/leaderboard", headers=auth_headers("STUDENT"))
    assert resp.status_code == 200
    assert len(resp.json()) <= 20


async def test_limit_too_large_rejected(client: AsyncClient):
    """limit > 100 should be rejected with 422."""
    resp = await client.get(
        "/api/v1/leaderboard",
        params={"limit": 101},
        headers=auth_headers("STUDENT"),
    )
    assert resp.status_code == 422


async def test_limit_zero_rejected(client: AsyncClient):
    """limit=0 should be rejected with 422 (ge=1 constraint)."""
    resp = await client.get(
        "/api/v1/leaderboard",
        params={"limit": 0},
        headers=auth_headers("STUDENT"),
    )
    assert resp.status_code == 422


# ─── SORT ORDER ───────────────────────────────────────────────────────────────

async def test_leaderboard_sorted_descending_by_score(client: AsyncClient):
    """Results must be sorted by total_score descending."""
    resp = await client.get("/api/v1/leaderboard", headers=auth_headers("STUDENT"))
    assert resp.status_code == 200
    entries = resp.json()
    if len(entries) < 2:
        return  # not enough data to verify sort
    scores = [e["total_score"] for e in entries]
    assert scores == sorted(scores, reverse=True), (
        f"Leaderboard not sorted descending: {scores}"
    )


# ─── DEPARTMENT FILTER ────────────────────────────────────────────────────────

async def test_department_filter_accepted(client: AsyncClient):
    """department query param must be accepted without error."""
    resp = await client.get(
        "/api/v1/leaderboard",
        params={"department": "Computer Science"},
        headers=auth_headers("STUDENT"),
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
