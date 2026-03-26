from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from typing import Optional
import csv
import io
import asyncio
import logging
from app.schemas.job import CompanyCreate, CompanyUpdate, CompanyResponse
from app.services.company_service import CompanyService
from app.middleware.auth import get_current_user, require_admin
from app.db.database import get_database

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/companies", tags=["Companies"])


def get_company_service(db=Depends(get_database)) -> CompanyService:
    return CompanyService(db)


# ── Admin CRUD ──────────────────────────────────────────────────────────────
@router.post("/", response_model=CompanyResponse, status_code=201)
async def create_company(
    data: CompanyCreate,
    current_user: dict = Depends(require_admin),
    service: CompanyService = Depends(get_company_service),
):
    return await service.create_company(data)


@router.get("/", response_model=dict)
async def list_companies(
    industry: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    service: CompanyService = Depends(get_company_service),
):
    return await service.list_companies(industry, page, limit)


@router.get("/export-csv")
async def export_companies_csv(
    industry: Optional[str] = Query(None),
    current_user: dict = Depends(require_admin),
    service: CompanyService = Depends(get_company_service),
):
    """Export companies list as CSV file (streamed row-by-row)."""
    _EXPORT_LIMIT = 10000
    result = await service.list_companies(industry, page=1, limit=_EXPORT_LIMIT)
    companies = result["companies"]

    # B-11: warn if results were capped
    truncated = len(companies) >= _EXPORT_LIMIT
    if truncated:
        logger.warning("CSV export truncated at %d records for companies", _EXPORT_LIMIT)

    def _fmt_dt(val):
        if not val:
            return "N/A"
        if isinstance(val, str):
            return val
        return val.strftime("%Y-%m-%d %H:%M:%S")

    async def csv_generator():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            "ID", "Name", "Industry", "Location", "Contact Email",
            "Contact Person", "Website", "Created At"
        ])
        yield buf.getvalue()
        buf.truncate(0)
        buf.seek(0)

        for company in companies:
            writer.writerow([
                company.id,
                company.name,
                company.industry or "N/A",
                company.location or "N/A",
                company.contact_email,
                company.contact_person or "N/A",
                company.website or "N/A",
                _fmt_dt(company.created_at),
            ])
            yield buf.getvalue()
            buf.truncate(0)
            buf.seek(0)

    response_headers = {"Content-Disposition": "attachment; filename=companies_export.csv"}
    if truncated:
        response_headers["X-Export-Truncated"] = "true"
        response_headers["X-Export-Warning"] = f"Results capped at {_EXPORT_LIMIT} records"

    return StreamingResponse(
        csv_generator(),
        media_type="text/csv",
        headers=response_headers,
    )


@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company(
    company_id: str,
    current_user: dict = Depends(get_current_user),
    service: CompanyService = Depends(get_company_service),
):
    return await service.get_company(company_id)


@router.put("/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: str,
    data: CompanyUpdate,
    current_user: dict = Depends(require_admin),
    service: CompanyService = Depends(get_company_service),
):
    return await service.update_company(company_id, data)


@router.delete("/{company_id}", status_code=204)
async def delete_company(
    company_id: str,
    current_user: dict = Depends(require_admin),
    service: CompanyService = Depends(get_company_service),
    db=Depends(get_database),
):
    # B-08: Before deleting the company, soft-close all its jobs
    def _close_company_jobs():
        jobs = db.collection("jobs").where("company_id", "==", company_id).get()
        closed = 0
        for doc in jobs:
            doc.reference.update({"status": "CLOSED"})
            closed += 1
        return closed

    closed_count = await asyncio.to_thread(_close_company_jobs)
    if closed_count:
        logger.info("Soft-closed %d jobs for deleted company %s", closed_count, company_id)

    await service.delete_company(company_id)
