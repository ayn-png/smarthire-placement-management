from pydantic import BaseModel, Field
from typing import Optional, List
from app.core.enums import ApplicationStatus


class ApplicationCreate(BaseModel):
    job_id: str
    cover_letter: Optional[str] = Field(default=None, max_length=3000)


class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus
    remarks: Optional[str] = None
    interview_date: Optional[str] = None
    interview_link: Optional[str] = None
    interview_type: Optional[str] = None    # e.g. "TECHNICAL", "HR", "MANAGERIAL"
    interview_location: Optional[str] = None  # Physical address or "Online"


class ApplicationResponse(BaseModel):
    id: str
    job_id: str
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    student_id: str
    student_name: Optional[str] = None
    student_email: Optional[str] = None
    student_cgpa: Optional[float] = None
    student_branch: Optional[str] = None
    cover_letter: Optional[str] = None
    status: ApplicationStatus
    remarks: Optional[str] = None
    interview_date: Optional[str] = None
    interview_link: Optional[str] = None
    interview_type: Optional[str] = None        # e.g. "TECHNICAL", "HR", "MANAGERIAL"
    interview_location: Optional[str] = None    # Physical address or "Online"
    resume_url: Optional[str] = None
    applied_at: str
    updated_at: str


class ApplicationFilterParams(BaseModel):
    job_id: Optional[str] = None
    status: Optional[ApplicationStatus] = None
    branch: Optional[str] = None
    min_cgpa: Optional[float] = None
    max_cgpa: Optional[float] = None


# Feature 9 — Bulk update schemas
class BulkStatusUpdate(BaseModel):
    application_ids: List[str]
    status: ApplicationStatus
    remarks: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "application_ids": ["abc123", "def456"],
                "status": "SHORTLISTED",
                "remarks": "Shortlisted for technical round",
            }
        }


class BulkStatusUpdateResponse(BaseModel):
    updated_count: int
    failed_ids: List[str] = []
    message: str
