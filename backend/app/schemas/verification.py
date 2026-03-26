from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


VerificationStatus = Literal["PENDING", "VERIFIED", "REJECTED"]
ConfidenceLevel = Literal["HIGH", "MEDIUM", "LOW"]


class VerificationSubmitRequest(BaseModel):
    doc_url: str = Field(..., description="Cloudinary URL of the uploaded Aadhar/Govt ID document")


class VerificationReviewRequest(BaseModel):
    status: Literal["VERIFIED", "REJECTED"]
    admin_notes: Optional[str] = Field(default=None, max_length=2000)


class VerificationResponse(BaseModel):
    id: str
    student_id: str
    student_name: Optional[str] = None
    document_url: str
    extracted_name: Optional[str] = None
    extracted_dob: Optional[str] = None
    extracted_aadhar_last4: Optional[str] = None
    name_match: Optional[bool] = None
    dob_match: Optional[bool] = None
    aadhar_last4_match: Optional[bool] = None
    overall_confidence: Optional[ConfidenceLevel] = None
    status: VerificationStatus = "PENDING"
    admin_notes: Optional[str] = None
    submitted_at: str
    reviewed_at: Optional[str] = None
    reviewed_by: Optional[str] = None
