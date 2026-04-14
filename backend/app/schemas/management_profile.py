"""
Pydantic schemas for College Management personal profile.
"""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


class ManagementProfileCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    phone: str = Field(..., pattern=r"^\d{10}$", description="10-digit phone number")
    designation: str = Field(..., min_length=2, max_length=150)
    department: str = Field(..., min_length=2, max_length=200)


class ManagementProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    phone: Optional[str] = Field(default=None, pattern=r"^\d{10}$")
    designation: Optional[str] = Field(default=None, min_length=2, max_length=150)
    department: Optional[str] = Field(default=None, min_length=2, max_length=200)


class ManagementProfileResponse(BaseModel):
    id: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ManagementAvatarUploadResponse(BaseModel):
    avatar_url: str
    message: str
