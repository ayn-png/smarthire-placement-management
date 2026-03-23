from pydantic import BaseModel, field_validator, model_validator
from typing import Optional, List
from datetime import datetime, timezone
from app.core.enums import JobType, JobStatus


class CompanyCreate(BaseModel):
    name: str
    industry: str
    description: Optional[str] = None
    website: Optional[str] = None
    location: str
    contact_email: str
    contact_person: Optional[str] = None
    logo_url: Optional[str] = None


class CompanyUpdate(BaseModel):
    industry: Optional[str] = None
    description: Optional[str] = None
    website: Optional[str] = None
    location: Optional[str] = None
    contact_email: Optional[str] = None
    contact_person: Optional[str] = None
    logo_url: Optional[str] = None


class CompanyResponse(BaseModel):
    id: str
    name: str
    industry: str
    description: Optional[str] = None
    website: Optional[str] = None
    location: str
    contact_email: str
    contact_person: Optional[str] = None
    logo_url: Optional[str] = None
    created_at: str
    updated_at: str



class JobCreate(BaseModel):
    title: str
    company_id: str
    description: str
    requirements: str
    required_skills: List[str] = []
    job_type: JobType = JobType.FULL_TIME
    location: str
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    min_cgpa: float = 0.0
    allowed_branches: List[str] = []
    openings: int = 1
    application_deadline: Optional[str] = None

    @model_validator(mode="after")
    def validate_salary_range(self):
        if self.salary_min is not None and self.salary_max is not None:
            if self.salary_min > self.salary_max:
                raise ValueError("Minimum salary cannot exceed maximum salary")
        return self

    @field_validator("min_cgpa")
    @classmethod
    def validate_min_cgpa(cls, v):
        if not 0.0 <= v <= 10.0:
            raise ValueError("min_cgpa must be between 0.0 and 10.0")
        return v

    @field_validator("openings")
    @classmethod
    def validate_openings(cls, v):
        if v < 1:
            raise ValueError("Number of openings must be at least 1")
        return v

    @field_validator("application_deadline")
    @classmethod
    def validate_deadline(cls, v):
        if v:
            try:
                dt = datetime.fromisoformat(v.rstrip("Z"))
                if dt.replace(tzinfo=timezone.utc) <= datetime.now(timezone.utc):
                    raise ValueError("Application deadline must be a future date")
            except ValueError as e:
                if "future" in str(e):
                    raise
                raise ValueError("Invalid deadline format. Use ISO 8601 (e.g. 2025-12-31T23:59:59)")
        return v


class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    required_skills: Optional[List[str]] = None
    job_type: Optional[JobType] = None
    location: Optional[str] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    min_cgpa: Optional[float] = None
    allowed_branches: Optional[List[str]] = None
    openings: Optional[int] = None
    application_deadline: Optional[str] = None
    status: Optional[JobStatus] = None


class JobResponse(BaseModel):
    id: str
    title: str
    company_id: str
    company_name: Optional[str] = None
    company_logo: Optional[str] = None
    description: str
    requirements: str
    required_skills: List[str] = []
    job_type: JobType
    location: str
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    min_cgpa: float
    allowed_branches: List[str] = []
    openings: int
    application_deadline: Optional[str] = None
    status: JobStatus
    created_at: str
    updated_at: str
