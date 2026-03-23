import csv
import io
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from app.schemas.analytics import AnalyticsDashboard, ReportCreate, ReportResponse
from app.services.analytics_service import AnalyticsService
from app.middleware.auth import require_admin_or_management, require_admin
from app.db.database import get_database
from app.core.config import settings

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def get_analytics_service(db=Depends(get_database)) -> AnalyticsService:
    return AnalyticsService(db)


@router.get("/system-status")
async def get_system_status(
    current_user: dict = Depends(require_admin),
):
    """Return configuration health status for services used by the platform."""
    return {
        "smtp": {
            "configured": bool(settings.SMTP_HOST and settings.SMTP_USER),
            "host": settings.SMTP_HOST or None,
        },
        "openai": {
            "configured": bool(settings.OPENAI_API_KEY),
        },
        "mistral": {
            "configured": bool(settings.MISTRAL_API_KEY),
        },
    }


@router.get("/dashboard", response_model=AnalyticsDashboard)
async def get_dashboard(
    current_user: dict = Depends(require_admin_or_management),
    service: AnalyticsService = Depends(get_analytics_service),
):
    return await service.get_dashboard()


@router.post("/reports", response_model=ReportResponse, status_code=201)
async def create_report(
    data: ReportCreate,
    current_user: dict = Depends(require_admin),
    service: AnalyticsService = Depends(get_analytics_service),
):
    return await service.create_report(current_user, data)


@router.get("/reports", response_model=dict)
async def list_reports(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_admin_or_management),
    service: AnalyticsService = Depends(get_analytics_service),
):
    return await service.list_reports(page, limit)


@router.get("/export-csv")
async def export_csv(
    current_user: dict = Depends(require_admin_or_management),
    service: AnalyticsService = Depends(get_analytics_service),
):
    """Export full analytics dashboard as a downloadable CSV file."""
    dashboard = await service.get_dashboard()
    stats = dashboard.statistics

    output = io.StringIO()
    writer = csv.writer(output)

    # ── Summary section ───────────────────────────────────────────────────────
    writer.writerow(["SmartHire — Placement Analytics Export"])
    writer.writerow([])
    writer.writerow(["SUMMARY"])
    writer.writerow(["Metric", "Value"])
    writer.writerow(["Total Students", stats.total_students])
    writer.writerow(["Total Placed", stats.total_placed])
    writer.writerow(["Placement %", f"{stats.placement_percentage}%"])
    writer.writerow(["Total Companies", stats.total_companies])
    writer.writerow(["Total Jobs", stats.total_jobs])
    writer.writerow(["Total Applications", stats.total_applications])
    writer.writerow(["Avg Package (LPA)", stats.avg_package if stats.avg_package else "N/A"])
    writer.writerow(["Highest Package (LPA)", stats.highest_package if stats.highest_package else "N/A"])

    # ── Branch-wise section ───────────────────────────────────────────────────
    writer.writerow([])
    writer.writerow(["BRANCH-WISE PLACEMENT"])
    writer.writerow(["Branch", "Total Students", "Placed Students", "Placement %"])
    for b in dashboard.branch_wise:
        writer.writerow([b.branch, b.total_students, b.placed_students, f"{b.placement_percentage}%"])

    # ── Company-wise section ──────────────────────────────────────────────────
    writer.writerow([])
    writer.writerow(["COMPANY-WISE HIRING"])
    writer.writerow(["Company", "Students Hired"])
    for c in dashboard.company_wise:
        writer.writerow([c.company_name, c.total_hired])

    # ── Application status distribution ──────────────────────────────────────
    writer.writerow([])
    writer.writerow(["APPLICATION STATUS DISTRIBUTION"])
    writer.writerow(["Status", "Count"])
    for status, count in dashboard.application_status_distribution.items():
        writer.writerow([status, count])

    # ── Monthly trend ─────────────────────────────────────────────────────────
    writer.writerow([])
    writer.writerow(["MONTHLY APPLICATIONS (Last 12 Months)"])
    writer.writerow(["Year", "Month", "Applications"])
    for m in dashboard.monthly_applications:
        writer.writerow([m["year"], m["month"], m["count"]])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=smarthire_analytics.csv"},
    )


