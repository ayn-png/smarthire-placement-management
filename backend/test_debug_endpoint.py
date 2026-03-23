"""
Add a debug endpoint to test PDF extraction directly
"""

from fastapi import APIRouter
import os
from app.utils.file_upload import BASE_DIR

router = APIRouter(prefix="/debug", tags=["Debug"])

@router.get("/test-pdf/{user_id}/{filename}")
async def test_pdf_extraction(user_id: str, filename: str):
    """Debug endpoint to test PDF extraction"""

    resume_url = f"/uploads/resumes/{user_id}_{filename}"
    relative_path = resume_url.lstrip("/")
    file_path = os.path.join(BASE_DIR, relative_path)

    result = {
        "resume_url": resume_url,
        "relative_path": relative_path,
        "BASE_DIR": BASE_DIR,
        "file_path": file_path,
        "file_exists": os.path.isfile(file_path),
    }

    if os.path.isfile(file_path):
        result["file_size"] = os.path.getsize(file_path)

        # Test extraction
        try:
            from app.api.v1.endpoints.ai_resume import _extract_text_sync
            text = _extract_text_sync(file_path)
            result["extraction_success"] = True
            result["text_length"] = len(text)
            result["sample_text"] = text[:200]
        except Exception as e:
            result["extraction_success"] = False
            result["error"] = str(e)

    return result

print("Debug router created. Import this in main.py to add the endpoint.")
