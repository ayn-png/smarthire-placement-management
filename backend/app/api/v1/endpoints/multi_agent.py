"""
Multi-Agent AI System API Endpoints

Provides endpoints for:
1. Resume analysis and job matching using Supervisor Agent
2. Health check for multi-agent system
3. Tracing and monitoring integration
"""

import os
import logging
import tempfile
from typing import Dict, Any
import httpx
from fastapi import APIRouter, Depends, HTTPException, status, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.database import get_database
from app.middleware.auth import require_student
from app.schemas.agent_state import (
    MultiAgentAnalysisRequest,
    MultiAgentAnalysisResponse
)
from app.agents.supervisor_agent import SupervisorAgent
from app.services.student_service import StudentService
from app.utils.file_upload import BASE_DIR

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create router and limiter
router = APIRouter(prefix="/multi-agent", tags=["Multi-Agent AI System"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/analyze", response_model=MultiAgentAnalysisResponse)
@limiter.limit("10/hour")
async def analyze_resume_with_agents(
    http_request: Request,
    request: MultiAgentAnalysisRequest,
    current_user: dict = Depends(require_student),
    db = Depends(get_database)
):
    """
    Analyze student's resume and get job recommendations using Multi-Agent System.

    This endpoint triggers the Supervisor Agent which orchestrates:
    1. Resume Extraction Agent - Extracts and structures resume data
    2. Job Matching Agent - Matches resume with relevant jobs

    The workflow is managed by LangGraph and traced via LangSmith.

    **Authentication Required**: Student role

    **Request Body**:
    - `job_description` (optional): Target job description for matching
    - `preferences` (optional): User preferences (location, salary, etc.)

    **Response**:
    - `success`: Boolean indicating overall success
    - `request_id`: Unique request identifier
    - `resume_analysis`: Structured resume data
    - `job_recommendations`: List of top 5 matched jobs with scores
    - `metadata`: Additional info (trace_url, processing_time, etc.)
    - `errors`: List of errors encountered
    - `warnings`: List of warnings

    **LangSmith Tracing**:
    - View detailed trace at metadata.trace_url
    - Track agent decisions, latency, and token usage

    **Example**:
    ```json
    {
      "job_description": "Looking for Python backend developer",
      "preferences": {
        "min_salary": 50000,
        "location": "Remote"
      }
    }
    ```
    """
    try:
        logger.info(f"[API] Multi-agent analysis requested by user: {current_user['id']}")

        # Step 1: Get student profile and resume path
        student_service = StudentService(db)
        profile = await student_service.get_profile(current_user)

        if not profile.resume_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No resume uploaded. Please upload your resume first."
            )

        # Handle Cloudinary URLs vs local files
        resume_url = profile.resume_url
        temp_file_path = None

        if "cloudinary.com" in resume_url:
            # Download from Cloudinary to temp file
            logger.info(f"[API] Downloading resume from Cloudinary: {resume_url}")
            async with httpx.AsyncClient() as client:
                response = await client.get(resume_url, timeout=30.0)
                response.raise_for_status()

                # Create temp file
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
                temp_file.write(response.content)
                temp_file.close()
                temp_file_path = temp_file.name
                file_path = temp_file_path
        else:
            # Legacy local file
            relative_path = resume_url.lstrip("/")
            file_path = os.path.join(BASE_DIR, relative_path)

            # Verify file exists
            if not os.path.exists(file_path):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Resume file not found at: {resume_url}"
                )

        logger.info(f"[API] Resume path: {file_path}")

        # Step 2: Initialize Supervisor Agent
        supervisor = SupervisorAgent(db)

        # Step 3: Execute multi-agent workflow
        logger.info("[API] Starting multi-agent workflow execution")
        final_state = await supervisor.execute(
            user_id=current_user["id"],
            resume_pdf_path=file_path,
            job_description=request.job_description,
            user_preferences=request.preferences
        )

        # Step 4: Build response
        response = MultiAgentAnalysisResponse(
            success=len(final_state.errors) == 0,
            request_id=final_state.request_id,
            resume_analysis=None,
            job_recommendations=[],
            metadata={},
            errors=final_state.errors,
            warnings=final_state.warnings
        )

        # Add resume analysis if successful
        if final_state.resume_extraction_result and final_state.resume_extraction_result.extracted_resume:
            response.resume_analysis = final_state.resume_extraction_result.extracted_resume

        # Add job recommendations if successful
        if final_state.job_matching_result and final_state.job_matching_result.matched_jobs:
            response.job_recommendations = final_state.job_matching_result.matched_jobs

        # Add metadata
        response.metadata = {
            "trace_id": final_state.trace_id,
            "trace_url": final_state.trace_url,
            "timestamp": final_state.timestamp.isoformat(),
            "extraction_method": final_state.resume_extraction_result.extraction_method if final_state.resume_extraction_result else None,
            "extraction_confidence": final_state.resume_extraction_result.confidence_score if final_state.resume_extraction_result else 0.0,
            "ocr_used": final_state.resume_extraction_result.ocr_used if final_state.resume_extraction_result else False,
            "total_jobs_evaluated": final_state.job_matching_result.total_jobs_evaluated if final_state.job_matching_result else 0,
            "jobs_matched": len(response.job_recommendations)
        }

        logger.info(f"[API] Multi-agent analysis completed. Success: {response.success}")

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API] Multi-agent analysis failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Multi-agent analysis failed: {str(e)}"
        )
    finally:
        # Clean up temporary file if it was created
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                logger.info(f"[API] Cleaned up temporary file: {temp_file_path}")
            except Exception as e:
                logger.warning(f"[API] Failed to clean up temp file: {e}")


