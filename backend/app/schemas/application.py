from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Literal
from app.core.enums import ApplicationStatus

# B-19: Constrained interview type enum
InterviewType = Literal["IN_PERSON", "VIRTUAL", "PHONE"]


class ApplicationCreate(BaseModel):
    job_id: str
    cover_letter: Optional[str] = Field(default=None, max_length=3000)


class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus
    remarks: Optional[str] = Field(default=None, max_length=2000)
    interview_date: Optional[str] = None
    interview_link: Optional[str] = Field(default=None, max_length=500)
    interview_type: Optional[InterviewType] = None    # B-19: must be IN_PERSON, VIRTUAL, or PHONE
    interview_location: Optional[str] = Field(default=None, max_length=500)

    @field_validator("interview_link")
    @classmethod
    def validate_interview_link(cls, v):
        if v is None or v == "":
            return v
        v = v.strip()
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("interview_link must be a valid URL (http:// or https://)")
        return v

    @field_validator("interview_date")
    @classmethod
    def validate_interview_date(cls, v):
        if v is None or v == "":
            return v
        # Accept ISO 8601 datetime strings: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS
        from datetime import datetime
        for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d"):
            try:
                datetime.strptime(v.rstrip("Z").split(".")[0], fmt)
                return v
            except ValueError:
                continue
        raise ValueError("interview_date must be an ISO 8601 datetime (e.g. 2025-06-15T10:00:00)")


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
    interview_type: Optional[str] = None        # e.g. "IN_PERSON", "VIRTUAL", "PHONE"
    interview_location: Optional[str] = None
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
    # B-07: cap at 100 application IDs per request
    application_ids: List[str] = Field(..., min_length=1, max_length=100)
    status: ApplicationStatus
    remarks: Optional[str] = Field(default=None, max_length=2000)

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
