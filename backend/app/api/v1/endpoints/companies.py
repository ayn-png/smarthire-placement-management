from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from typing import Optional
import csv
import io
from app.schemas.job import CompanyCreate, CompanyUpdate, CompanyResponse
from app.services.company_service import CompanyService
from app.middleware.auth import get_current_user, require_admin
from app.db.database import get_database

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
    result = await service.list_companies(industry, page=1, limit=10000)
    companies = result["companies"]

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

    return StreamingResponse(
        csv_generator(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=companies_export.csv"},
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
):
    await service.delete_company(company_id)
