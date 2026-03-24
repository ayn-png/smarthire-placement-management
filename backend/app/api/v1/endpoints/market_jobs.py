"""
Market Jobs API endpoints — completely isolated from the internal placement system.

GET  /api/v1/market-jobs        — list + filter cached Arbeitnow jobs (student only)
POST /api/v1/market-jobs/apply  — record a student click event (student only)
GET  /api/v1/market-jobs/stats  — department-wise click counts (admin only)

Security:
  - Students can list and record clicks; they cannot access stats.
  - Admins can only access stats; they cannot list jobs or record clicks.
  - No job URL is stored. No personal data beyond student_id + department.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.db.database import get_database
from app.middleware.auth import require_admin, require_student
from app.schemas.market_jobs import (
    MarketJobClickCreate,
    MarketJobStatsResponse,
    MarketJobsResponse,
)
from app.services.market_jobs_service import MarketJobsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/market-jobs", tags=["Market Jobs"])


def _get_service(db=Depends(get_database)) -> MarketJobsService:
    return MarketJobsService(db)


@router.get("/", response_model=MarketJobsResponse)
async def list_market_jobs(
    search: Optional[str] = Query(None, description="Search in title or company name"),
    role: Optional[str] = Query(None, description="Filter by role keyword in title"),
    location: Optional[str] = Query(None, description="Filter by location keyword"),
    remote: Optional[bool] = Query(None, description="True = remote only, False = on-site only"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    limit: int = Query(12, ge=1, le=50, description="Items per page"),
    _: dict = Depends(require_student),
    svc: MarketJobsService = Depends(_get_service),
) -> MarketJobsResponse:
    """
    Return a filtered, paginated list of live market jobs from Arbeitnow.
    Results are served from a 1-hour in-memory cache to minimise external API calls.
    Accessible by STUDENT role only.
    """
    return await svc.list_jobs(search, role, location, remote, page, limit)


@router.post("/apply", status_code=201)
async def record_job_click(
    payload: MarketJobClickCreate,
    current_user: dict = Depends(require_student),
    svc: MarketJobsService = Depends(_get_service),
) -> dict:
    """
    Record that a student clicked "Apply Now" on a market job.
    Stores: student_id, department (from profile), job_title, company_name, timestamp.
    Does NOT store the job URL or any additional personal data.
    Accessible by STUDENT role only.
    """
    return await svc.record_click(current_user["id"], payload)


@router.get("/stats", response_model=MarketJobStatsResponse)
async def get_market_job_stats(
    _: dict = Depends(require_admin),
    svc: MarketJobsService = Depends(_get_service),
) -> MarketJobStatsResponse:
    """
    Return department-wise click counts for the admin dashboard.
    Shows total number of students who clicked Apply, grouped by department.
    Does NOT expose job listings, job URLs, or individual student data.
    Accessible by PLACEMENT_ADMIN role only.
    """
    return await svc.get_stats()
