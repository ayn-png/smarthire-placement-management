"""
Market Jobs service.

Fetches live job listings from the free Arbeitnow public API (no auth required).
Results are cached in-memory for 1 hour to avoid excessive external API calls.
Filtering is done in Python after a cache hit (case-insensitive string contains).

Student click events (Apply Now) are stored in the Firestore `market_job_clicks`
collection — only student_id, department, job_title, company_name, clicked_at.
No job URL and no personal data beyond what is already in the student profile.

Admin stats endpoint aggregates market_job_clicks by department using Counter.
All Firestore SDK calls are wrapped in asyncio.to_thread() as required by this project.
"""
import asyncio
import logging
import httpx
from collections import Counter
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.schemas.market_jobs import (
    MarketJob,
    MarketJobsResponse,
    MarketJobClickCreate,
    DepartmentClickStat,
    MarketJobStatsResponse,
    MarketJobApplicationCreate,
    MarketJobAdminDetail,
    MarketJobAdminListResponse,
    MarketJobAnalyticsResponse,
)
from app.db.helpers import utcnow, serialize_doc

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level in-memory cache — survives across requests within one worker.
# Per-worker is acceptable; each worker independently honours the 1-hour TTL.
# ---------------------------------------------------------------------------
_CACHE: dict = {"jobs": [], "fetched_at": None}
_CACHE_TTL = timedelta(hours=1)
_ARBEITNOW_BASE = "https://www.arbeitnow.com/api/job-board-api"


def _is_cache_fresh() -> bool:
    fetched_at = _CACHE.get("fetched_at")
    if fetched_at is None:
        return False
    return (datetime.now(timezone.utc) - fetched_at) < _CACHE_TTL


async def _fetch_arbeitnow_pages() -> list:
    """
    Fetch pages 1–3 from Arbeitnow concurrently using httpx.AsyncClient.
    Partial failures (one page times out) are tolerated — we return whatever
    pages succeeded so the cache is always populated with at least some data.
    """
    jobs: list = []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            responses = await asyncio.gather(
                *[client.get(_ARBEITNOW_BASE, params={"page": p}) for p in range(1, 4)],
                return_exceptions=True,
            )
            for resp in responses:
                if isinstance(resp, Exception):
                    logger.warning("Arbeitnow page fetch failed: %s", resp)
                    continue
                if resp.status_code == 200:
                    jobs.extend(resp.json().get("data", []))
                else:
                    logger.warning("Arbeitnow returned status %d", resp.status_code)
    except Exception as exc:
        logger.error("Arbeitnow fetch error: %s", exc)
    logger.info("Arbeitnow cache refreshed — %d jobs loaded", len(jobs))
    return jobs


