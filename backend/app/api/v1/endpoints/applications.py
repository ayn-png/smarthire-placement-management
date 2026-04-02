from fastapi import APIRouter, Depends, Query, BackgroundTasks, HTTPException, status
from fastapi.responses import StreamingResponse
from typing import Optional
import csv
import io
import logging
from datetime import datetime
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

limiter = Limiter(key_func=get_remote_address)
from app.schemas.application import (
    ApplicationCreate, ApplicationStatusUpdate, ApplicationResponse,
    BulkStatusUpdate, BulkStatusUpdateResponse,
)
from app.services.application_service import ApplicationService
from app.middleware.auth import get_current_user, require_student, require_admin, require_admin_or_management
from app.db.database import get_database

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/applications", tags=["Applications"])

_EXPORT_LIMIT = 10000


def get_app_service(db=Depends(get_database)) -> ApplicationService:
    return ApplicationService(db)


def _parse_date(val: Optional[str], name: str) -> Optional[datetime]:
    """Parse a YYYY-MM-DD date string, raising HTTP 400 on invalid format."""
    if val is None or val == "":
        return None
    try:
        return datetime.strptime(val, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid date format for '{name}'. Expected YYYY-MM-DD (e.g. 2025-06-15).",
        )


@router.post("/", response_model=ApplicationResponse, status_code=201)
@limiter.limit("20/hour")
async def apply_for_job(
    request: Request,
    data: ApplicationCreate,
    current_user: dict = Depends(require_student),
    service: ApplicationService = Depends(get_app_service),
):
    return await service.apply(current_user, data)


@router.get("/my", response_model=dict)
async def my_applications(
    status: Optional[str] = Query(None),
    current_user: dict = Depends(require_student),
    service: ApplicationService = Depends(get_app_service),
):
    return await service.get_my_applications(current_user, status)


# Feature 6 — Interview schedule endpoint
@router.get("/my/interviews", response_model=list)
async def my_interviews(
    current_user: dict = Depends(require_student),
    service: ApplicationService = Depends(get_app_service),
):
    """Return all of the student's applications that have an interview scheduled."""
    return await service.get_my_interviews(current_user)


@router.get("/", response_model=dict)
async def list_applications(
    job_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    min_cgpa: Optional[float] = Query(None),
    from_date: Optional[str] = Query(None, description="Filter applications from this date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="Filter applications up to this date (YYYY-MM-DD)"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_admin_or_management),
    service: ApplicationService = Depends(get_app_service),
):
    # B-14: validate date format before passing to service
    _parse_date(from_date, "from_date")
    _parse_date(to_date, "to_date")
    return await service.list_applications(job_id, status, branch, min_cgpa, from_date, to_date, page, limit)


@router.get("/export-csv")
async def export_applications_csv(
    job_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    current_user: dict = Depends(require_admin_or_management),
    service: ApplicationService = Depends(get_app_service),
):
    """Export applications list as CSV file (streamed row-by-row)."""
    # B-14: validate date format
    _parse_date(from_date, "from_date")
    _parse_date(to_date, "to_date")

    result = await service.list_applications(job_id, status, branch, None, from_date, to_date, page=1, limit=_EXPORT_LIMIT)
    applications = result["applications"]

    # B-11: warn if results were capped
    truncated = len(applications) >= _EXPORT_LIMIT
    if truncated:
        logger.warning("CSV export truncated at %d records for applications", _EXPORT_LIMIT)

    def _fmt_dt(val, fmt):
        if not val:
            return "N/A"
        if isinstance(val, str):
            return val
        return val.strftime(fmt)

    async def csv_generator():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            "ID", "Student Name", "Student Email", "Roll Number", "Branch", "CGPA",
            "Job Title", "Company", "Status", "Applied Date", "Interview Date",
            "Remarks", "Resume Available"
        ])
        yield buf.getvalue()
        buf.truncate(0)
        buf.seek(0)

        for app in applications:
            writer.writerow([
                app.id,
                app.student_name or "N/A",
                app.student_email or "N/A",
                getattr(app, "student_roll_number", None) or "N/A",
                app.student_branch or "N/A",
                app.student_cgpa or "N/A",
                app.job_title or "N/A",
                app.company_name or "N/A",
                app.status or "N/A",
                _fmt_dt(app.applied_at, "%Y-%m-%d %H:%M:%S"),
                _fmt_dt(app.interview_date, "%Y-%m-%d"),
                app.remarks or "N/A",
                "Yes" if app.resume_url else "No",
            ])
            yield buf.getvalue()
            buf.truncate(0)
            buf.seek(0)

    response_headers = {"Content-Disposition": "attachment; filename=applications_export.csv"}
    if truncated:
        response_headers["X-Export-Truncated"] = "true"
        response_headers["X-Export-Warning"] = f"Results capped at {_EXPORT_LIMIT} records"

    return StreamingResponse(
        csv_generator(),
        media_type="text/csv",
        headers=response_headers,
    )


# Feature 9 — Bulk status update (before /{application_id} to avoid route conflict)
@router.post("/bulk-update", response_model=BulkStatusUpdateResponse)
async def bulk_update_status(
    data: BulkStatusUpdate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_admin_or_management),
    service: ApplicationService = Depends(get_app_service),
):
    """Update status of multiple applications in one request."""
    return await service.bulk_update_status(data, background_tasks.add_task)


@router.get("/{application_id}", response_model=ApplicationResponse)
async def get_application(
    application_id: str,
    current_user: dict = Depends(get_current_user),
    service: ApplicationService = Depends(get_app_service),
):
    return await service.get_application(application_id, current_user)


@router.patch("/{application_id}/status", response_model=ApplicationResponse)
async def update_application_status(
    application_id: str,
    data: ApplicationStatusUpdate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_admin),
    service: ApplicationService = Depends(get_app_service),
):
    return await service.update_status(application_id, data, background_tasks.add_task)


@router.post("/{application_id}/withdraw", response_model=ApplicationResponse)
async def withdraw_application(
    application_id: str,
    current_user: dict = Depends(require_student),
    service: ApplicationService = Depends(get_app_service),
):
    return await service.withdraw_application(application_id, current_user)
