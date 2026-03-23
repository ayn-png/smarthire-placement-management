"""
Analytics service — backed by Firestore.
All MongoDB aggregation pipelines replaced with Python-side aggregation.
All Firestore SDK calls wrapped in asyncio.to_thread().
"""
import asyncio
from collections import Counter, defaultdict
from datetime import datetime

from app.schemas.analytics import (
    AnalyticsDashboard, PlacementStatistics, BranchWisePlacement,
    CompanyWiseHiring, ReportCreate, ReportResponse,
)
from app.core.enums import ApplicationStatus
from app.db.helpers import utcnow


def _doc_to_dict(doc_snapshot) -> dict | None:
    if not doc_snapshot.exists:
        return None
    data = doc_snapshot.to_dict() or {}
    result = {"id": doc_snapshot.id}
    for k, v in data.items():
        if isinstance(v, datetime):
            result[k] = v.isoformat()
        else:
            result[k] = v
    return result


class AnalyticsService:
    def __init__(self, db):
        self.db = db

    async def get_dashboard(self) -> AnalyticsDashboard:
        # Fetch all base collections in parallel — select only needed fields to
        # avoid loading full document data into memory (performance optimisation).
        students_task = asyncio.to_thread(
            self.db.collection("student_profiles").select(["branch", "user_id"]).get
        )
        companies_task = asyncio.to_thread(
            self.db.collection("companies").select(["name"]).get
        )
        jobs_task = asyncio.to_thread(
            self.db.collection("jobs").select(["salary_max", "salary_min", "company_id"]).get
        )
        applications_task = asyncio.to_thread(
            self.db.collection("applications").select(["status", "student_id", "job_id", "applied_at"]).get
        )

        student_docs, company_docs, job_docs, application_docs = await asyncio.gather(
            students_task, companies_task, jobs_task, applications_task
        )

        students = [_doc_to_dict(d) for d in student_docs if d.exists]
        companies = [_doc_to_dict(d) for d in company_docs if d.exists]
        jobs = [_doc_to_dict(d) for d in job_docs if d.exists]
        applications = [_doc_to_dict(d) for d in application_docs if d.exists]

        stats = self._get_statistics(students, companies, jobs, applications)
        branch_wise = self._get_branch_wise(students, applications)
        company_wise = self._get_company_wise(jobs, companies, applications)
        status_dist = self._get_status_distribution(applications)
        monthly = self._get_monthly_applications(applications)

        return AnalyticsDashboard(
            statistics=stats,
            branch_wise=branch_wise,
            company_wise=company_wise,
            application_status_distribution=status_dist,
            monthly_applications=monthly,
        )

    def _get_statistics(
        self,
        students: list,
        companies: list,
        jobs: list,
        applications: list,
    ) -> PlacementStatistics:
        total_students = len(students)
        total_companies = len(companies)
        total_jobs = len(jobs)
        total_applications = len(applications)

        selected_apps = [a for a in applications if a.get("status") == ApplicationStatus.SELECTED.value]

        # Unique placed students
        placed_student_ids = {a["student_id"] for a in selected_apps if a.get("student_id")}
        total_placed = len(placed_student_ids)

        placement_pct = (total_placed / total_students * 100) if total_students > 0 else 0.0

        # Salary stats from selected applications only
        # Build a job_id → salary_max map
        job_salary_map = {
            j["id"]: j.get("salary_max")
            for j in jobs
            if j.get("salary_max") is not None
        }

        salaries = [
            job_salary_map[a["job_id"]]
            for a in selected_apps
            if a.get("job_id") and a["job_id"] in job_salary_map
        ]

        avg_package = (sum(salaries) / len(salaries)) if salaries else None
        highest_package = max(salaries) if salaries else None

        return PlacementStatistics(
            total_students=total_students,
            total_placed=total_placed,
            placement_percentage=round(placement_pct, 2),
            total_companies=total_companies,
            total_jobs=total_jobs,
            total_applications=total_applications,
            avg_package=round(avg_package, 2) if avg_package is not None else None,
            highest_package=highest_package,
        )

    def _get_branch_wise(self, students: list, applications: list) -> list:
        # Build set of placed student IDs
        placed_ids = {
            a["student_id"]
            for a in applications
            if a.get("status") == ApplicationStatus.SELECTED.value and a.get("student_id")
        }

        # Group by branch
        branch_totals: dict[str, int] = Counter()
        branch_placed: dict[str, int] = Counter()

        for s in students:
            branch = s.get("branch") or "Unknown"
            branch_totals[branch] += 1
            if s.get("user_id") in placed_ids or s.get("id") in placed_ids:
                branch_placed[branch] += 1

        result = []
        for branch, total in branch_totals.items():
            placed = branch_placed.get(branch, 0)
            pct = round((placed / total * 100), 2) if total > 0 else 0.0
            result.append(BranchWisePlacement(
                branch=branch,
                total_students=total,
                placed_students=placed,
                placement_percentage=pct,
            ))

        result.sort(key=lambda x: x.placed_students, reverse=True)
        return result

    def _get_company_wise(
        self,
        jobs: list,
        companies: list,
        applications: list,
    ) -> list:
        # Build lookup maps
        job_map = {j["id"]: j for j in jobs}
        company_map = {c["id"]: c for c in companies}

        # Count selected applications per job_id
        job_hire_count: dict[str, int] = Counter()
        for a in applications:
            if a.get("status") == ApplicationStatus.SELECTED.value and a.get("job_id"):
                job_hire_count[a["job_id"]] += 1

        # Aggregate by company
        company_totals: dict[str, int] = Counter()
        for job_id, count in job_hire_count.items():
            job = job_map.get(job_id)
            if not job:
                continue
            company_id = job.get("company_id")
            if company_id:
                company_totals[company_id] += count

        result = []
        for company_id, total_hired in company_totals.items():
            company = company_map.get(company_id)
            if not company:
                continue
            result.append(CompanyWiseHiring(
                company_id=company_id,
                company_name=company.get("name", "Unknown"),
                total_hired=total_hired,
            ))

        result.sort(key=lambda x: x.total_hired, reverse=True)
        return result

    def _get_status_distribution(self, applications: list) -> dict:
        counter: dict[str, int] = Counter()
        for a in applications:
            status = a.get("status")
            if status:
                counter[status] += 1
        return dict(counter)

    def _get_monthly_applications(self, applications: list) -> list:
        monthly: dict[tuple, int] = Counter()
        for a in applications:
            applied_at = a.get("applied_at")
            if not applied_at:
                continue
            try:
                dt = datetime.fromisoformat(applied_at)
                monthly[(dt.year, dt.month)] += 1
            except (ValueError, TypeError):
                continue

        result = [
            {"year": year, "month": month, "count": count}
            for (year, month), count in sorted(monthly.items())
        ]
        # Return last 12 months
        return result[-12:]

    async def create_report(self, user: dict, data: ReportCreate) -> ReportResponse:
        dashboard = await self.get_dashboard()
        now = utcnow()
        report_doc = {
            "report_type": data.report_type,
            "title": data.title,
            "filters": data.filters or {},
            "data": dashboard.model_dump(),
            "created_by": user.get("id", ""),
            "created_at": now,
        }
        _, doc_ref = await asyncio.to_thread(
            self.db.collection("reports").add, report_doc
        )
        return ReportResponse(
            id=doc_ref.id,
            report_type=data.report_type,
            title=data.title,
            data=dashboard.model_dump(),
            created_by=user.get("id", ""),
            created_at=now.isoformat(),
        )

    async def list_reports(self, page: int = 1, limit: int = 20) -> dict:
        docs = await asyncio.to_thread(
            self.db.collection("reports")
            .order_by("created_at", direction="DESCENDING")
            .get
        )
        reports_raw = [_doc_to_dict(d) for d in docs if d.exists]

        total = len(reports_raw)
        skip = (page - 1) * limit
        paginated = reports_raw[skip: skip + limit]

        reports = []
        for r in paginated:
            reports.append(ReportResponse(
                id=r["id"],
                report_type=r.get("report_type", ""),
                title=r.get("title", ""),
                data=r.get("data", {}),
                created_by=r.get("created_by", ""),
                created_at=r.get("created_at", ""),
            ))

        return {"reports": reports, "total": total, "page": page, "limit": limit}
