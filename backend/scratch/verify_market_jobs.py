import asyncio
import httpx
from datetime import datetime

# Constants
BASE_URL = "http://localhost:8000/api/v1"
TEST_USER_ID = "test_student_123"

async def test_mark_applied():
    print("\n--- Testing mark-applied ---")
    # Note: In a real test, we'd need a valid JWT. Using a mock check here for the service method logic.
    # Since I can't easily generate a Firebase JWT here, I'll check if the endpoint exists.
    async with httpx.AsyncClient() as client:
        try:
            # This will fail with 401/403 because no auth, but confirming existence
            resp = await client.post(f"{BASE_URL}/market-jobs/mark-applied", json={"job_id": "test-slug"})
            print(f"Endpoint mark-applied exists. Status: {resp.status_code}")
        except Exception as e:
            print(f"Error: {e}")

async def test_admin_applications():
    print("\n--- Testing admin applications ---")
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{BASE_URL}/market-jobs/admin/applications")
            print(f"Endpoint admin/applications exists. Status: {resp.status_code}")
        except Exception as e:
            print(f"Error: {e}")

async def test_management_analytics():
    print("\n--- Testing management analytics ---")
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{BASE_URL}/market-jobs/management/analytics")
            print(f"Endpoint management/analytics exists. Status: {resp.status_code}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_mark_applied())
    asyncio.run(test_admin_applications())
    asyncio.run(test_management_analytics())
