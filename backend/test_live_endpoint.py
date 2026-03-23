"""
Test the actual /api/v1/ai/analyze-existing-resume endpoint with real authentication
"""

import asyncio
import httpx
import sys
import os
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, os.path.dirname(__file__))
from app.core.config import settings
from app.core.security import create_access_token


async def test_endpoint():
    print("=" * 70)
    print("TESTING LIVE API ENDPOINT")
    print("=" * 70)
    print()

    # 1. Get a real user from the database
    print("1. Fetching student user from database...")
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]

    # Find a student with a resume
    profile = await db.student_profiles.find_one({"resume_url": {"$ne": None}})
    if not profile:
        print("   [ERROR] No student profiles with resume found")
        await client.close()
        return

    user_id = profile["user_id"]
    email = profile["email"]
    resume_url = profile["resume_url"]

    print(f"   Found student: {email}")
    print(f"   Resume: {resume_url}")
    print()

    # Get the user record
    from bson import ObjectId
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        print("   [ERROR] User record not found")
        await client.close()
        return

    # 2. Create access token
    print("2. Creating authentication token...")
    token = create_access_token({"sub": user_id, "role": user["role"]})
    print(f"   Token created: {token[:30]}...")
    print()

    # 3. Call the API endpoint
    print("3. Calling POST /api/v1/ai/analyze-existing-resume...")
    base_url = "http://localhost:8000"

    async with httpx.AsyncClient(timeout=120.0) as http_client:
        try:
            response = await http_client.post(
                f"{base_url}/api/v1/ai/analyze-existing-resume",
                headers={"Authorization": f"Bearer {token}"},
                json={}
            )

            print(f"   Status Code: {response.status_code}")
            print()

            if response.status_code == 200:
                result = response.json()
                print("=" * 70)
                print("SUCCESS! AI RESUME ANALYZER IS WORKING!")
                print("=" * 70)
                print()
                print(f"ATS Score: {result['atsScore']}/100")
                print(f"\nExtracted Skills ({len(result['extractedSkills'])}):")
                for skill in result['extractedSkills'][:10]:
                    print(f"  - {skill}")
                if len(result['extractedSkills']) > 10:
                    print(f"  ... and {len(result['extractedSkills']) - 10} more")

                print(f"\nMissing Skills ({len(result['missingSkills'])}):")
                for skill in result['missingSkills'][:5]:
                    print(f"  - {skill}")

                print(f"\nStrengths ({len(result['strengths'])}):")
                for item in result['strengths']:
                    print(f"  - {item}")

                print(f"\nWeaknesses ({len(result['weaknesses'])}):")
                for item in result['weaknesses']:
                    print(f"  - {item}")

                print(f"\nSuggestions ({len(result['suggestions'])}):")
                for item in result['suggestions'][:5]:
                    print(f"  - {item}")
                if len(result['suggestions']) > 5:
                    print(f"  ... and {len(result['suggestions']) - 5} more")

            else:
                print("=" * 70)
                print("API CALL FAILED")
                print("=" * 70)
                print()
                print(f"Status: {response.status_code}")
                print(f"Response: {response.text}")

        except httpx.ConnectError:
            print("   [ERROR] Cannot connect to server at http://localhost:8000")
            print("   Make sure the FastAPI server is running:")
            print("   cd backend && uvicorn app.main:app --reload")
        except Exception as e:
            print(f"   [ERROR] Request failed: {e}")
            import traceback
            traceback.print_exc()

    await client.close()
    print()
    print("=" * 70)
    print("TEST COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(test_endpoint())