@router.get("/health")
async def health_check():
    """
    Health check endpoint for Multi-Agent AI System.

    Returns status of all components:
    - Supervisor Agent
    - Resume Extraction Agent
    - Job Matching Agent
    - LangSmith integration

    **Public Endpoint** (No authentication required)

    **Response**:
    ```json
    {
      "status": "healthy",
      "service": "multi_agent_system",
      "components": {
        "supervisor_agent": "available",
        "resume_extraction_agent": "available",
        "job_matching_agent": "available",
        "langsmith_tracing": "enabled"
      },
      "models": {
        "llm": "gpt-4o-mini",
        "embeddings": "text-embedding-3-small"
      }
    }
    ```
    """
    try:
        from app.core.config import settings
        from app.core.langsmith_config import langsmith_config

        # Check if OpenAI API key is configured
        openai_configured = bool(settings.OPENAI_API_KEY)

        # Check LangSmith configuration
        langsmith_enabled = langsmith_config.get("enabled", False)

        return {
            "status": "healthy" if openai_configured else "degraded",
            "service": "multi_agent_system",
            "components": {
                "supervisor_agent": "available" if openai_configured else "not_configured",
                "resume_extraction_agent": "available" if openai_configured else "not_configured",
                "job_matching_agent": "available" if openai_configured else "not_configured",
                "langsmith_tracing": "enabled" if langsmith_enabled else "disabled"
            },
            "models": {
                "llm": "gpt-4o-mini",
                "embeddings": "text-embedding-3-small"
            },
            "configuration": {
                "openai_api_key_configured": openai_configured,
                "langsmith_api_key_configured": langsmith_enabled,
                "langsmith_project": langsmith_config.get("project") if langsmith_enabled else None
            }
        }

    except Exception as e:
        logger.error(f"Health check failed: {str(e)}", exc_info=True)
        return {
            "status": "unhealthy",
            "service": "multi_agent_system",
            "error": str(e)
        }


@router.get("/trace/{trace_id}")
async def get_trace_info(trace_id: str):
    """
    Get LangSmith trace information for a specific request.

    **Path Parameters**:
    - `trace_id`: LangSmith trace ID from analysis response

    **Response**:
    ```json
    {
      "trace_id": "abc123...",
      "trace_url": "https://smith.langchain.com/o/default/projects/smarthire-portal/r/abc123...",
      "message": "View detailed trace in LangSmith dashboard"
    }
    ```
    """
    from app.core.langsmith_config import get_trace_url

    trace_url = get_trace_url(trace_id)

    if not trace_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LangSmith tracing is not enabled. Configure LANGCHAIN_API_KEY to enable tracing."
        )

    return {
        "trace_id": trace_id,
        "trace_url": trace_url,
        "message": "View detailed trace in LangSmith dashboard"
    }
