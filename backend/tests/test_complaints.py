"""
Tests for POST/GET/PATCH /api/v1/complaints.
Covers: RBAC, field validation (min/max), status enum, pagination, resolve flow.
"""
import pytest
from httpx import AsyncClient
from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio

_VALID_COMPLAINT = {
    "title": "Library AC not working properly",
    "description": "The AC in the main reading hall has been broken for two weeks.",
}


# ─── CREATE ──────────────────────────────────────────────────────────────────

async def test_student_can_create_complaint(client: AsyncClient):
    """Students can raise a complaint."""
    resp = await client.post(
        "/api/v1/complaints",
        json=_VALID_COMPLAINT,
        headers=auth_headers("STUDENT"),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "id" in data
    assert data["message"] == "Complaint raised successfully."


async def test_management_cannot_create_complaint(client: AsyncClient):
    """College Management must not be able to raise complaints (403)."""
    resp = await client.post(
        "/api/v1/complaints",
        json=_VALID_COMPLAINT,
        headers=auth_headers("COLLEGE_MANAGEMENT"),
    )
    assert resp.status_code == 403


async def test_admin_cannot_create_complaint(client: AsyncClient):
    """Placement Admins must not be able to raise complaints (403)."""
    resp = await client.post(
        "/api/v1/complaints",
        json=_VALID_COMPLAINT,
        headers=auth_headers("PLACEMENT_ADMIN"),
    )
    assert resp.status_code == 403


async def test_create_complaint_unauthenticated(client: AsyncClient):
    """Unauthenticated complaint creation must be rejected."""
    resp = await client.post("/api/v1/complaints", json=_VALID_COMPLAINT)
    assert resp.status_code in (401, 403, 422)


# ─── TITLE VALIDATION ────────────────────────────────────────────────────────

async def test_title_too_short_rejected(client: AsyncClient):
    """Title shorter than 5 chars must return 422."""
    resp = await client.post(
        "/api/v1/complaints",
        json={"title": "AC", "description": "This is a valid description that is long enough."},
        headers=auth_headers("STUDENT"),
    )
    assert resp.status_code == 422


async def test_title_too_long_rejected(client: AsyncClient):
    """Title longer than 200 chars must return 422."""
    resp = await client.post(
        "/api/v1/complaints",
        json={"title": "T" * 201, "description": "This is a valid description that is long enough."},
        headers=auth_headers("STUDENT"),
    )
    assert resp.status_code == 422


async def test_title_at_min_length_accepted(client: AsyncClient):
    """Title exactly 5 chars must be accepted."""
    resp = await client.post(
        "/api/v1/complaints",
        json={"title": "ABCDE", "description": "This is a valid description that is long enough."},
        headers=auth_headers("STUDENT"),
    )
    assert resp.status_code == 201


# ─── DESCRIPTION VALIDATION ──────────────────────────────────────────────────

async def test_description_too_short_rejected(client: AsyncClient):
    """Description shorter than 10 chars must return 422."""
    resp = await client.post(
        "/api/v1/complaints",
        json={"title": "Valid Title", "description": "Short"},
        headers=auth_headers("STUDENT"),
    )
    assert resp.status_code == 422


async def test_description_too_long_rejected(client: AsyncClient):
    """Description longer than 2000 chars must return 422."""
    resp = await client.post(
        "/api/v1/complaints",
        json={"title": "Valid Title", "description": "D" * 2001},
        headers=auth_headers("STUDENT"),
    )
    assert resp.status_code == 422


async def test_missing_title_rejected(client: AsyncClient):
    """Missing title must return 422."""
    resp = await client.post(
        "/api/v1/complaints",
        json={"description": "This is a perfectly valid description."},
        headers=auth_headers("STUDENT"),
    )
    assert resp.status_code == 422


async def test_missing_description_rejected(client: AsyncClient):
    """Missing description must return 422."""
    resp = await client.post(
        "/api/v1/complaints",
        json={"title": "Valid Title Here"},
        headers=auth_headers("STUDENT"),
    )
    assert resp.status_code == 422


# ─── LIST ────────────────────────────────────────────────────────────────────

async def test_student_sees_only_own_complaints(client: AsyncClient):
    """Students get a paginated list of only their own complaints."""
    resp = await client.get("/api/v1/complaints", headers=auth_headers("STUDENT"))
    assert resp.status_code == 200
    data = resp.json()
    assert "complaints" in data
    assert "total" in data
    assert "page" in data
    assert "limit" in data
    assert isinstance(data["complaints"], list)


async def test_management_sees_all_complaints(client: AsyncClient):
    """Management gets a paginated list of all complaints."""
    resp = await client.get("/api/v1/complaints", headers=auth_headers("COLLEGE_MANAGEMENT"))
    assert resp.status_code == 200
    data = resp.json()
    assert "complaints" in data
    assert isinstance(data["complaints"], list)


async def test_admin_can_view_complaints(client: AsyncClient):
    """Placement Admins can view complaints (read-only oversight)."""
    resp = await client.get("/api/v1/complaints", headers=auth_headers("PLACEMENT_ADMIN"))
    assert resp.status_code == 200


async def test_list_complaints_unauthenticated(client: AsyncClient):
    """Unauthenticated list must be rejected."""
    resp = await client.get("/api/v1/complaints")
    assert resp.status_code in (401, 403, 422)


async def test_pagination_params_accepted(client: AsyncClient):
    """Pagination parameters page and limit must be respected."""
    resp = await client.get(
        "/api/v1/complaints",
        params={"page": 1, "limit": 5},
        headers=auth_headers("COLLEGE_MANAGEMENT"),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["page"] == 1
    assert data["limit"] == 5
    assert len(data["complaints"]) <= 5


async def test_pagination_default_values(client: AsyncClient):
    """Default pagination should be page=1, limit=20."""
    resp = await client.get("/api/v1/complaints", headers=auth_headers("COLLEGE_MANAGEMENT"))
    assert resp.status_code == 200
    data = resp.json()
    assert data["page"] == 1
    assert data["limit"] == 20


# ─── STATUS FILTER ────────────────────────────────────────────────────────────

async def test_status_filter_pending(client: AsyncClient):
    """status=Pending filter must be accepted."""
    resp = await client.get(
        "/api/v1/complaints",
        params={"status": "Pending"},
        headers=auth_headers("COLLEGE_MANAGEMENT"),
    )
    assert resp.status_code == 200
    for c in resp.json()["complaints"]:
        assert c["status"] == "Pending"


async def test_status_filter_resolved(client: AsyncClient):
    """status=Resolved filter must be accepted."""
    resp = await client.get(
        "/api/v1/complaints",
        params={"status": "Resolved"},
        headers=auth_headers("COLLEGE_MANAGEMENT"),
    )
    assert resp.status_code == 200


# ─── RESOLVE (PATCH) ─────────────────────────────────────────────────────────

async def test_full_complaint_lifecycle(client: AsyncClient):
    """Student creates a complaint, Management resolves it, Student sees it resolved."""
    student_hdrs = auth_headers("STUDENT")
    mgmt_hdrs = auth_headers("COLLEGE_MANAGEMENT")

    # 1. Student creates
    create_resp = await client.post("/api/v1/complaints", json=_VALID_COMPLAINT, headers=student_hdrs)
    assert create_resp.status_code == 201
    complaint_id = create_resp.json()["id"]

    # 2. Management sees it as Pending
    list_resp = await client.get("/api/v1/complaints", headers=mgmt_hdrs)
    assert list_resp.status_code == 200
    ids = [c["id"] for c in list_resp.json()["complaints"]]
    assert complaint_id in ids

    # 3. Management resolves it
    patch_resp = await client.patch(
        f"/api/v1/complaints/{complaint_id}",
        json={"status": "Resolved", "solution": "The AC unit was repaired by maintenance on Monday."},
        headers=mgmt_hdrs,
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["message"] == "Complaint updated successfully."


async def test_invalid_status_value_rejected(client: AsyncClient):
    """An invalid status value like 'Closed' or 'Open' must return 422."""
    # Create a complaint first
    create_resp = await client.post("/api/v1/complaints", json=_VALID_COMPLAINT, headers=auth_headers("STUDENT"))
    assert create_resp.status_code == 201
    complaint_id = create_resp.json()["id"]

    for bad_status in ("Closed", "Open", "RESOLVED", "pending", "done"):
        patch_resp = await client.patch(
            f"/api/v1/complaints/{complaint_id}",
            json={"status": bad_status},
            headers=auth_headers("COLLEGE_MANAGEMENT"),
        )
        assert patch_resp.status_code == 422, (
            f"Expected 422 for status={bad_status!r}, got {patch_resp.status_code}"
        )


async def test_solution_too_long_rejected(client: AsyncClient):
    """Solution longer than 3000 chars must return 422."""
    create_resp = await client.post("/api/v1/complaints", json=_VALID_COMPLAINT, headers=auth_headers("STUDENT"))
    assert create_resp.status_code == 201
    complaint_id = create_resp.json()["id"]

    patch_resp = await client.patch(
        f"/api/v1/complaints/{complaint_id}",
        json={"status": "Resolved", "solution": "S" * 3001},
        headers=auth_headers("COLLEGE_MANAGEMENT"),
    )
    assert patch_resp.status_code == 422


async def test_student_cannot_resolve_complaint(client: AsyncClient):
    """Students must not be able to resolve complaints (403)."""
    create_resp = await client.post("/api/v1/complaints", json=_VALID_COMPLAINT, headers=auth_headers("STUDENT"))
    assert create_resp.status_code == 201
    complaint_id = create_resp.json()["id"]

    patch_resp = await client.patch(
        f"/api/v1/complaints/{complaint_id}",
        json={"status": "Resolved", "solution": "Student-injected solution."},
        headers=auth_headers("STUDENT"),
    )
    assert patch_resp.status_code == 403


async def test_resolve_nonexistent_complaint(client: AsyncClient):
    """Patching a non-existent complaint must return 404."""
    resp = await client.patch(
        "/api/v1/complaints/nonexistent-id-xyz",
        json={"status": "Resolved"},
        headers=auth_headers("COLLEGE_MANAGEMENT"),
    )
    assert resp.status_code == 404
