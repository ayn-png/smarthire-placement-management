from pydantic import BaseModel
from typing import List
from datetime import datetime


class MarketJob(BaseModel):
    slug: str
    company_name: str
    title: str
    description: str          # raw HTML from Arbeitnow — not rendered in list view
    tags: List[str] = []
    job_types: List[str] = []
    location: str
    remote: bool = False
    url: str
    created_at: int           # unix timestamp


class MarketJobsResponse(BaseModel):
    jobs: List[MarketJob]
    total: int
    page: int
    limit: int


class MarketJobClickCreate(BaseModel):
    job_title: str
    company_name: str


class DepartmentClickStat(BaseModel):
    department: str
    click_count: int


class MarketJobStatsResponse(BaseModel):
    stats: List[DepartmentClickStat]
    total_clicks: int
