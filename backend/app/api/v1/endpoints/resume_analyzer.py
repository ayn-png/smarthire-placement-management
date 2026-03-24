import os
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.middleware.auth import require_student
from app.db.database import get_database
from app.services.student_service import StudentService
from app.services.resume_analyzer import get_analyzer_service
from app.utils.file_upload import BASE_DIR

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/resume-analyzer", tags=["Resume Analyzer"])


class AnalyzeRequest(BaseModel):
    job_description: Optional[str] = None


class AnalysisResponse(BaseModel):
    success: bool
    analysis: Optional[dict] = None
    error: Optional[str] = None


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_resume(
    request: AnalyzeRequest,
    current_user: dict = Depends(require_student),
    db=Depends(get_database)
):
    """
    Analyze student's uploaded resume using AI

    Flow:
    1. Get student profile and resume URL
    2. Validate resume file exists
    3. Extract text from PDF
    4. Analyze using OpenAI + LangChain
    5. Return structured analysis
    """
    try:
        student_service = StudentService(db)
        profile = await student_service.get_profile(current_user)

        if not profile.resume_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No resume uploaded. Please upload your resume first."
            )

        resume_url = profile.resume_url
        cleanup_temp = False
        file_path = None

        if resume_url.startswith("http"):
            # Resume stored on Cloudinary — download to a temp file for analysis
            import tempfile
            import httpx
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.get(resume_url)
            if r.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Could not fetch resume from cloud storage. Please re-upload.",
                )
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
            tmp.write(r.content)
            tmp.close()
            file_path = tmp.name
            cleanup_temp = True
        else:
            # Legacy: resume stored as local relative path
            file_path = os.path.join(BASE_DIR, resume_url.lstrip("/"))
            if not os.path.isfile(file_path):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Resume file not found on server. Please re-upload your resume.",
                )

        logger.info(f"Analyzing resume for user {current_user['id']}: {os.path.basename(file_path)}")

        try:
            svc = get_analyzer_service()
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(e),
            )

        result = await svc.analyze_resume(
            file_path=file_path,
            job_description=request.job_description
        )

        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=result.get("error", "Analysis failed")
            )

        return AnalysisResponse(
            success=True,
            analysis=result["analysis"],
            error=None
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Resume analysis error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to analyze resume. Please try again later."
        )

    finally:
        # Clean up temp file if we downloaded from Cloudinary
        if cleanup_temp and file_path and os.path.exists(file_path):
            try:
                os.unlink(file_path)
            except Exception:
                pass


@router.get("/health")
async def health_check():
    """Health check endpoint for resume analyzer service"""
    try:
        from app.core.config import settings
        if not settings.OPENAI_API_KEY:
            return {
                "status": "error",
                "message": "OpenAI API key not configured"
            }

        return {
            "status": "healthy",
            "service": "resume_analyzer",
            "model": "gpt-4o-mini",
            "configured": True
        }

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "error",
            "message": str(e)
        }
