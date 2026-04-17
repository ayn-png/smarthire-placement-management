"""
Resume Extraction Agent

Responsible for:
1. Extracting text from PDF resumes using multi-method cascade
2. Structuring raw text into JSON format using LLM
3. Validating extraction quality and providing confidence scores
4. Handling edge cases (corrupted PDFs, scanned PDFs with OCR)
"""

import os
import logging
from typing import Tuple, Optional
from langchain_community.document_loaders import PyPDFLoader
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from app.schemas.agent_state import (
    ExtractedResume,
    ResumeExtractionResult,
    PersonalInfo,
    Education,
    Experience,
    Project
)
from app.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ResumeExtractionAgent:
    """
    Agent responsible for extracting and structuring resume data from PDF files.

    Uses a multi-method approach:
    1. PyPDFLoader (LangChain) - Primary
    2. PyMuPDF (fitz) - Secondary
    3. pdfplumber - Tertiary
    4. pypdf - Quaternary
    5. OCR (Tesseract) - Final fallback for scanned PDFs
    """

    def __init__(self):
        """Initialize the Resume Extraction Agent with LLM and parsers"""
        use_openrouter = bool(settings.OPENROUTER_API_KEY)
        use_openai = bool(settings.OPENAI_API_KEY) and not use_openrouter

        if not (use_openai or use_openrouter):
            raise ValueError("OPENAI_API_KEY or OPENROUTER_API_KEY is required for Resume Extraction Agent")

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

        # Initialize LLM for structuring
        self.llm = ChatOpenAI(**llm_kwargs)

        # JSON output parser with schema
        self.parser = JsonOutputParser(pydantic_object=ExtractedResume)

        # Create prompt template for resume structuring
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert resume parser. Extract structured information from the resume text.

Extract the following information accurately:
- Personal Info: name, email, phone, location, LinkedIn, GitHub, portfolio
- Skills: List all technical and soft skills
- Education: Degree, institution, year, CGPA (if mentioned)
- Experience: Job title, company, duration, description
- Projects: Title, description, technologies, link
- Certifications: List all certifications

IMPORTANT:
- If information is not found, use null or empty list
- Be accurate and don't hallucinate information
- Extract skills as comma-separated list
- Format dates consistently
- DO NOT include raw_text in your output
- For CGPA: Convert all grades to 10-point scale (e.g., 78% = 7.8, 85% = 8.5, 3.5/4.0 = 8.75)
- CGPA must be between 0 and 10

