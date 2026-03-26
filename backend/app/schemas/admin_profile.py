"""
Pydantic schemas for Placement Admin personal profile.
"""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


class PlacementAdminProfileCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    phone: str = Field(..., pattern=r"^\d{10}$", description="10-digit phone number")
    college_name: str = Field(..., min_length=2, max_length=200)
    designation: str = Field(..., min_length=2, max_length=150)


class PlacementAdminProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    phone: Optional[str] = Field(default=None, pattern=r"^\d{10}$")
    college_name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    designation: Optional[str] = Field(default=None, min_length=2, max_length=150)


class PlacementAdminProfileResponse(BaseModel):
    id: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    college_name: Optional[str] = None
    designation: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class AdminAvatarUploadResponse(BaseModel):
    avatar_url: str
    message: str
