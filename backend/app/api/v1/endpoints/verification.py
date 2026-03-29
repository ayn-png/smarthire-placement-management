"""
Verification API endpoints — Aadhar/Govt ID identity verification.
"""
from fastapi import APIRouter, Depends, Query, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from typing import Optional

from app.schemas.verification import (
    VerificationSubmitRequest,
    VerificationReviewRequest,
    VerificationResponse,
)
from app.services.verification_service import VerificationService
from app.middleware.auth import get_current_user, require_student, require_admin, require_admin_or_management
from app.db.database import get_database

router = APIRouter(prefix="/verification", tags=["Verification"])
limiter = Limiter(key_func=get_remote_address)


def get_verification_service(db=Depends(get_database)) -> VerificationService:
    return VerificationService(db)


@router.post("/submit", response_model=VerificationResponse, status_code=201)
@limiter.limit("3/hour")
async def submit_verification(
    request: Request,
    data: VerificationSubmitRequest,
    current_user: dict = Depends(require_student),
    service: VerificationService = Depends(get_verification_service),
):
    """
    Student submits their Aadhar/Govt ID for verification.
    The system uses AI (OpenAI Vision) to extract name, DOB, and last 4 digits
    and compares with the student's profile data.
    """
    result = await service.submit_verification(current_user["id"], data.doc_url)
    return result


@router.get("/my-status")
async def get_my_verification_status(
    current_user: dict = Depends(require_student),
    service: VerificationService = Depends(get_verification_service),
):
    """Get the current verification status for the logged-in student."""
    record = await service.get_verification(current_user["id"])
    if not record:
        return {"status": "NOT_SUBMITTED", "message": "No verification submitted yet"}
    return record


@router.get("/pending")
async def list_pending_verifications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    _: dict = Depends(require_admin_or_management),
    service: VerificationService = Depends(get_verification_service),
):
    """Admin: List all pending verifications."""
    return await service.list_verifications(status="PENDING", page=page, limit=limit)


@router.get("/all")
async def list_all_verifications(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    _: dict = Depends(require_admin_or_management),
    service: VerificationService = Depends(get_verification_service),
):
    """Admin: List all verifications with optional status filter."""
    return await service.list_verifications(status=status, page=page, limit=limit)


@router.patch("/{student_id}/review")
async def review_verification(
    student_id: str,
    data: VerificationReviewRequest,
    current_user: dict = Depends(require_admin_or_management),
    service: VerificationService = Depends(get_verification_service),
):
    """Admin: Approve or reject a student's identity verification."""
    return await service.review_verification(
        student_id, current_user, data.status, data.admin_notes
    )
