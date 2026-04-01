import pytest
from httpx import AsyncClient
from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio

async def test_create_and_list_announcements(client: AsyncClient):
    # 1. Management creates an announcement
    cm_headers = auth_headers("COLLEGE_MANAGEMENT")
    create_payload = {
        "title": "Semester Exams Scheduled",
        "message": "Please prepare for the upcoming semester exams.",
        "target_audience": "STUDENTS"
    }
    resp = await client.post("/api/v1/announcements", json=create_payload, headers=cm_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert "id" in data
    assert data["message"] == "Announcement created and notifications sent"
    
    # 2. Student lists announcements
    student_headers = auth_headers("STUDENT")
    resp_list = await client.get("/api/v1/announcements", headers=student_headers)
    assert resp_list.status_code == 200
    announcements = resp_list.json()
    assert isinstance(announcements, list)
    # The fake DB will return the newly created announcement
    assert len(announcements) > 0
    assert announcements[0]["title"] == "Semester Exams Scheduled"


async def test_complaints_flow(client: AsyncClient):
    student_headers = auth_headers("STUDENT")
    cm_headers = auth_headers("COLLEGE_MANAGEMENT")
    
    # 1. Student creates a complaint
    complaint_payload = {
        "title": "Library AC not working",
        "description": "The AC in the main reading hall is not functioning."
    }
    resp_create = await client.post("/api/v1/complaints", json=complaint_payload, headers=student_headers)
    assert resp_create.status_code == 201
    complaint_id = resp_create.json()["id"]
    
    # 2. Management lists complaints
    resp_list_cm = await client.get("/api/v1/complaints", headers=cm_headers)
    assert resp_list_cm.status_code == 200
    complaints = resp_list_cm.json()
    assert len(complaints) > 0
    assert complaints[0]["status"] == "Pending"
    
    # 3. Management resolves complaint
    update_payload = {
        "status": "Resolved",
        "solution": "AC has been repaired by the maintenance team."
    }
    resp_update = await client.patch(f"/api/v1/complaints/{complaint_id}", json=update_payload, headers=cm_headers)
    assert resp_update.status_code == 200
    assert resp_update.json()["message"] == "Complaint updated successfully."
    
    # 4. Student checks their complaints
    resp_list_student = await client.get("/api/v1/complaints", headers=student_headers)
    assert resp_list_student.status_code == 200
    student_complaints = resp_list_student.json()
    assert student_complaints[0]["status"] == "Resolved"
    assert student_complaints[0]["solution"] == "AC has been repaired by the maintenance team."


async def test_leaderboard(client: AsyncClient):
    cm_headers = auth_headers("COLLEGE_MANAGEMENT")
    
    # The fake DB contains the users we mocked. 
    # But for leaderboard it reads from "students" collection.
    # We will just verify the endpoint returns 200 and a list.
    resp = await client.get("/api/v1/leaderboard", headers=cm_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