class MarketJobsService:
    def __init__(self, db):
        self.db = db

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_jobs_from_cache(self) -> list:
        """Return cached jobs list, refreshing the cache if stale or empty."""
        global _CACHE
        if not _is_cache_fresh():
            _CACHE["jobs"] = await _fetch_arbeitnow_pages()
            _CACHE["fetched_at"] = datetime.now(timezone.utc)
        return _CACHE["jobs"]

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def list_jobs(
        self,
        search: Optional[str] = None,
        role: Optional[str] = None,
        location: Optional[str] = None,
        remote: Optional[bool] = None,
        page: int = 1,
        limit: int = 12,
    ) -> MarketJobsResponse:
        """Return a filtered + paginated slice of the cached job list."""
        all_jobs = await self._get_jobs_from_cache()

        # Python-side filters — case-insensitive substring matching
        filtered = all_jobs

        if search:
            s = search.lower()
            filtered = [
                j for j in filtered
                if s in j.get("title", "").lower()
                or s in j.get("company_name", "").lower()
            ]

        if role:
            r = role.lower()
            filtered = [j for j in filtered if r in j.get("title", "").lower()]

        if location:
            loc = location.lower()
            filtered = [j for j in filtered if loc in j.get("location", "").lower()]

        if remote is not None:
            filtered = [j for j in filtered if j.get("remote", False) == remote]

        total = len(filtered)
        skip = (page - 1) * limit
        paginated = filtered[skip: skip + limit]

        return MarketJobsResponse(
            jobs=[MarketJob(**j) for j in paginated],
            total=total,
            page=page,
            limit=limit,
        )

    async def record_click(
        self,
        student_id: str,
        payload: MarketJobClickCreate,
    ) -> dict:
        """
        Look up the student's branch from student_profiles, then write one
        market_job_clicks document.  Only stores: student_id, department,
        job_title, company_name, clicked_at — NO job URL, NO extra PII.
        """
        # Fetch branch from student profile
        profile_doc = await asyncio.to_thread(
            self.db.collection("student_profiles").document(student_id).get
        )
        department = "Unknown"
        if profile_doc.exists:
            department = profile_doc.to_dict().get("branch", "Unknown") or "Unknown"

        click_data = {
            "student_id": student_id,
            "department": department,
            "job_title": payload.job_title,
            "company_name": payload.company_name,
            "clicked_at": utcnow(),
        }

        await asyncio.to_thread(
            self.db.collection("market_job_clicks").add,
            click_data,
        )

        return {"message": "Click recorded", "department": department}

    async def get_stats(self) -> MarketJobStatsResponse:
        """
        Aggregate market_job_clicks by department using Python Counter.
        Uses .select(["department"]) to avoid loading full documents — mirrors
        the pattern from analytics_service.py.
        """
        docs = await asyncio.to_thread(
            self.db.collection("market_job_clicks").select(["department"]).get
        )

        dept_counts: Counter = Counter()
        for doc in docs:
            if doc.exists:
                dept = doc.to_dict().get("department", "Unknown") or "Unknown"
                dept_counts[dept] += 1

        stats = [
            DepartmentClickStat(department=dept, click_count=count)
            for dept, count in dept_counts.most_common()
        ]

        return MarketJobStatsResponse(
            stats=stats,
            total_clicks=sum(dept_counts.values()),
        )

    # ------------------------------------------------------------------
    # --- NEW: Application Tracking Methods ---
    # ------------------------------------------------------------------

    async def mark_applied(self, user_id: str, payload: MarketJobApplicationCreate) -> dict:
        """
        Record that a student confirmed they applied to an external market job.
        Stores in `market_job_applications` collection.
        Checks for existing record to avoid duplicates.
        """
        # Duplicate check: {user_id, job_id}
        query = (
            self.db.collection("market_job_applications")
            .where("user_id", "==", user_id)
            .where("job_id", "==", payload.job_id)
        )
        existing = await asyncio.to_thread(query.get)
        if len(existing) > 0:
            return {"success": True, "message": "Already recorded"}

        app_data = {
            "user_id": user_id,
            "job_id": payload.job_id,
            "applied": True,
            "created_at": utcnow(),
        }

        await asyncio.to_thread(
            self.db.collection("market_job_applications").add,
            app_data,
        )

        return {"success": True, "message": "Application recorded"}

    async def get_admin_applications(
        self, branch: Optional[str] = None, min_cgpa: Optional[float] = None
    ) -> MarketJobAdminListResponse:
        """
        Fetch all market applications, join with student profiles, and filter.
        Supports filtering by branch and CGPA.
        """
        app_docs = await asyncio.to_thread(self.db.collection("market_job_applications").get)
        
        # Load all profiles once for joining - if scaling is an issue, we'd use select() 
        # but here we need specific fields for filtering and display.
        profiles_list = await asyncio.to_thread(self.db.collection("student_profiles").get)
        profiles = {doc.id: doc.to_dict() for doc in profiles_list}

        results: List[MarketJobAdminDetail] = []
        for doc in app_docs:
            data = doc.to_dict()
            uid = data.get("user_id")
            p = profiles.get(uid)
            
            if not p:
                continue

            # Apply filters
            if branch and p.get("branch") != branch:
                continue
            if min_cgpa is not None and (p.get("cgpa") or 0) < min_cgpa:
                continue

            results.append(MarketJobAdminDetail(
                user_id=uid,
                name=p.get("full_name", "Unknown"),
                email=p.get("email", "Unknown"),
                branch=p.get("branch", "Unknown"),
                cgpa=p.get("cgpa", 0.0),
                job_id=data.get("job_id", ""),
                applied_at=data.get("created_at"),
            ))

        # Sort by applied_at desc
        results.sort(key=lambda x: x.applied_at, reverse=True)

        return MarketJobAdminListResponse(
            applications=results,
            total=len(results),
        )

    async def get_management_stats(self) -> MarketJobAnalyticsResponse:
        """
        Aggregate application stats for management dashboard.
        Returns total applications, unique students, branch distribution, and avg cgpa.
        """
        app_docs = await asyncio.to_thread(self.db.collection("market_job_applications").get)
        
        uids = set()
        total_apps = 0
        branch_counts: Counter = Counter()
        cgpa_sum = 0.0
        students_with_cgpa = 0

        # Pre-fetch profiles for joining
        profiles_list = await asyncio.to_thread(self.db.collection("student_profiles").get)
        profiles = {doc.id: doc.to_dict() for doc in profiles_list}

        for doc in app_docs:
            data = doc.to_dict()
            uid = data.get("user_id")
            total_apps += 1
            uids.add(uid)

            p = profiles.get(uid)
            if p:
                branch_counts[p.get("branch", "Unknown")] += 1
                if p.get("cgpa") is not None:
                    cgpa_sum += p.get("cgpa")
                    students_with_cgpa += 1

        avg_cgpa = cgpa_sum / students_with_cgpa if students_with_cgpa > 0 else 0.0

        return MarketJobAnalyticsResponse(
            total_applications=total_apps,
            unique_students=len(uids),
            branch_distribution=dict(branch_counts),
            avg_cgpa=round(avg_cgpa, 2),
        )

