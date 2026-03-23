"""
Comprehensive debugging script for AI Resume Analyzer
This will help identify exactly where the issue is occurring
"""

import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient

# Add the parent directory to path so we can import app modules
sys.path.insert(0, os.path.dirname(__file__))

from app.core.config import settings
from app.utils.file_upload import BASE_DIR


async def debug_ai_analyzer():
    print("=" * 70)
    print("AI RESUME ANALYZER DEBUGGING")
    print("=" * 70)
    print()

    # 1. Check OpenAI API Key
    print("1. Checking OpenAI Configuration...")
    openai_key = settings.OPENAI_API_KEY
    if openai_key:
        print(f"   [OK] OPENAI_API_KEY found: {openai_key[:15]}...{openai_key[-6:]}")
    else:
        print("   [ERROR] OPENAI_API_KEY not found in .env")
        return
    print()

    # 2. Check BASE_DIR and file paths
    print("2. Checking File System...")
    print(f"   BASE_DIR: {BASE_DIR}")
    uploads_dir = os.path.join(BASE_DIR, "uploads", "resumes")
    print(f"   Uploads dir: {uploads_dir}")
    print(f"   Uploads exist: {os.path.exists(uploads_dir)}")

    # List PDF files
    import glob
    pdfs = glob.glob(os.path.join(uploads_dir, "*.pdf"))
    print(f"   Number of PDFs in uploads: {len(pdfs)}")
    if pdfs:
        print(f"   Sample PDF: {os.path.basename(pdfs[0])}")
    print()

    # 3. Connect to database
    print("3. Checking Database...")
    try:
        client = AsyncIOMotorClient(settings.MONGODB_URL)
        db = client[settings.DATABASE_NAME]

        # Count student profiles
        count = await db.student_profiles.count_documents({})
        print(f"   [OK] Connected to MongoDB")
        print(f"   Total student profiles: {count}")

        if count == 0:
            print("   [ERROR] No student profiles found in database")
            await client.close()
            return

        # Find a profile with resume_url
        profile = await db.student_profiles.find_one({"resume_url": {"$ne": None}})

        if not profile:
            print("   [ERROR] No student profiles have resume_url set")
            print()
            print("   DEBUG: Checking all profiles...")
            all_profiles = await db.student_profiles.find({}).limit(5).to_list(5)
            for p in all_profiles:
                print(f"     - User ID: {p.get('user_id')}, Resume URL: {p.get('resume_url')}")
            await client.close()
            return

        print(f"   [OK] Found profile with resume")
        print(f"     User ID: {profile.get('user_id')}")
        print(f"     Email: {profile.get('email')}")
        print(f"     Resume URL: {profile.get('resume_url')}")
        print()

        # 4. Verify the file exists
        print("4. Verifying Resume File...")
        resume_url = profile.get('resume_url')
        if resume_url:
            relative_path = resume_url.lstrip("/")
            file_path = os.path.join(BASE_DIR, relative_path)

            print(f"   Resume URL from DB: {resume_url}")
            print(f"   Relative path: {relative_path}")
            print(f"   Full file path: {file_path}")
            print(f"   File exists: {os.path.isfile(file_path)}")

            if os.path.isfile(file_path):
                file_size = os.path.getsize(file_path)
                print(f"   File size: {file_size:,} bytes ({file_size/1024:.1f} KB)")
                print()

                # 5. Test PDF extraction
                print("5. Testing PDF Text Extraction...")
                try:
                    # Test with PyMuPDF first
                    import fitz
                    with fitz.open(file_path) as doc:
                        text = ""
                        for page in doc:
                            text += page.get_text("text")

                        if text.strip():
                            print(f"   [OK] PyMuPDF extracted {len(text)} characters")
                            print(f"   First 150 chars: {text[:150].strip()}...")
                        else:
                            print(f"   [ERROR] PyMuPDF returned empty text")
                            print(f"     This PDF might be image-based or scanned")
                except Exception as e:
                    print(f"   [ERROR] PDF extraction failed: {e}")
                print()

                # 6. Test OpenAI API
                print("6. Testing OpenAI API Connection...")
                try:
                    from langchain_openai import ChatOpenAI
                    from langchain_core.messages import HumanMessage

                    llm = ChatOpenAI(
                        model="gpt-4o-mini",
                        openai_api_key=openai_key,
                        temperature=0.0,
                        max_tokens=100,
                        timeout=30,
                    )

                    test_message = HumanMessage(content="Say 'OpenAI connection successful' in JSON format: {\"status\": \"...\"}")
                    response = await llm.ainvoke([test_message])

                    print(f"   [OK] OpenAI API is working!")
                    print(f"   Response: {response.content[:100]}")
                except Exception as e:
                    print(f"   [ERROR] OpenAI API error: {e}")
                print()

                # 7. Test complete flow (if everything above passed)
                if text.strip() and len(text) > 100:
                    print("7. Testing Complete AI Analysis Flow...")
                    try:
                        from app.services.ai_resume_service import analyze_resume_text

                        # Use first 2000 chars for quick test
                        result = await analyze_resume_text(text[:2000])

                        print(f"   [OK] AI Analysis completed successfully!")
                        print(f"   ATS Score: {result.get('atsScore')}/100")
                        print(f"   Skills found: {len(result.get('extractedSkills', []))}")
                        print(f"   Missing skills: {len(result.get('missingSkills', []))}")
                        print(f"   Strengths: {len(result.get('strengths', []))}")
                        print(f"   Weaknesses: {len(result.get('weaknesses', []))}")
                        print(f"   Suggestions: {len(result.get('suggestions', []))}")
                    except Exception as e:
                        print(f"   [ERROR] AI Analysis failed: {e}")
                        import traceback
                        traceback.print_exc()
            else:
                print(f"   [ERROR] Resume file does not exist at expected path")
                print(f"     Expected: {file_path}")
        else:
            print("   [ERROR] resume_url is None or empty")

        await client.close()

    except Exception as e:
        print(f"   [ERROR] Database connection error: {e}")
        import traceback
        traceback.print_exc()

    print()
    print("=" * 70)
    print("DEBUGGING COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(debug_ai_analyzer())
