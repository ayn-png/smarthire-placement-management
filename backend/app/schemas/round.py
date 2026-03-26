"""
Pydantic schemas for the Rounds module.
"""
from __future__ import annotations
from typing import Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime


RoundType = Literal["WRITTEN", "TECHNICAL", "HR", "GROUP_DISCUSSION", "APTITUDE"]
RoundResult = Literal["PENDING", "PASS", "FAIL"]


class RoundCreate(BaseModel):
    application_id: str
    job_id: str
    student_id: str
    round_number: int = Field(..., ge=1, le=10)
    round_name: str = Field(..., max_length=200)
    round_type: RoundType
    scheduled_date: str  # ISO string
    venue: Optional[str] = Field(default=None, max_length=300)
    meeting_link: Optional[str] = Field(default=None, max_length=500)


class RoundUpdate(BaseModel):
    round_name: Optional[str] = Field(default=None, max_length=200)
    round_type: Optional[RoundType] = None
    scheduled_date: Optional[str] = None
    venue: Optional[str] = Field(default=None, max_length=300)
    meeting_link: Optional[str] = Field(default=None, max_length=500)


class RoundResultUpdate(BaseModel):
    result: RoundResult
    admin_notes: Optional[str] = Field(default=None, max_length=1000)


class RoundResponse(BaseModel):
    id: str
    application_id: str
    job_id: str
    student_id: str
    round_number: int
    round_name: str
    round_type: str
    scheduled_date: str
    venue: Optional[str] = None
    meeting_link: Optional[str] = None
    result: str = "PENDING"
    admin_notes: Optional[str] = None
    created_at: str
    updated_at: str
