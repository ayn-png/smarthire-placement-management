from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime
import re


class StudentProfileCreate(BaseModel):
    full_name: str
    roll_number: str
    branch: str
    semester: int
    cgpa: float
    phone: str
    date_of_birth: Optional[str] = None
    address: Optional[str] = None
    skills: List[str] = []
    certifications: List[str] = []
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    about: Optional[str] = None
    sgpa: Optional[float] = None
    marksheet_url: Optional[str] = None

    @field_validator("cgpa")
    @classmethod
    def validate_cgpa(cls, v):
        if not 0.0 <= v <= 10.0:
            raise ValueError("CGPA must be between 0.0 and 10.0")
        return round(v, 2)

    @field_validator("sgpa")
    @classmethod
    def validate_sgpa(cls, v):
        if v is not None and not 0.0 <= v <= 10.0:
            raise ValueError("SGPA must be between 0.0 and 10.0")
        return round(v, 2) if v is not None else v

    @field_validator("semester")
    @classmethod
    def validate_semester(cls, v):
        if not 1 <= v <= 10:
            raise ValueError("Semester must be between 1 and 10")
        return v

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v):
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Full name must be at least 2 characters")
        if not re.match(r'^[A-Za-z\s]+$', v):
            raise ValueError("Name must contain only letters and spaces")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        digits_only = re.sub(r'\D', '', str(v))
        if len(digits_only) != 10:
            raise ValueError("Phone number must be exactly 10 digits")
        return digits_only


class StudentProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    branch: Optional[str] = None
    semester: Optional[int] = None
    cgpa: Optional[float] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    address: Optional[str] = None
    skills: Optional[List[str]] = None
    certifications: Optional[List[str]] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    about: Optional[str] = None
    sgpa: Optional[float] = None
    marksheet_url: Optional[str] = None

    @field_validator("cgpa")
    @classmethod
    def validate_cgpa(cls, v):
        if v is not None and not 0.0 <= v <= 10.0:
            raise ValueError("CGPA must be between 0.0 and 10.0")
        return round(v, 2) if v is not None else v

    @field_validator("sgpa")
    @classmethod
    def validate_sgpa(cls, v):
        if v is not None and not 0.0 <= v <= 10.0:
            raise ValueError("SGPA must be between 0.0 and 10.0")
        return round(v, 2) if v is not None else v

    @field_validator("semester")
    @classmethod
    def validate_semester(cls, v):
        if v is not None and not 1 <= v <= 10:
            raise ValueError("Semester must be between 1 and 10")
        return v

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v):
        if v is None:
            return v
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Full name must be at least 2 characters")
        if not re.match(r'^[A-Za-z\s]+$', v):
            raise ValueError("Name must contain only letters and spaces")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        if v is None:
            return v
        digits_only = re.sub(r'\D', '', str(v))
        if len(digits_only) != 10:
            raise ValueError("Phone number must be exactly 10 digits")
        return digits_only


class StudentProfileResponse(BaseModel):
    id: str
    user_id: str
    full_name: str
    email: str
    roll_number: str
    branch: str
    semester: int
    cgpa: float
    phone: str
    date_of_birth: Optional[str] = None
    address: Optional[str] = None
    skills: List[str] = []
    certifications: List[str] = []
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    about: Optional[str] = None
    avatar_url: Optional[str] = None
    resume_url: Optional[str] = None
    sgpa: Optional[float] = None
    marksheet_url: Optional[str] = None
    created_at: str
    updated_at: str


class ResumeUploadResponse(BaseModel):
    resume_url: str
    filename: str
    message: str


class AvatarUploadResponse(BaseModel):
    avatar_url: str
    message: str


class MarksheetUploadResponse(BaseModel):
    marksheet_url: str
    extracted_data: dict  # {roll_number, full_name, semester, branch, sgpa}
    message: str
