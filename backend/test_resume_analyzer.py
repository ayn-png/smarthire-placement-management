import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.services.resume_analyzer import analyzer_service
from app.core.config import settings


async def test_analyzer():
    print("=" * 70)
    print("RESUME ANALYZER - PRODUCTION TEST")
    print("=" * 70)
    print()

    print("1. Configuration Check...")
    if not settings.OPENAI_API_KEY:
        print("   [ERROR] OPENAI_API_KEY not configured")
        print("   Set OPENAI_API_KEY in .env file")
        return
    print(f"   [OK] API Key configured: {settings.OPENAI_API_KEY[:20]}...")
    print()

    print("2. Service Initialization...")
    try:
        print(f"   [OK] Model: {analyzer_service.llm.model_name}")
        print(f"   [OK] Temperature: {analyzer_service.llm.temperature}")
        print(f"   [OK] Max Retries: {analyzer_service.llm.max_retries}")
    except Exception as e:
        print(f"   [ERROR] {e}")
        return
    print()

    print("3. Finding Test Resume...")
    test_files = []
    uploads_dir = Path("uploads/resumes")

    if uploads_dir.exists():
        test_files = list(uploads_dir.glob("*.pdf"))[:1]

    if not test_files:
        print("   [ERROR] No PDF files found in uploads/resumes/")
        print("   Upload a resume first to test the analyzer")
        return

    test_file = str(test_files[0])
    print(f"   [OK] Test file: {os.path.basename(test_file)}")
    print(f"   [OK] Size: {os.path.getsize(test_file):,} bytes")
    print()

    print("4. PDF Text Extraction...")
    try:
        text = await analyzer_service.extract_text_from_pdf(test_file)
        print(f"   [OK] Extracted {len(text):,} characters")
        print(f"   [OK] Preview: {text[:150]}...")
    except Exception as e:
        print(f"   [ERROR] {e}")
        return
    print()

    print("5. AI Resume Analysis...")
    print("   This may take 10-15 seconds...")
    try:
        result = await analyzer_service.analyze_resume(test_file)

        if result.get("success"):
            analysis = result["analysis"]
            print()
            print("=" * 70)
            print("ANALYSIS RESULTS")
            print("=" * 70)
            print()
            print(f"Candidate: {analysis.get('candidate_name') or 'Not found'}")
            print(f"Email: {analysis.get('email') or 'Not found'}")
            print(f"Phone: {analysis.get('phone') or 'Not found'}")
            print(f"Experience: {analysis.get('experience_years') or 'Not specified'}")
            print()
            print(f"ATS Score: {analysis.get('ats_score', 0)}/100")
            print()
            print(f"Skills ({len(analysis.get('skills', []))}):")
            for skill in analysis.get('skills', [])[:10]:
                print(f"  - {skill}")
            if len(analysis.get('skills', [])) > 10:
                print(f"  ... and {len(analysis['skills']) - 10} more")
            print()
            print(f"Education ({len(analysis.get('education', []))}):")
            for edu in analysis.get('education', []):
                print(f"  - {edu}")
            print()
            print(f"Strengths ({len(analysis.get('strengths', []))}):")
            for strength in analysis.get('strengths', []):
                print(f"  + {strength}")
            print()
            print(f"Weaknesses ({len(analysis.get('weaknesses', []))}):")
            for weakness in analysis.get('weaknesses', []):
                print(f"  - {weakness}")
            print()
            print(f"Suggestions ({len(analysis.get('improvement_suggestions', []))}):")
            for i, suggestion in enumerate(analysis.get('improvement_suggestions', []), 1):
                print(f"  {i}. {suggestion}")
            print()
            print("=" * 70)
            print("[SUCCESS] Resume Analyzer Working Perfectly!")
            print("=" * 70)
        else:
            print(f"   [ERROR] {result.get('error')}")

    except Exception as e:
        print(f"   [ERROR] {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test_analyzer())
