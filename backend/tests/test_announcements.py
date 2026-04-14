"""
Tests for POST /api/v1/announcements and GET /api/v1/announcements.
Covers: RBAC, field validation (min/max), target_audience enum, list, delete.
"""
import pytest
from httpx import AsyncClient
from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


# ─── CREATE ──────────────────────────────────────────────────────────────────

async def test_management_can_create_announcement(client: AsyncClient):
    """College Management can create an announcement."""
    headers = auth_headers("COLLEGE_MANAGEMENT")
    resp = await client.post(
        "/api/v1/announcements",
        json={"title": "Google Drive 2025", "message": "Register before the deadline.", "target_audience": "STUDENTS"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "id" in data
    assert data["message"] == "Announcement created and notifications sent"


async def test_student_cannot_create_announcement(client: AsyncClient):
    """Students must not be able to broadcast announcements (403)."""
    resp = await client.post(
        "/api/v1/announcements",
        json={"title": "Test", "message": "This is a test message.", "target_audience": "ALL"},
        headers=auth_headers("STUDENT"),
    )
    assert resp.status_code == 403


async def test_placement_admin_cannot_create_announcement(client: AsyncClient):
    """Placement Admins must not be able to broadcast announcements (403)."""
    resp = await client.post(
        "/api/v1/announcements",
        json={"title": "Test", "message": "This is a test message.", "target_audience": "ALL"},
        headers=auth_headers("PLACEMENT_ADMIN"),
    )
    assert resp.status_code == 403


async def test_create_announcement_unauthenticated(client: AsyncClient):
    """Unauthenticated request must be rejected (401/403)."""
    resp = await client.post(
        "/api/v1/announcements",
        json={"title": "Test", "message": "This is a test message.", "target_audience": "ALL"},
    )
    assert resp.status_code in (401, 403, 422)


# ─── target_audience VALIDATION ──────────────────────────────────────────────

async def test_invalid_target_audience_rejected(client: AsyncClient):
    """Typo like 'STUDENT' (without S) or random string must return 422."""
    headers = auth_headers("COLLEGE_MANAGEMENT")
    for bad_audience in ("STUDENT", "ADMIN", "all", "everyone", ""):
        resp = await client.post(
            "/api/v1/announcements",
            json={"title": "Valid Title Here", "message": "Valid message content here.", "target_audience": bad_audience},
            headers=headers,
        )
        assert resp.status_code == 422, f"Expected 422 for target_audience={bad_audience!r}, got {resp.status_code}"


async def test_all_valid_target_audiences_accepted(client: AsyncClient):
    """All three valid target_audience values must be accepted."""
    headers = auth_headers("COLLEGE_MANAGEMENT")
    for audience in ("STUDENTS", "PLACEMENT_ADMINS", "ALL"):
        resp = await client.post(
            "/api/v1/announcements",
            json={"title": "Valid Title Here", "message": "Valid message body content.", "target_audience": audience},
            headers=headers,
        )
        assert resp.status_code == 201, f"Expected 201 for target_audience={audience!r}, got {resp.status_code}: {resp.text}"


# ─── TITLE VALIDATION ────────────────────────────────────────────────────────

async def test_title_too_short_rejected(client: AsyncClient):
    """Title shorter than 3 chars must return 422."""
    resp = await client.post(
        "/api/v1/announcements",
        json={"title": "Hi", "message": "Valid message content here.", "target_audience": "ALL"},
        headers=auth_headers("COLLEGE_MANAGEMENT"),
    )
    assert resp.status_code == 422


async def test_title_too_long_rejected(client: AsyncClient):
    """Title longer than 200 chars must return 422."""
    long_title = "A" * 201
    resp = await client.post(
        "/api/v1/announcements",
        json={"title": long_title, "message": "Valid message content here.", "target_audience": "ALL"},
        headers=auth_headers("COLLEGE_MANAGEMENT"),
    )
    assert resp.status_code == 422


async def test_title_at_max_length_accepted(client: AsyncClient):
    """Title exactly 200 chars must be accepted."""
    resp = await client.post(
        "/api/v1/announcements",
        json={"title": "A" * 200, "message": "Valid message content here.", "target_audience": "ALL"},
        headers=auth_headers("COLLEGE_MANAGEMENT"),
    )
    assert resp.status_code == 201


# ─── MESSAGE VALIDATION ───────────────────────────────────────────────────────

async def test_message_too_short_rejected(client: AsyncClient):
    """Message shorter than 10 chars must return 422."""
    resp = await client.post(
        "/api/v1/announcements",
        json={"title": "Valid Title", "message": "Short", "target_audience": "ALL"},
        headers=auth_headers("COLLEGE_MANAGEMENT"),
    )
    assert resp.status_code == 422


async def test_message_too_long_rejected(client: AsyncClient):
    """Message longer than 5000 chars must return 422."""
    resp = await client.post(
        "/api/v1/announcements",
        json={"title": "Valid Title", "message": "B" * 5001, "target_audience": "ALL"},
        headers=auth_headers("COLLEGE_MANAGEMENT"),
    )
    assert resp.status_code == 422


async def test_missing_title_rejected(client: AsyncClient):
    """Missing title field must return 422."""
    resp = await client.post(
        "/api/v1/announcements",
        json={"message": "Valid message content here.", "target_audience": "ALL"},
        headers=auth_headers("COLLEGE_MANAGEMENT"),
    )
    assert resp.status_code == 422


async def test_missing_message_rejected(client: AsyncClient):
    """Missing message field must return 422."""
    resp = await client.post(
        "/api/v1/announcements",
        json={"title": "Valid Title", "target_audience": "ALL"},
        headers=auth_headers("COLLEGE_MANAGEMENT"),
    )
    assert resp.status_code == 422


# ─── LIST ────────────────────────────────────────────────────────────────────

async def test_student_can_list_announcements(client: AsyncClient):
    """Students can list announcements."""
    resp = await client.get("/api/v1/announcements", headers=auth_headers("STUDENT"))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_management_can_list_announcements(client: AsyncClient):
    """Management can list announcements."""
    resp = await client.get("/api/v1/announcements", headers=auth_headers("COLLEGE_MANAGEMENT"))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_list_announcements_unauthenticated(client: AsyncClient):
    """Unauthenticated list request must be rejected."""
    resp = await client.get("/api/v1/announcements")
    assert resp.status_code in (401, 403, 422)


async def test_create_and_list_round_trip(client: AsyncClient):
    """Create an announcement and verify it appears in the list."""
    headers = auth_headers("COLLEGE_MANAGEMENT")
    payload = {
        "title": "Round-trip Test Title",
        "message": "Round-trip test message body content.",
        "target_audience": "STUDENTS",
    }
    create_resp = await client.post("/api/v1/announcements", json=payload, headers=headers)
    assert create_resp.status_code == 201

    list_resp = await client.get("/api/v1/announcements", headers=auth_headers("STUDENT"))
    assert list_resp.status_code == 200
    titles = [a["title"] for a in list_resp.json()]
    assert "Round-trip Test Title" in titles


# ─── DELETE ──────────────────────────────────────────────────────────────────

async def test_management_can_delete_announcement(client: AsyncClient):
    """Management can delete an existing announcement."""
    headers = auth_headers("COLLEGE_MANAGEMENT")
    create_resp = await client.post(
        "/api/v1/announcements",
        json={"title": "Delete Me", "message": "Delete me message content.", "target_audience": "ALL"},
        headers=headers,
    )
    assert create_resp.status_code == 201
    ann_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/v1/announcements/{ann_id}", headers=headers)
    assert del_resp.status_code == 204


async def test_student_cannot_delete_announcement(client: AsyncClient):
    """Students must not be able to delete announcements."""
    # Create one
    create_resp = await client.post(
        "/api/v1/announcements",
        json={"title": "Protected Title", "message": "Protected message content.", "target_audience": "ALL"},
        headers=auth_headers("COLLEGE_MANAGEMENT"),
    )
    assert create_resp.status_code == 201
    ann_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/v1/announcements/{ann_id}", headers=auth_headers("STUDENT"))
    assert del_resp.status_code == 403


async def test_delete_nonexistent_announcement(client: AsyncClient):
    """Deleting a non-existent announcement must return 404."""
    resp = await client.delete(
        "/api/v1/announcements/nonexistent-id-xyz",
        headers=auth_headers("COLLEGE_MANAGEMENT"),
    )
    assert resp.status_code == 404
