from fastapi import APIRouter, Depends, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from typing import Optional, List
import csv
import io
import asyncio
import logging
from app.schemas.student import (
    StudentProfileCreate, StudentProfileUpdate, StudentProfileResponse,
    ResumeUploadResponse, AvatarUploadResponse, MarksheetUploadResponse,
    OfferLetterUploadResponse, PlacedStatusUpdate, AadharDocUploadResponse,
)

logger = logging.getLogger(__name__)
from app.services.student_service import StudentService
from app.middleware.auth import get_current_user, require_student, require_admin
from app.utils.file_upload import save_resume, save_avatar, save_marksheet, save_marksheet_10th, save_marksheet_12th, save_aadhar_doc
from app.db.database import get_database
from app.db.helpers import utcnow

router = APIRouter(prefix="/students", tags=["Students"])


def get_student_service(db=Depends(get_database)) -> StudentService:
    return StudentService(db)


@router.post("/profile", response_model=StudentProfileResponse, status_code=201)
async def create_profile(
    data: StudentProfileCreate,
    current_user: dict = Depends(require_student),
    service: StudentService = Depends(get_student_service),
):
    return await service.create_profile(current_user, data)


@router.get("/profile/me", response_model=StudentProfileResponse)
async def get_my_profile(
    current_user: dict = Depends(require_student),
    service: StudentService = Depends(get_student_service),
):
    return await service.get_profile(current_user)


@router.put("/profile/me", response_model=StudentProfileResponse)
async def update_my_profile(
    data: StudentProfileUpdate,
    current_user: dict = Depends(require_student),
    service: StudentService = Depends(get_student_service),
):
    return await service.update_profile(current_user, data)


@router.post("/resume", response_model=ResumeUploadResponse)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_student),
    service: StudentService = Depends(get_student_service),
):
    resume_url = await save_resume(file, current_user["id"])
    await service.update_resume_url(current_user, resume_url)
    return ResumeUploadResponse(
        resume_url=resume_url,
        filename=file.filename,
        message="Resume uploaded successfully",
    )


# Feature 8 — Profile Photo Upload
@router.post("/avatar", response_model=AvatarUploadResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_student),
    service: StudentService = Depends(get_student_service),
):
    avatar_url = await save_avatar(file, current_user["id"])
    await service.update_avatar_url(current_user, avatar_url)
    return AvatarUploadResponse(
        avatar_url=avatar_url,
        message="Avatar uploaded successfully",
    )


@router.post("/marksheet", response_model=MarksheetUploadResponse)
async def upload_marksheet(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_student),
    service: StudentService = Depends(get_student_service),
):
    """Upload a marksheet PDF or image; auto-extracts student data via OpenAI."""
    from app.services.marksheet_service import extract_marksheet_data

    marksheet_url = await save_marksheet(file, current_user["id"])

    # Try to update profile (may fail if profile not created yet — that's OK)
    try:
        await service.update_marksheet_url(current_user, marksheet_url)
    except Exception:
        pass  # Profile may not exist yet; URL will be used in create_profile payload

    extracted_data = await extract_marksheet_data(marksheet_url)

    return MarksheetUploadResponse(
        marksheet_url=marksheet_url,
        extracted_data=extracted_data,
        message="Marksheet uploaded successfully",
    )


@router.get("/profile/{profile_id}", response_model=StudentProfileResponse)
async def get_student_profile(
    profile_id: str,
    current_user: dict = Depends(get_current_user),
    service: StudentService = Depends(get_student_service),
):
    return await service.get_profile_by_id(profile_id)


@router.get("/", response_model=dict)
async def list_students(
    branch: Optional[str] = Query(None),
    min_cgpa: Optional[float] = Query(None),
    max_cgpa: Optional[float] = Query(None),
    skills: Optional[List[str]] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    _: dict = Depends(require_admin),  # B-10: enforce admin/management role via dependency
    service: StudentService = Depends(get_student_service),
):
    return await service.list_students(branch, min_cgpa, max_cgpa, skills, page, limit)


@router.get("/documents", response_model=list)
async def get_student_documents(
    has_resume: Optional[bool] = Query(None),
    has_offer_letter: Optional[bool] = Query(None),
    has_aadhar: Optional[bool] = Query(None),
    current_user: dict = Depends(require_admin),
    service: StudentService = Depends(get_student_service),
):
    """Admin: Get all students with their document upload status."""
    result = await service.list_students(page=1, limit=10000)
    students = result["profiles"]

    docs_list = []
    for s in students:
        # Also fetch verification status
        doc_entry = {
            "student_id": s.id,
            "student_name": s.full_name,
            "roll_number": s.roll_number,
            "email": s.email,
            "resume_url": s.resume_url,
            "marksheet_url": s.marksheet_url,
            "marksheet_10th_url": getattr(s, "marksheet_10th_url", None),
            "marksheet_12th_url": getattr(s, "marksheet_12th_url", None),
            "offer_letter_url": getattr(s, "offer_letter_url", None),
            "aadhar_doc_url": getattr(s, "aadhar_doc_url", None),
        }

        # Apply filters
        if has_resume is not None:
            if has_resume and not doc_entry["resume_url"]:
                continue
            if not has_resume and doc_entry["resume_url"]:
                continue
        if has_offer_letter is not None:
            if has_offer_letter and not doc_entry["offer_letter_url"]:
                continue
            if not has_offer_letter and doc_entry["offer_letter_url"]:
                continue
        if has_aadhar is not None:
            if has_aadhar and not doc_entry["aadhar_doc_url"]:
                continue
            if not has_aadhar and doc_entry["aadhar_doc_url"]:
                continue

        docs_list.append(doc_entry)

    return docs_list


