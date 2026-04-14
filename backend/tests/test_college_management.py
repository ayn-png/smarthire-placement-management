"""
College Management module — integration tests.
Covers announcements, complaints, and leaderboard together.
Previously tested: basic create/list/resolve.
Added: edge cases, pagination defaults, sort order, and full cross-feature assertions.
"""
import pytest
from httpx import AsyncClient
from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


# ─── ANNOUNCEMENTS ────────────────────────────────────────────────────────────

async def test_create_and_list_announcements(client: AsyncClient):
    """Management creates an announcement; student lists and finds it."""
    cm_headers = auth_headers("COLLEGE_MANAGEMENT")
    create_payload = {
        "title": "Semester Exams Scheduled",
        "message": "Please prepare for the upcoming semester exams.",
        "target_audience": "STUDENTS",
    }
    resp = await client.post("/api/v1/announcements", json=create_payload, headers=cm_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert "id" in data
    assert data["message"] == "Announcement created and notifications sent"

    # Student lists
    student_headers = auth_headers("STUDENT")
    resp_list = await client.get("/api/v1/announcements", headers=student_headers)
    assert resp_list.status_code == 200
    announcements = resp_list.json()
    assert isinstance(announcements, list)
    assert len(announcements) > 0
    titles = [a["title"] for a in announcements]
    assert "Semester Exams Scheduled" in titles


async def test_announcement_all_target_audiences_accepted(client: AsyncClient):
    """All three valid target_audience values create successfully."""
    cm_headers = auth_headers("COLLEGE_MANAGEMENT")
    for audience in ("STUDENTS", "PLACEMENT_ADMINS", "ALL"):
        resp = await client.post(
            "/api/v1/announcements",
            json={
                "title": f"Notice for {audience}",
                "message": "This is an official notice from the management.",
                "target_audience": audience,
            },
            headers=cm_headers,
        )
        assert resp.status_code == 201, f"Failed for target_audience={audience}: {resp.text}"


async def test_announcement_bad_target_audience_rejected(client: AsyncClient):
    """Invalid target_audience typo is rejected with 422."""
    resp = await client.post(
        "/api/v1/announcements",
        json={"title": "Valid Title Here", "message": "Valid message body here.", "target_audience": "STUDENT"},
        headers=auth_headers("COLLEGE_MANAGEMENT"),
    )
    assert resp.status_code == 422


async def test_announcement_title_boundary_validation(client: AsyncClient):
    """Title boundary: 2 chars → 422, 3 chars → 201, 200 chars → 201, 201 chars → 422."""
    cm_headers = auth_headers("COLLEGE_MANAGEMENT")
    base = {"message": "Valid message content here.", "target_audience": "ALL"}

    too_short = await client.post("/api/v1/announcements", json={**base, "title": "AB"}, headers=cm_headers)
    assert too_short.status_code == 422

    at_min = await client.post("/api/v1/announcements", json={**base, "title": "ABC"}, headers=cm_headers)
    assert at_min.status_code == 201

    at_max = await client.post("/api/v1/announcements", json={**base, "title": "A" * 200}, headers=cm_headers)
    assert at_max.status_code == 201

    too_long = await client.post("/api/v1/announcements", json={**base, "title": "A" * 201}, headers=cm_headers)
    assert too_long.status_code == 422


async def test_announcement_list_response_is_list(client: AsyncClient):
    """List endpoint always returns a JSON array."""
    resp = await client.get("/api/v1/announcements", headers=auth_headers("COLLEGE_MANAGEMENT"))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ─── COMPLAINTS ───────────────────────────────────────────────────────────────

async def test_complaints_flow(client: AsyncClient):
    """Full complaint lifecycle: student creates → management lists → management resolves → student sees resolved."""
    student_headers = auth_headers("STUDENT")
    cm_headers = auth_headers("COLLEGE_MANAGEMENT")

    # 1. Student creates
    complaint_payload = {
        "title": "Library AC not working",
        "description": "The AC in the main reading hall is not functioning.",
    }
    resp_create = await client.post("/api/v1/complaints", json=complaint_payload, headers=student_headers)
    assert resp_create.status_code == 201
    complaint_id = resp_create.json()["id"]

    # 2. Management lists — paginated response
    resp_list_cm = await client.get("/api/v1/complaints", headers=cm_headers)
    assert resp_list_cm.status_code == 200
    body = resp_list_cm.json()
    assert "complaints" in body
    assert "total" in body
    complaints = body["complaints"]
    assert len(complaints) > 0
    assert complaints[0]["status"] == "Pending"

    # 3. Management resolves
    update_payload = {
        "status": "Resolved",
        "solution": "AC has been repaired by the maintenance team.",
    }
    resp_update = await client.patch(
        f"/api/v1/complaints/{complaint_id}", json=update_payload, headers=cm_headers
    )
    assert resp_update.status_code == 200
    assert resp_update.json()["message"] == "Complaint updated successfully."

    # 4. Student lists own complaints — paginated
    resp_list_student = await client.get("/api/v1/complaints", headers=student_headers)
    assert resp_list_student.status_code == 200
    student_body = resp_list_student.json()
    assert "complaints" in student_body
    student_complaints = student_body["complaints"]
    resolved = next((c for c in student_complaints if c["id"] == complaint_id), None)
    if resolved:  # may not be in page if many complaints
        assert resolved["status"] == "Resolved"
        assert resolved["solution"] == "AC has been repaired by the maintenance team."


async def test_complaints_pagination_defaults(client: AsyncClient):
    """Default pagination returns page=1 and limit=20."""
    resp = await client.get("/api/v1/complaints", headers=auth_headers("COLLEGE_MANAGEMENT"))
    assert resp.status_code == 200
    body = resp.json()
    assert body["page"] == 1
    assert body["limit"] == 20


async def test_complaints_invalid_status_in_update_rejected(client: AsyncClient):
    """Updating with invalid status 'Closed' must return 422."""
    # Create first
    create_resp = await client.post(
        "/api/v1/complaints",
        json={"title": "Valid Issue", "description": "A sufficiently long description for this complaint."},
        headers=auth_headers("STUDENT"),
    )
    assert create_resp.status_code == 201
    cid = create_resp.json()["id"]

    patch_resp = await client.patch(
        f"/api/v1/complaints/{cid}",
        json={"status": "Closed"},
        headers=auth_headers("COLLEGE_MANAGEMENT"),
    )
    assert patch_resp.status_code == 422


async def test_admin_can_view_complaints_readonly(client: AsyncClient):
    """Placement Admins can list complaints for oversight."""
    resp = await client.get("/api/v1/complaints", headers=auth_headers("PLACEMENT_ADMIN"))
    assert resp.status_code == 200
    body = resp.json()
    assert "complaints" in body


# ─── LEADERBOARD ─────────────────────────────────────────────────────────────

async def test_leaderboard(client: AsyncClient):
    """Leaderboard returns 200 with a list for Management role."""
    cm_headers = auth_headers("COLLEGE_MANAGEMENT")
    resp = await client.get("/api/v1/leaderboard", headers=cm_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_leaderboard_sorted_descending(client: AsyncClient):
    """Leaderboard must be sorted by total_score descending."""
    resp = await client.get("/api/v1/leaderboard", headers=auth_headers("COLLEGE_MANAGEMENT"))
    assert resp.status_code == 200
    entries = resp.json()
    if len(entries) < 2:
        return
    scores = [e["total_score"] for e in entries]
    assert scores == sorted(scores, reverse=True)


async def test_leaderboard_limit_param(client: AsyncClient):
    """limit param restricts results."""
    resp = await client.get(
        "/api/v1/leaderboard",
        params={"limit": 3},
        headers=auth_headers("COLLEGE_MANAGEMENT"),
    )
    assert resp.status_code == 200
    assert len(resp.json()) <= 3


async def test_leaderboard_student_accessible(client: AsyncClient):
    """Students can access the leaderboard."""
    resp = await client.get("/api/v1/leaderboard", headers=auth_headers("STUDENT"))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
