"""
State Models and Schemas for Multi-Agent System (LangGraph)

Defines the shared state that flows between agents in the Supervisor workflow.
"""

from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field
from datetime import datetime


# ==================== RESUME EXTRACTION MODELS ====================

class PersonalInfo(BaseModel):
    """Extracted personal information from resume"""
    name: Optional[str] = Field(None, description="Full name of candidate")
    email: Optional[str] = Field(None, description="Email address")
    phone: Optional[str] = Field(None, description="Phone number")
    location: Optional[str] = Field(None, description="Location/City")
    linkedin: Optional[str] = Field(None, description="LinkedIn profile URL")
    github: Optional[str] = Field(None, description="GitHub profile URL")
    portfolio: Optional[str] = Field(None, description="Portfolio website URL")


class Education(BaseModel):
    """Educational qualification"""
    degree: str = Field(..., description="Degree name (e.g., B.Tech in CSE)")
    institution: str = Field(..., description="Institution/University name")
    year: Optional[str] = Field(None, description="Graduation year or duration")
    cgpa: Optional[float] = Field(None, description="CGPA or percentage", ge=0, le=10)


class Experience(BaseModel):
    """Work experience entry"""
    title: str = Field(..., description="Job title/role")
    company: str = Field(..., description="Company name")
    duration: Optional[str] = Field(None, description="Duration (e.g., 'Jan 2023 - Present')")
    description: Optional[str] = Field(None, description="Brief description of responsibilities")


class Project(BaseModel):
    """Project details"""
    title: str = Field(..., description="Project name")
    description: Optional[str] = Field(None, description="Project description")
    technologies: List[str] = Field(default_factory=list, description="Technologies used")
    link: Optional[str] = Field(None, description="Project link (GitHub, demo, etc.)")


class ExtractedResume(BaseModel):
    """Complete structured resume data extracted by Resume Extraction Agent"""
    personal_info: PersonalInfo
    skills: List[str] = Field(default_factory=list, description="List of skills")
    education: List[Education] = Field(default_factory=list, description="Educational qualifications")
    experience: List[Experience] = Field(default_factory=list, description="Work experience")
    projects: List[Project] = Field(default_factory=list, description="Projects")
    certifications: List[str] = Field(default_factory=list, description="Certifications")
    raw_text: str = Field(..., description="Original extracted text from PDF")


class ResumeExtractionResult(BaseModel):
    """Result from Resume Extraction Agent"""
    status: Literal["success", "partial_success", "failed"]
    extracted_resume: Optional[ExtractedResume] = None
    confidence_score: float = Field(0.0, ge=0.0, le=1.0, description="Extraction confidence (0-1)")
    ocr_used: bool = Field(False, description="Whether OCR fallback was used")
    extraction_method: str = Field("", description="Method used (pymupdf, pdfplumber, ocr, etc.)")
    error_message: Optional[str] = None


# ==================== JOB MATCHING MODELS ====================

class JobMatchScore(BaseModel):
    """Individual job match with scoring and explanation"""
    job_id: str = Field(..., description="Job ID from database")
    job_title: str = Field(..., description="Job title")
    company_name: str = Field(..., description="Company name")
    match_score: float = Field(..., ge=0.0, le=1.0, description="Overall match score (0-1)")
    skill_match_score: float = Field(..., ge=0.0, le=1.0, description="Skill similarity score")
    experience_match: bool = Field(..., description="Whether experience level matches")
    education_match: bool = Field(..., description="Whether education criteria met")
    reasons: List[str] = Field(default_factory=list, description="Why this job matched")
    missing_skills: List[str] = Field(default_factory=list, description="Skills candidate lacks")
    matching_skills: List[str] = Field(default_factory=list, description="Skills that matched")


class JobMatchingResult(BaseModel):
    """Result from Job Matching Agent"""
    status: Literal["success", "no_matches", "failed"]
    matched_jobs: List[JobMatchScore] = Field(default_factory=list, description="Top matched jobs (max 5)")
    total_jobs_evaluated: int = Field(0, description="Total jobs in database")
    jobs_passed_filter: int = Field(0, description="Jobs that passed initial filtering")
    avg_match_score: float = Field(0.0, description="Average match score across all evaluated jobs")
    error_message: Optional[str] = None


# ==================== AGENT STATE (LangGraph) ====================

class AgentState(BaseModel):
    """
    Shared state object that flows between all agents in LangGraph workflow.
    This is the central state managed by the Supervisor Agent.
    """
    # Request metadata
    request_id: str = Field(..., description="Unique request identifier")
    user_id: str = Field(..., description="Student/user ID")
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Input data
    resume_pdf_path: str = Field(..., description="Path to uploaded resume PDF")
    job_description: Optional[str] = Field(None, description="Optional job description for matching")
    user_preferences: Dict[str, Any] = Field(default_factory=dict, description="User preferences (location, salary, etc.)")

    # Workflow state
    current_step: str = Field("initialized", description="Current workflow step")
    next_agent: Optional[str] = Field(None, description="Next agent to execute")
    retry_count: int = Field(0, description="Number of retries attempted")
    max_retries: int = Field(3, description="Maximum retries allowed")

    # Agent results
    resume_extraction_result: Optional[ResumeExtractionResult] = None
    job_matching_result: Optional[JobMatchingResult] = None

    # Error handling
    errors: List[str] = Field(default_factory=list, description="List of errors encountered")
    warnings: List[str] = Field(default_factory=list, description="List of warnings")

    # Tracing
    trace_id: Optional[str] = Field(None, description="LangSmith trace ID")
    trace_url: Optional[str] = Field(None, description="LangSmith trace URL")

    class Config:
        arbitrary_types_allowed = True


# ==================== API REQUEST/RESPONSE MODELS ====================

class MultiAgentAnalysisRequest(BaseModel):
    """Request model for multi-agent resume analysis"""
    job_description: Optional[str] = Field(None, description="Optional job description for targeted matching")
    preferences: Dict[str, Any] = Field(
        default_factory=dict,
        description="User preferences (e.g., {'min_salary': 50000, 'location': 'Remote'})"
    )


class MultiAgentAnalysisResponse(BaseModel):
    """Response model for multi-agent resume analysis"""
    success: bool
    request_id: str
    resume_analysis: Optional[ExtractedResume] = None
    job_recommendations: List[JobMatchScore] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional metadata (trace_url, processing_time, etc.)"
    )
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
