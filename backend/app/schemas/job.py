from pydantic import BaseModel, EmailStr, field_validator, model_validator, Field
from typing import Optional, List
from datetime import datetime, timezone
from app.core.enums import JobType, JobStatus


class CompanyCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    industry: str = Field(..., max_length=100)
    description: Optional[str] = Field(default=None, max_length=5000)
    website: Optional[str] = Field(default=None, max_length=500)
    location: str = Field(..., max_length=200)
    contact_email: EmailStr
    contact_person: Optional[str] = Field(default=None, max_length=100)
    logo_url: Optional[str] = None

    @field_validator("website")
    @classmethod
    def validate_website(cls, v):
        if v is None or v == "":
            return v
        v = v.strip()
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("Website must start with http:// or https://")
        return v


class CompanyUpdate(BaseModel):
    industry: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = Field(default=None, max_length=5000)
    website: Optional[str] = Field(default=None, max_length=500)
    location: Optional[str] = Field(default=None, max_length=200)
    contact_email: Optional[EmailStr] = None
    contact_person: Optional[str] = Field(default=None, max_length=100)
    logo_url: Optional[str] = None

    @field_validator("website")
    @classmethod
    def validate_website(cls, v):
        if v is None or v == "":
            return v
        v = v.strip()
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("Website must start with http:// or https://")
        return v


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
    title: str = Field(..., min_length=2, max_length=200)
    company_id: str
    description: str = Field(..., min_length=10, max_length=10000)
    requirements: str = Field(..., min_length=10, max_length=5000)
    required_skills: List[str] = []
    job_type: JobType = JobType.FULL_TIME
    location: str = Field(..., max_length=200)
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
    title: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=10000)
    requirements: Optional[str] = Field(default=None, max_length=5000)
    required_skills: Optional[List[str]] = None
    job_type: Optional[JobType] = None
    location: Optional[str] = Field(default=None, max_length=200)
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    min_cgpa: Optional[float] = None
    allowed_branches: Optional[List[str]] = None
    openings: Optional[int] = None
    application_deadline: Optional[str] = None
    status: Optional[JobStatus] = None

    @model_validator(mode="after")
    def validate_salary_range(self):
        if self.salary_min is not None and self.salary_max is not None:
            if self.salary_min > self.salary_max:
                raise ValueError("Minimum salary cannot exceed maximum salary")
        return self


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
