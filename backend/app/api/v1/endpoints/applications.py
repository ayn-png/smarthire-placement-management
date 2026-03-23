from fastapi import APIRouter, Depends, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from typing import Optional
import csv
import io
from app.schemas.application import (
    ApplicationCreate, ApplicationStatusUpdate, ApplicationResponse,
    BulkStatusUpdate, BulkStatusUpdateResponse,           # Feature 9
)
from app.services.application_service import ApplicationService
from app.middleware.auth import get_current_user, require_student, require_admin
from app.db.database import get_database

router = APIRouter(prefix="/applications", tags=["Applications"])


def get_app_service(db=Depends(get_database)) -> ApplicationService:
    return ApplicationService(db)


@router.post("/", response_model=ApplicationResponse, status_code=201)
async def apply_for_job(
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
    current_user: dict = Depends(require_admin),
    service: ApplicationService = Depends(get_app_service),
):
    return await service.list_applications(job_id, status, branch, min_cgpa, from_date, to_date, page, limit)


@router.get("/export-csv")
async def export_applications_csv(
    job_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    current_user: dict = Depends(require_admin),
    service: ApplicationService = Depends(get_app_service),
):
    """Export applications list as CSV file (streamed row-by-row)."""
    result = await service.list_applications(job_id, status, branch, None, None, None, page=1, limit=10000)
    applications = result["applications"]

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
                app.student_roll_number or "N/A",
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

    return StreamingResponse(
        csv_generator(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=applications_export.csv"},
    )


# Feature 9 — Bulk status update (before /{application_id} to avoid route conflict)
@router.post("/bulk-update", response_model=BulkStatusUpdateResponse)
async def bulk_update_status(
    data: BulkStatusUpdate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_admin),
    service: ApplicationService = Depends(get_app_service),
):
    """Update status of multiple applications in one request (Feature 9)."""
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
    background_tasks: BackgroundTasks,                    # Feature 1
    current_user: dict = Depends(require_admin),
    service: ApplicationService = Depends(get_app_service),
):
    """Feature 1 — pass add_task so the service queues email in background."""
    return await service.update_status(application_id, data, background_tasks.add_task)


@router.post("/{application_id}/withdraw", response_model=ApplicationResponse)
async def withdraw_application(
    application_id: str,
    current_user: dict = Depends(require_student),
    service: ApplicationService = Depends(get_app_service),
):
    return await service.withdraw_application(application_id, current_user)
