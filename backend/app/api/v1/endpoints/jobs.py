from fastapi import APIRouter, Depends, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from typing import Optional, List
import asyncio
import csv
import io
from app.schemas.job import JobCreate, JobUpdate, JobResponse
from app.services.job_service import JobService
from app.middleware.auth import get_current_user, require_admin
from app.db.database import get_database
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["Jobs"])


def get_job_service(db=Depends(get_database)) -> JobService:
    return JobService(db)


async def _notify_students_about_new_job(db, job: JobResponse) -> None:
    """
    Background task: notify students whose branch matches the new job's
    allowed_branches. Capped at settings.NOTIFICATION_BATCH_LIMIT (default 500).
    """
    try:
        from app.services.notification_service import NotificationService
        notif_svc = NotificationService(db)

        allowed = getattr(job, "allowed_branches", None) or []
        cap = settings.NOTIFICATION_BATCH_LIMIT

        def _get_profiles():
            if allowed:
                # Firestore "in" supports up to 30 items per query
                results = []
                for i in range(0, len(allowed), 30):
                    chunk = allowed[i:i + 30]
                    docs = db.collection("student_profiles").where("branch", "in", chunk).limit(cap).get()
                    results.extend(docs)
                return results
            return db.collection("student_profiles").limit(cap).get()

        raw_docs = await asyncio.to_thread(_get_profiles)
        profiles = [{"user_id": d.to_dict().get("user_id")} for d in raw_docs if d.exists]

        # B-16: log warning when cap is hit
        if len(profiles) >= cap:
            logger.warning(
                "Notification cap hit: notified %d students (cap=%d) for job %s. "
                "Some eligible students were not notified.",
                len(profiles), cap, getattr(job, "id", "unknown"),
            )

        company_name = ""
        if getattr(job, "company_id", None):
            def _get_company_name():
                doc = db.collection("companies").document(job.company_id).get()
                return doc.to_dict().get("name", "") if doc.exists else ""
            company_name = await asyncio.to_thread(_get_company_name)

        title = f"New Job: {job.title}" + (f" at {company_name}" if company_name else "")
        salary_info = ""
        if getattr(job, "salary_min", None) or getattr(job, "salary_max", None):
            parts = []
            if job.salary_min:
                parts.append(f"₹{job.salary_min} LPA")
            if job.salary_max and job.salary_max != job.salary_min:
                parts.append(f"₹{job.salary_max} LPA")
            salary_info = f" • {' – '.join(parts)}" if parts else ""
        message = f"{getattr(job, 'job_type', '')} role{salary_info}. Check the Jobs page to apply."

        for p in profiles:
            user_id = p.get("user_id")
            if user_id:
                await notif_svc.create(
                    user_id=str(user_id),
                    title=title,
                    message=message,
                    link="/student/jobs",
                )
    except Exception as exc:
        logger.warning("New-job notification task failed: %s", exc)


@router.post("/", response_model=JobResponse, status_code=201)
async def create_job(
    data: JobCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_admin),
    service: JobService = Depends(get_job_service),
    db=Depends(get_database),
):
    job = await service.create_job(data)
    background_tasks.add_task(_notify_students_about_new_job, db, job)
    return job


@router.get("/", response_model=dict)
async def list_jobs(
    status: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    min_cgpa: Optional[float] = Query(None),
    skills: Optional[List[str]] = Query(None),
    job_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    service: JobService = Depends(get_job_service),
):
    return await service.list_jobs(status, branch, min_cgpa, skills, job_type, page, limit)


@router.get("/export-csv")
async def export_jobs_csv(
    status: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    current_user: dict = Depends(require_admin),
    service: JobService = Depends(get_job_service),
):
    """Export jobs list as CSV file (streamed row-by-row)."""
    _EXPORT_LIMIT = 10000
    result = await service.list_jobs(status, None, None, None, job_type, page=1, limit=_EXPORT_LIMIT)
    jobs = result["jobs"]

    # B-11: warn if results were capped
    truncated = len(jobs) >= _EXPORT_LIMIT
    if truncated:
        logger.warning("CSV export truncated at %d records for jobs", _EXPORT_LIMIT)

    def _fmt_date(val, fmt):
        if not val:
            return "N/A"
        if isinstance(val, str):
            return val
        return val.strftime(fmt)

    async def csv_generator():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            "ID", "Title", "Company", "Job Type", "Location", "Salary Min (LPA)",
            "Salary Max (LPA)", "Min CGPA", "Openings", "Status", "Application Deadline",
            "Required Skills", "Allowed Branches", "Created At"
        ])
        yield buf.getvalue()
        buf.truncate(0)
        buf.seek(0)

        for job in jobs:
            writer.writerow([
                job.id,
                job.title,
                job.company_name or "N/A",
                job.job_type or "N/A",
                job.location or "N/A",
                job.salary_min or "N/A",
                job.salary_max or "N/A",
                job.min_cgpa or "N/A",
                job.openings or "N/A",
                job.status or "N/A",
                _fmt_date(job.application_deadline, "%Y-%m-%d"),
                ", ".join(job.required_skills) if job.required_skills else "N/A",
                ", ".join(job.allowed_branches) if job.allowed_branches else "N/A",
                _fmt_date(job.created_at, "%Y-%m-%d %H:%M:%S"),
            ])
            yield buf.getvalue()
            buf.truncate(0)
            buf.seek(0)

    response_headers = {"Content-Disposition": "attachment; filename=jobs_export.csv"}
    if truncated:
        response_headers["X-Export-Truncated"] = "true"
        response_headers["X-Export-Warning"] = f"Results capped at {_EXPORT_LIMIT} records"

    return StreamingResponse(
        csv_generator(),
        media_type="text/csv",
        headers=response_headers,
    )


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    current_user: dict = Depends(get_current_user),
    service: JobService = Depends(get_job_service),
):
    return await service.get_job(job_id)


@router.put("/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: str,
    data: JobUpdate,
    current_user: dict = Depends(require_admin),
    service: JobService = Depends(get_job_service),
):
    return await service.update_job(job_id, data)


@router.delete("/{job_id}", status_code=204)
async def delete_job(
    job_id: str,
    current_user: dict = Depends(require_admin),
    service: JobService = Depends(get_job_service),
    db=Depends(get_database),
):
    # B-09: Before deleting the job, withdraw all pending/active applications
    _ACTIVE_STATUSES = ["PENDING", "UNDER_REVIEW", "SHORTLISTED", "INTERVIEW_SCHEDULED"]

    def _withdraw_applications():
        withdrawn = 0
        for status_val in _ACTIVE_STATUSES:
            docs = db.collection("applications").where("job_id", "==", job_id).where("status", "==", status_val).get()
            for doc in docs:
                doc.reference.update({
                    "status": "WITHDRAWN",
                    "remarks": "Job posting removed",
                })
                withdrawn += 1
        return withdrawn

    withdrawn_count = await asyncio.to_thread(_withdraw_applications)
    if withdrawn_count:
        logger.info("Withdrew %d active applications for deleted job %s", withdrawn_count, job_id)

    await service.delete_job(job_id)