{format_instructions}"""),
            ("human", "Resume Text:\n\n{resume_text}")
        ])

    def extract_text_from_pdf(self, file_path: str) -> Tuple[str, str]:
        """
        Extract text from PDF using multi-method cascade.

        Args:
            file_path: Path to PDF file

        Returns:
            Tuple of (extracted_text, method_used)
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Resume file not found: {file_path}")

        # Method 1: LangChain PyPDFLoader (Primary)
        try:
            logger.info(f"Attempting PDF extraction with PyPDFLoader: {file_path}")
            loader = PyPDFLoader(file_path)
            documents = loader.load()
            text = "\n\n".join([doc.page_content for doc in documents])
            if len(text.strip()) >= 50:
                logger.info(f"PyPDFLoader successful: {len(text)} characters")
                return text.strip(), "pypdfloader"
        except Exception as e:
            logger.warning(f"PyPDFLoader failed: {str(e)}")

        # Method 2: PyMuPDF (fitz)
        try:
            import fitz
            logger.info("Attempting PDF extraction with PyMuPDF")
            doc = fitz.open(file_path)
            text = ""
            for page in doc:
                text += page.get_text()
            doc.close()
            if len(text.strip()) >= 50:
                logger.info(f"PyMuPDF successful: {len(text)} characters")
                return text.strip(), "pymupdf"
        except Exception as e:
            logger.warning(f"PyMuPDF failed: {str(e)}")

        # Method 3: pdfplumber
        try:
            import pdfplumber
            logger.info("Attempting PDF extraction with pdfplumber")
            text = ""
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
            if len(text.strip()) >= 50:
                logger.info(f"pdfplumber successful: {len(text)} characters")
                return text.strip(), "pdfplumber"
        except Exception as e:
            logger.warning(f"pdfplumber failed: {str(e)}")

        # Method 4: pypdf
        try:
            import pypdf
            logger.info("Attempting PDF extraction with pypdf")
            text = ""
            with open(file_path, 'rb') as file:
                reader = pypdf.PdfReader(file)
                for page in reader.pages:
                    text += page.extract_text()
            if len(text.strip()) >= 50:
                logger.info(f"pypdf successful: {len(text)} characters")
                return text.strip(), "pypdf"
        except Exception as e:
            logger.warning(f"pypdf failed: {str(e)}")

        # Method 5: OCR Fallback (for scanned PDFs)
        try:
            from pdf2image import convert_from_path
            import pytesseract
            logger.info("Attempting PDF extraction with OCR (Tesseract)")
            images = convert_from_path(file_path, dpi=300)
            text = ""
            for i, image in enumerate(images):
                logger.info(f"OCR processing page {i+1}/{len(images)}")
                text += pytesseract.image_to_string(image, lang='eng') + "\n"
            if len(text.strip()) >= 50:
                logger.info(f"OCR successful: {len(text)} characters")
                return text.strip(), "ocr"
        except Exception as e:
            logger.error(f"OCR failed: {str(e)}")

        # All methods failed
        raise ValueError("Could not extract text from PDF using any available method")

    def calculate_confidence_score(self, extracted: ExtractedResume, raw_text: str) -> float:
        """
        Calculate confidence score for extraction quality.

        Args:
            extracted: Extracted resume data
            raw_text: Original raw text

        Returns:
            Confidence score between 0.0 and 1.0
        """
        score = 0.0

        # Check personal info completeness (40% weight)
        if extracted.personal_info.name:
            score += 0.15
        if extracted.personal_info.email:
            score += 0.15
        if extracted.personal_info.phone:
            score += 0.10

        # Check skills presence (20% weight)
        if len(extracted.skills) >= 3:
            score += 0.20

        # Check education presence (20% weight)
        if len(extracted.education) >= 1:
            score += 0.20

        # Check experience or projects (20% weight)
        if len(extracted.experience) >= 1 or len(extracted.projects) >= 1:
            score += 0.20

        return min(score, 1.0)

    async def extract_and_structure(self, file_path: str) -> ResumeExtractionResult:
        """
        Main method: Extract text from PDF and structure it using LLM.

        Args:
            file_path: Path to resume PDF file

        Returns:
            ResumeExtractionResult with structured data and metadata
        """
        try:
            # Step 1: Extract raw text from PDF
            logger.info(f"Starting resume extraction for: {file_path}")
            raw_text, extraction_method = self.extract_text_from_pdf(file_path)
            ocr_used = extraction_method == "ocr"

            # Limit text size to avoid token limits (keep first 8000 chars)
            if len(raw_text) > 8000:
                logger.warning(f"Resume text too long ({len(raw_text)} chars), truncating to 8000")
                raw_text = raw_text[:8000]

            # Step 2: Structure with LLM
            logger.info("Structuring resume text with LLM")
            chain = self.prompt | self.llm | self.parser

            structured_data = await chain.ainvoke({
                "resume_text": raw_text,
                "format_instructions": self.parser.get_format_instructions()
            })

            # Fix CGPA values if they are percentages (>10)
            if "education" in structured_data and structured_data["education"]:
                for edu in structured_data["education"]:
                    if "cgpa" in edu and edu["cgpa"] is not None:
                        # Convert percentage to 10-point scale
                        if edu["cgpa"] > 10:
                            edu["cgpa"] = round(edu["cgpa"] / 10, 2)

            # Parse into Pydantic model - add raw_text directly in constructor to avoid duplicate
            extracted_resume = ExtractedResume(raw_text=raw_text, **structured_data)

            # Step 3: Calculate confidence score
            confidence_score = self.calculate_confidence_score(extracted_resume, raw_text)

            logger.info(f"Resume extraction successful (confidence: {confidence_score:.2f})")

            # Determine status based on confidence
            if confidence_score >= 0.7:
                status = "success"
            elif confidence_score >= 0.4:
                status = "partial_success"
            else:
                status = "failed"

            return ResumeExtractionResult(
                status=status,
                extracted_resume=extracted_resume,
                confidence_score=confidence_score,
                ocr_used=ocr_used,
                extraction_method=extraction_method,
                error_message=None
            )

        except FileNotFoundError as e:
            logger.error(f"File not found: {str(e)}")
            return ResumeExtractionResult(
                status="failed",
                extracted_resume=None,
                confidence_score=0.0,
                ocr_used=False,
                extraction_method="none",
                error_message=f"File not found: {str(e)}"
            )

        except ValueError as e:
            logger.error(f"Extraction failed: {str(e)}")
            return ResumeExtractionResult(
                status="failed",
                extracted_resume=None,
                confidence_score=0.0,
                ocr_used=False,
                extraction_method="none",
                error_message=str(e)
            )

        except Exception as e:
            logger.error(f"Unexpected error during extraction: {str(e)}", exc_info=True)
            return ResumeExtractionResult(
                status="failed",
                extracted_resume=None,
                confidence_score=0.0,
                ocr_used=False,
                extraction_method="none",
                error_message=f"Unexpected error: {str(e)}"
            )
