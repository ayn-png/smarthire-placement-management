from pydantic import BaseModel, field_validator, Field
from typing import Optional, List, Annotated
from datetime import datetime, date
import re


# Reusable annotated type: individual skill/cert item (max 100 chars each)
_SkillItem = Annotated[str, Field(max_length=100)]


class StudentProfileCreate(BaseModel):
    full_name: str
    roll_number: str
    branch: str
    semester: int
    cgpa: float
    phone: str
    date_of_birth: Optional[str] = None
    address: Optional[str] = Field(default=None, max_length=500)
    skills: List[_SkillItem] = Field(default_factory=list, max_length=50)
    certifications: List[_SkillItem] = Field(default_factory=list, max_length=20)
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    about: Optional[str] = Field(default=None, max_length=1000)
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

    @field_validator("roll_number")
    @classmethod
    def validate_roll_number(cls, v):
        v = v.strip()
        if not re.match(r'^[A-Za-z0-9\-/]{3,30}$', v):
            raise ValueError("Roll number must be 3–30 characters (letters, digits, hyphens, slashes only)")
        return v

    @field_validator("linkedin_url")
    @classmethod
    def validate_linkedin_url(cls, v):
        if v is None or v == "":
            return v
        v = v.strip()
        if not (v.startswith("https://linkedin.com/") or v.startswith("https://www.linkedin.com/")):
            raise ValueError("LinkedIn URL must start with https://linkedin.com/ or https://www.linkedin.com/")
        return v

    @field_validator("github_url")
    @classmethod
    def validate_github_url(cls, v):
        if v is None or v == "":
            return v
        v = v.strip()
        if not v.startswith("https://github.com/"):
            raise ValueError("GitHub URL must start with https://github.com/")
        return v

    @field_validator("date_of_birth")
    @classmethod
    def validate_date_of_birth(cls, v):
        if v is None or v == "":
            return v
        try:
            dob = datetime.strptime(v, "%Y-%m-%d").date()
        except ValueError:
            raise ValueError("date_of_birth must be in YYYY-MM-DD format")
        today = date.today()
        if dob >= today:
            raise ValueError("date_of_birth must be a past date")
        age = (today - dob).days // 365
        if age < 15:
            raise ValueError("Student must be at least 15 years old")
        return v


class StudentProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    branch: Optional[str] = None
    semester: Optional[int] = None
    cgpa: Optional[float] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    address: Optional[str] = Field(default=None, max_length=500)
    skills: Optional[List[_SkillItem]] = Field(default=None, max_length=50)
    certifications: Optional[List[_SkillItem]] = Field(default=None, max_length=20)
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    about: Optional[str] = Field(default=None, max_length=1000)
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

    @field_validator("linkedin_url")
    @classmethod
    def validate_linkedin_url(cls, v):
        if v is None or v == "":
            return v
        v = v.strip()
        if not (v.startswith("https://linkedin.com/") or v.startswith("https://www.linkedin.com/")):
            raise ValueError("LinkedIn URL must start with https://linkedin.com/ or https://www.linkedin.com/")
        return v

    @field_validator("github_url")
    @classmethod
    def validate_github_url(cls, v):
        if v is None or v == "":
            return v
        v = v.strip()
        if not v.startswith("https://github.com/"):
            raise ValueError("GitHub URL must start with https://github.com/")
        return v

    @field_validator("date_of_birth")
    @classmethod
    def validate_date_of_birth(cls, v):
        if v is None or v == "":
            return v
        try:
            dob = datetime.strptime(v, "%Y-%m-%d").date()
        except ValueError:
            raise ValueError("date_of_birth must be in YYYY-MM-DD format")
        today = date.today()
        if dob >= today:
            raise ValueError("date_of_birth must be a past date")
        age = (today - dob).days // 365
        if age < 15:
            raise ValueError("Student must be at least 15 years old")
        return v


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
    offer_letter_url: Optional[str] = None
    is_placed: bool = False
    placed_company: Optional[str] = None
    placed_package: Optional[float] = None
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


class OfferLetterUploadResponse(BaseModel):
    offer_letter_url: str
    message: str


class PlacedStatusUpdate(BaseModel):
    is_placed: bool
    placed_company: Optional[str] = Field(default=None, max_length=200)
    placed_package: Optional[float] = Field(default=None, ge=0.0, le=500.0)
