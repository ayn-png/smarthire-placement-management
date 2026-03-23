from pydantic import BaseModel
from typing import List, Dict, Any, Optional


class PlacementStatistics(BaseModel):
    total_students: int
    total_placed: int
    placement_percentage: float
    total_companies: int
    total_jobs: int
    total_applications: int
    avg_package: Optional[float] = None
    highest_package: Optional[float] = None


class BranchWisePlacement(BaseModel):
    branch: str
    total_students: int
    placed_students: int
    placement_percentage: float


class CompanyWiseHiring(BaseModel):
    company_id: str
    company_name: str
    total_hired: int
    avg_package: Optional[float] = None


class AnalyticsDashboard(BaseModel):
    statistics: PlacementStatistics
    branch_wise: List[BranchWisePlacement] = []
    company_wise: List[CompanyWiseHiring] = []
    application_status_distribution: Dict[str, int] = {}
    monthly_applications: List[Dict[str, Any]] = []


class ReportCreate(BaseModel):
    report_type: str
    title: str
    filters: Optional[Dict[str, Any]] = None


class ReportResponse(BaseModel):
    id: str
    report_type: str
    title: str
    data: Dict[str, Any]
    created_by: str
    created_at: str
