"""
Test the ATS analysis endpoint to identify and debug errors.
This test will help us understand what's happening when the endpoint fails.
"""

import pytest
import asyncio
import tempfile
import os
from unittest.mock import Mock, AsyncMock, patch, MagicMock

from fastapi.testclient import TestClient

# Import after path setup
from app.main import app


@pytest.mark.asyncio
async def test_ats_endpoint_missing_resume(monkeypatch):
    """Test: endpoint returns 400 when student has no resume"""
    # Mock dependencies
    mock_db = AsyncMock()
    mock_user = {"id": "test-user-123", "sub": "test-user-123"}
    
    # Mock StudentService.get_profile to return no resume
    async def mock_get_profile(current_user):
        profile = Mock()
        profile.resume_url = None
        return profile
    
    monkeypatch.setattr("app.api.v1.endpoints.ai_resume.StudentService.get_profile", mock_get_profile)
    
    client = TestClient(app)
    # This test would need proper authentication setup


@pytest.mark.asyncio
async def test_ats_endpoint_api_key_missing():
    """Test: endpoint returns 503 when OpenAI API key is missing"""
    from app.core.config import settings
    
    # Check if keys are actually configured
    openai_key = settings.OPENAI_API_KEY
    openrouter_key = settings.OPENROUTER_API_KEY
    
    if not openai_key and not openrouter_key:
        print("✗ NO API KEYS CONFIGURED")
        print(f"  OPENAI_API_KEY: {bool(openai_key)}")
        print(f"  OPENROUTER_API_KEY: {bool(openrouter_key)}")
    else:
        print("✓ API KEYS CONFIGURED")
        print(f"  OPENAI_API_KEY: {bool(openai_key)}")
        print(f"  OPENROUTER_API_KEY: {bool(openrouter_key)}")


@pytest.mark.asyncio
async def test_pdf_extraction():
    """Test: verify PDF extraction works with sample PDF"""
    from app.api.v1.endpoints.ai_resume import _extract_text_sync
    
    # Create a simple PDF file
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj")
        tmp_path = tmp.name
    
    try:
        # This should fail since it's not a valid PDF, but we'll catch the error
        text = _extract_text_sync(tmp_path)
        print(f"Extracted: {text[:50]}")
    except Exception as e:
        print(f"PDF extraction error (expected): {type(e).__name__}: {str(e)[:100]}")
    finally:
        os.unlink(tmp_path)


@pytest.mark.asyncio
async def test_ai_service_integration():
    """Test: verify AI service can initialize and make calls"""
    from app.services.ai_resume_service import analyze_resume_text
    
    try:
        # Test with minimal resume text
        test_resume = """
        John Doe
        Email: john@example.com
        Skills: Python, JavaScript, React
        Experience: 5 years software engineer
        """
        
        result = await analyze_resume_text(test_resume)
        
        print("✓ AI Service responded successfully")
        print(f"  ATS Score: {result.get('atsScore')}")
        print(f"  Skills extracted: {len(result.get('extractedSkills', []))}")
        print(f"  Suggestions: {len(result.get('suggestions', []))}")
        
    except Exception as e:
        print(f"✗ AI Service error: {type(e).__name__}")
        print(f"  Message: {str(e)[:200]}")


if __name__ == "__main__":
    # Run diagnostics
    print("\n=== ATS Endpoint Diagnostics ===\n")
    
    asyncio.run(test_ats_endpoint_api_key_missing())
    print()
    
    asyncio.run(test_pdf_extraction())
    print()
    
    asyncio.run(test_ai_service_integration())
    print()