@router.get("/export-csv")
async def export_students_csv(
    branch: Optional[str] = Query(None),
    min_cgpa: Optional[float] = Query(None),
    max_cgpa: Optional[float] = Query(None),
    current_user: dict = Depends(require_admin),
    service: StudentService = Depends(get_student_service),
):
    """Export students list as CSV file."""
    _EXPORT_LIMIT = 10000
    result = await service.list_students(branch, min_cgpa, max_cgpa, None, page=1, limit=_EXPORT_LIMIT)
    students = result["profiles"]

    # B-11: warn if results were capped
    truncated = len(students) >= _EXPORT_LIMIT
    if truncated:
        logger.warning("CSV export truncated at %d records for students", _EXPORT_LIMIT)

    async def csv_generator():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            "ID", "Name", "Email", "Roll Number", "Branch", "Semester",
            "CGPA", "Phone", "LinkedIn", "GitHub", "Skills", "Resume Available",
            "Placed", "Placed Company"
        ])
        yield buf.getvalue()
        buf.truncate(0)
        buf.seek(0)

        for student in students:
            writer.writerow([
                student.id,
                student.full_name,
                student.email,
                student.roll_number,
                student.branch,
                student.semester or "N/A",
                student.cgpa,
                student.phone or "N/A",
                student.linkedin_url or "N/A",
                student.github_url or "N/A",
                ", ".join(student.skills) if student.skills else "N/A",
                "Yes" if student.resume_url else "No",
                "Yes" if getattr(student, "is_placed", False) else "No",
                getattr(student, "placed_company", None) or "N/A",
            ])
            yield buf.getvalue()
            buf.truncate(0)
            buf.seek(0)

    response_headers = {"Content-Disposition": "attachment; filename=students_export.csv"}
    if truncated:
        response_headers["X-Export-Truncated"] = "true"
        response_headers["X-Export-Warning"] = f"Results capped at {_EXPORT_LIMIT} records"

    return StreamingResponse(
        csv_generator(),
        media_type="text/csv",
        headers=response_headers,
    )


# Feature 3 — Offer letter upload
@router.post("/offer-letter", response_model=OfferLetterUploadResponse)
async def upload_offer_letter(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_student),
    service: StudentService = Depends(get_student_service),
):
    """Upload a signed offer letter PDF to Cloudinary."""
    from app.utils.file_upload import save_offer_letter
    offer_url = await save_offer_letter(file, current_user["id"])
    await service.update_offer_letter_url(current_user, offer_url)
    return OfferLetterUploadResponse(
        offer_letter_url=offer_url,
        message="Offer letter uploaded successfully",
    )


@router.post("/marksheet-10th")
async def upload_marksheet_10th(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_student),
    service: StudentService = Depends(get_student_service),
):
    """Upload 10th standard marksheet."""
    url = await save_marksheet_10th(file, current_user["id"])
    try:
        await asyncio.to_thread(
            service.db.collection("student_profiles").document(current_user["id"]).set,
            {"marksheet_10th_url": url, "updated_at": utcnow()},
            merge=True,
        )
    except Exception:
        pass
    return {"marksheet_10th_url": url, "message": "10th marksheet uploaded successfully"}


@router.post("/marksheet-12th")
async def upload_marksheet_12th(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_student),
    service: StudentService = Depends(get_student_service),
):
    """Upload 12th standard marksheet."""
    url = await save_marksheet_12th(file, current_user["id"])
    try:
        await asyncio.to_thread(
            service.db.collection("student_profiles").document(current_user["id"]).set,
            {"marksheet_12th_url": url, "updated_at": utcnow()},
            merge=True,
        )
    except Exception:
        pass
    return {"marksheet_12th_url": url, "message": "12th marksheet uploaded successfully"}


@router.post("/aadhar-doc", response_model=AadharDocUploadResponse)
async def upload_aadhar_doc(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_student),
    service: StudentService = Depends(get_student_service),
):
    """Upload Aadhar/Govt ID document for identity verification."""
    from fastapi import HTTPException
    # Guard: profile must exist
    doc = await asyncio.to_thread(
        service.db.collection("student_profiles").document(current_user["id"]).get
    )
    if not doc.exists or not doc.to_dict().get("full_name"):
        raise HTTPException(status_code=422, detail="Please complete your student profile before uploading documents.")

    url = await save_aadhar_doc(file, current_user["id"])
    await asyncio.to_thread(
        service.db.collection("student_profiles").document(current_user["id"]).update,
        {"aadhar_doc_url": url, "updated_at": utcnow()},
    )
    return AadharDocUploadResponse(aadhar_doc_url=url, message="Aadhar document uploaded successfully")


# Feature 3 — Admin marks student as placed
@router.patch("/{student_id}/placed-status", response_model=StudentProfileResponse)
async def update_placed_status(
    student_id: str,
    data: PlacedStatusUpdate,
    current_user: dict = Depends(require_admin),
    service: StudentService = Depends(get_student_service),
):
    """Admin marks a student as placed at a company."""
    return await service.update_placed_status(student_id, data, current_user)