@router.get("/department")
async def get_department_analytics(
    current_user: dict = Depends(require_admin_or_management),
    db=Depends(get_database),
):
    """
    Department-level placement analytics — richer than the dashboard summary.
    Returns per-branch: total students, placed, avg package, highest package,
    top companies, and application funnel breakdown.
    All Firestore queries wrapped in asyncio.to_thread(); aggregation done in Python.
    """
    import asyncio
    from collections import defaultdict
    from app.core.enums import ApplicationStatus

    # Fetch all needed collections in parallel.
    # Fetch ALL applications once (with only the fields needed) to avoid a
    # double collection scan (was previously fetching SELECTED first, then ALL).
    profile_docs, all_app_docs, job_docs = await asyncio.gather(
        asyncio.to_thread(db.collection("student_profiles").select(["branch", "user_id"]).get),
        asyncio.to_thread(
            db.collection("applications")
            .select(["status", "student_id", "job_id"])
            .get
        ),
        asyncio.to_thread(db.collection("jobs").select(["salary_max", "salary_min", "company_id"]).get),
    )

    # Build lookup maps
    profiles = {d.id: (d.to_dict() or {}) for d in profile_docs if d.exists}
    jobs_map = {d.id: (d.to_dict() or {}) for d in job_docs if d.exists}

    # Split applications in Python — no second Firestore query needed
    all_apps = [d.to_dict() or {} for d in all_app_docs if d.exists]
    app_docs = [a for a in all_apps if a.get("status") == ApplicationStatus.SELECTED.value]

    # Branch → total students
    branch_totals: dict[str, int] = defaultdict(int)
    for uid, p in profiles.items():
        branch = p.get("branch") or "Unknown"
        branch_totals[branch] += 1

    # Branch → salary stats and company set (from SELECTED applications)
    branch_salaries: dict[str, list[float]] = defaultdict(list)
    branch_companies: dict[str, set] = defaultdict(set)
    branch_placed: dict[str, int] = defaultdict(int)

    for app in app_docs:
        student_id = app.get("student_id", "")
        job_id = app.get("job_id", "")
        profile = profiles.get(student_id, {})
        branch = profile.get("branch") or "Unknown"
        branch_placed[branch] += 1

        job = jobs_map.get(job_id, {})
        salary = job.get("salary_max") or job.get("salary_min")
        if salary:
            try:
                branch_salaries[branch].append(float(salary))
            except (TypeError, ValueError):
                pass
        company_id = job.get("company_id", "")
        if company_id:
            branch_companies[branch].add(company_id)

    # Build all-applications funnel per branch — reuse already-fetched all_apps
    branch_funnel: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for app in all_apps:
        student_id = app.get("student_id", "")
        status_val = app.get("status", "NO_APPLICATION")
        profile = profiles.get(student_id, {})
        branch = profile.get("branch") or "Unknown"
        branch_funnel[branch][status_val] += 1

    # Compile results for all known branches
    all_branches = set(branch_totals.keys()) | set(branch_placed.keys())
    departments = []
    for branch in all_branches:
        total = branch_totals.get(branch, 0)
        placed = branch_placed.get(branch, 0)
        salaries = branch_salaries.get(branch, [])
        avg_salary = round(sum(salaries) / len(salaries), 2) if salaries else None
        max_salary = max(salaries) if salaries else None

        departments.append({
            "branch": branch,
            "total_students": total,
            "placed_students": placed,
            "placement_percentage": round((placed / total * 100) if total > 0 else 0, 2),
            "avg_package_lpa": avg_salary,
            "highest_package_lpa": max_salary,
            "application_funnel": dict(branch_funnel.get(branch, {})),
            "companies_hired": len(branch_companies.get(branch, set())),
        })

    departments.sort(key=lambda x: x["placed_students"], reverse=True)
    return {"departments": departments, "total_branches": len(departments)}
