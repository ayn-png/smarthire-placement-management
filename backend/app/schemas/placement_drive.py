from pydantic import BaseModel, field_validator, Field
from typing import Optional, List, Literal
from datetime import datetime


DriveStatus = Literal["UPCOMING", "ONGOING", "COMPLETED", "CANCELLED"]
DriveType = Literal["ON_CAMPUS", "OFF_CAMPUS", "INTERNSHIP", "PPO"]
VenueType = Literal["ONLINE", "OFFLINE", "HYBRID"]
ModeType = Literal["ONLINE", "OFFLINE"]
GenderPref = Literal["ANY", "MALE", "FEMALE"]


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
    # New fields
    drive_type: DriveType = "ON_CAMPUS"
    drive_time: Optional[str] = None  # HH:MM
    venue_type: VenueType = "OFFLINE"
    mode: ModeType = "OFFLINE"
    batch: Optional[str] = None  # "2024", "2025", "2026"
    backlog_allowed: bool = False
    max_backlogs: Optional[int] = Field(default=None, ge=0)
    gap_allowed: bool = False
    gender_preference: GenderPref = "ANY"
    rounds: List[str] = Field(default_factory=list)
    openings: int = Field(default=1, ge=1)

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
    # New fields (all Optional for partial updates)
    drive_type: Optional[DriveType] = None
    drive_time: Optional[str] = None
    venue_type: Optional[VenueType] = None
    mode: Optional[ModeType] = None
    batch: Optional[str] = None
    backlog_allowed: Optional[bool] = None
    max_backlogs: Optional[int] = Field(default=None, ge=0)
    gap_allowed: Optional[bool] = None
    gender_preference: Optional[GenderPref] = None
    rounds: Optional[List[str]] = None
    openings: Optional[int] = Field(default=None, ge=1)

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
    job_id: Optional[str] = None  # Auto-created job's ID
    drive_date: str
    eligible_branches: List[str] = []
    min_cgpa: float = 0.0
    venue: Optional[str] = None
    status: str
    # New fields in response
    drive_type: str = "ON_CAMPUS"
    drive_time: Optional[str] = None
    venue_type: str = "OFFLINE"
    mode: str = "OFFLINE"
    batch: Optional[str] = None
    backlog_allowed: bool = False
    max_backlogs: Optional[int] = None
    gap_allowed: bool = False
    gender_preference: str = "ANY"
    rounds: List[str] = Field(default_factory=list)
    openings: int = 1
    created_at: str
    updated_at: str
