from pydantic import BaseModel, field_validator, Field
from typing import Optional, List, Literal
from datetime import datetime


DriveStatus = Literal["UPCOMING", "ONGOING", "COMPLETED", "CANCELLED"]


class PlacementDriveCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5000)
    company_id: Optional[str] = None
    job_ids: List[str] = Field(default_factory=list)
    drive_date: str  # YYYY-MM-DD
    eligible_branches: List[str] = Field(default_factory=list)
    min_cgpa: float = Field(default=0.0, ge=0.0, le=10.0)
    venue: Optional[str] = Field(default=None, max_length=500)
    status: DriveStatus = "UPCOMING"

    @field_validator("drive_date")
    @classmethod
    def validate_drive_date(cls, v):
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError("drive_date must be in YYYY-MM-DD format")
        return v


class PlacementDriveUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5000)
    company_id: Optional[str] = None
    job_ids: Optional[List[str]] = None
    drive_date: Optional[str] = None
    eligible_branches: Optional[List[str]] = None
    min_cgpa: Optional[float] = Field(default=None, ge=0.0, le=10.0)
    venue: Optional[str] = Field(default=None, max_length=500)
    status: Optional[DriveStatus] = None

    @field_validator("drive_date")
    @classmethod
    def validate_drive_date(cls, v):
        if v is None:
            return v
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError("drive_date must be in YYYY-MM-DD format")
        return v


class PlacementDriveResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    job_ids: List[str] = []
    drive_date: str
    eligible_branches: List[str] = []
    min_cgpa: float = 0.0
    venue: Optional[str] = None
    status: str
    created_at: str
    updated_at: str
