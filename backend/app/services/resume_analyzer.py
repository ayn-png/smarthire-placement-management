import os
import json
import logging
import asyncio
from typing import Optional, Dict, Any
from langchain_community.document_loaders import PyPDFLoader
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field
from app.core.config import settings

logger = logging.getLogger(__name__)


class ResumeAnalysis(BaseModel):
    candidate_name: Optional[str] = Field(None, description="Full name of the candidate")
    email: Optional[str] = Field(None, description="Email address")
    phone: Optional[str] = Field(None, description="Phone number")
    skills: list[str] = Field(default_factory=list, description="List of technical and soft skills")
    experience_years: Optional[str] = Field(None, description="Years of experience")
    education: list[str] = Field(default_factory=list, description="Education qualifications")
    projects: list[str] = Field(default_factory=list, description="Notable projects")
    strengths: list[str] = Field(default_factory=list, description="Key strengths")
    weaknesses: list[str] = Field(default_factory=list, description="Areas for improvement")
    ats_score: int = Field(0, ge=0, le=100, description="ATS compatibility score 0-100")
    improvement_suggestions: list[str] = Field(default_factory=list, description="Actionable suggestions")


class ResumeAnalyzerService:
    def __init__(self):
        use_openrouter = bool(settings.OPENROUTER_API_KEY)
        use_openai = bool(settings.OPENAI_API_KEY) and not use_openrouter

        if not (use_openai or use_openrouter):
            raise ValueError("OPENAI_API_KEY or OPENROUTER_API_KEY not configured in environment")

        model_name = "gpt-4o-mini" if use_openai else "openai/gpt-4o-mini"
        api_key = settings.OPENAI_API_KEY if use_openai else settings.OPENROUTER_API_KEY

        llm_kwargs = {
            "model": model_name,
            "temperature": 0,
            "openai_api_key": api_key,
            "timeout": 60,
            "max_retries": 2,
        }
        if use_openrouter and not use_openai:
            llm_kwargs["base_url"] = "https://openrouter.ai/api/v1"

        self.llm = ChatOpenAI(**llm_kwargs)

        self.parser = JsonOutputParser(pydantic_object=ResumeAnalysis)

        self.prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert ATS (Applicant Tracking System) resume analyst and career advisor.
Your task is to analyze resumes professionally and provide structured feedback.

Be strict, professional, and realistic in your assessment.
Follow ATS scoring guidelines:
- 0-40: Poor structure, missing critical sections, weak content
- 41-60: Basic resume with gaps, needs significant improvement
- 61-75: Solid resume with room for enhancement
- 76-90: Strong, well-optimized resume
- 91-100: Exceptional, near-perfect resume

Extract all available information and provide actionable feedback.
If information is not available, use null for strings or empty arrays for lists.

{format_instructions}"""),
            ("human", """Analyze this resume text and return structured JSON analysis:

{resume_text}

Return ONLY valid JSON matching the schema. No markdown, no explanations.""")
        ])

    async def extract_text_from_pdf(self, file_path: str) -> str:
        """Extract text from PDF using PyPDFLoader"""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"PDF file not found: {file_path}")

        file_size = os.path.getsize(file_path)
        if file_size == 0:
            raise ValueError("PDF file is empty")

        if file_size > 10 * 1024 * 1024:  # 10MB limit
            raise ValueError("PDF file too large (max 10MB)")

        try:
            loader = PyPDFLoader(file_path)
            documents = await asyncio.to_thread(loader.load)

            if not documents:
                raise ValueError("No content could be extracted from PDF")

            text = "\n\n".join([doc.page_content for doc in documents if doc.page_content])

            if not text or len(text.strip()) < 50:
                raise ValueError("Insufficient text extracted from PDF. Ensure it's not a scanned image.")

            logger.info(f"Extracted {len(text)} characters from PDF")
            return text.strip()

        except Exception as e:
            logger.error(f"PDF extraction failed: {e}")
            raise ValueError(f"Failed to extract text from PDF: {str(e)}")

    async def analyze_resume(self, file_path: str, job_description: Optional[str] = None) -> Dict[str, Any]:
        """Complete resume analysis pipeline"""
        try:
            resume_text = await self.extract_text_from_pdf(file_path)

            if job_description:
                resume_text += f"\n\n--- TARGET JOB DESCRIPTION ---\n{job_description}\n--- END JOB DESCRIPTION ---"

            chain = self.prompt | self.llm | self.parser

            result = await chain.ainvoke({
                "resume_text": resume_text[:8000],  # Token limit protection
                "format_instructions": self.parser.get_format_instructions()
            })

            if not isinstance(result, dict):
                result = json.loads(str(result))

            analysis = self._validate_and_sanitize(result)

            logger.info(f"Resume analysis completed. ATS Score: {analysis.get('ats_score', 0)}")

            return {
                "success": True,
                "analysis": analysis
            }

        except FileNotFoundError as e:
            logger.error(f"File not found: {e}")
            return {
                "success": False,
                "error": "Resume file not found. Please upload your resume first."
            }

        except ValueError as e:
            logger.error(f"Validation error: {e}")
            return {
                "success": False,
                "error": str(e)
            }

        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error: {e}")
            return {
                "success": False,
                "error": "Failed to parse AI response. Please try again."
            }

        except Exception as e:
            logger.error(f"Unexpected error during analysis: {e}", exc_info=True)
            return {
                "success": False,
                "error": "An unexpected error occurred during analysis. Please try again later."
            }

    def _validate_and_sanitize(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and sanitize analysis result"""
        sanitized = {
            "candidate_name": self._clean_string(data.get("candidate_name")),
            "email": self._clean_string(data.get("email")),
            "phone": self._clean_string(data.get("phone")),
            "skills": self._clean_list(data.get("skills", [])),
            "experience_years": self._clean_string(data.get("experience_years")),
            "education": self._clean_list(data.get("education", [])),
            "projects": self._clean_list(data.get("projects", [])),
            "strengths": self._clean_list(data.get("strengths", [])),
            "weaknesses": self._clean_list(data.get("weaknesses", [])),
            "ats_score": self._clean_score(data.get("ats_score", 0)),
            "improvement_suggestions": self._clean_list(data.get("improvement_suggestions", []))
        }

        return sanitized

    def _clean_string(self, value: Any) -> Optional[str]:
        """Clean and validate string values"""
        if value is None or value == "":
            return None
        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned if cleaned else None
        return str(value).strip() or None

    def _clean_list(self, value: Any) -> list[str]:
        """Clean and validate list values"""
        if not isinstance(value, list):
            return []
        cleaned = [
            str(item).strip()
            for item in value
            if item and str(item).strip()
        ]
        return cleaned[:20]  # Limit list size

    def _clean_score(self, value: Any) -> int:
        """Clean and validate ATS score"""
        try:
            score = int(value)
            return max(0, min(100, score))
        except (ValueError, TypeError):
            return 0


# Lazy singleton — do NOT instantiate at import time.
# A missing OPENAI_API_KEY would raise ValueError and crash the entire server
# on startup. Instead, create the instance on first use inside the endpoint.
_analyzer_instance: ResumeAnalyzerService | None = None


def get_analyzer_service() -> ResumeAnalyzerService:
    """Return (and lazily create) the singleton ResumeAnalyzerService."""
    global _analyzer_instance
    if _analyzer_instance is None:
        _analyzer_instance = ResumeAnalyzerService()
    return _analyzer_instance


# Back-compat name kept so existing imports don't break.
# Value is None until first call to get_analyzer_service().
analyzer_service: ResumeAnalyzerService | None = None
