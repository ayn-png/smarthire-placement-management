"""
AI Resume Analyzer endpoint — isolated add-on.
POST /api/v1/ai/analyze-existing-resume

PDF extraction uses a 3-library cascade for maximum compatibility:
  1. PyMuPDF (fitz)  — primary: handles Canva, Figma, Word/LibreOffice
                       exports, unusual font encodings, and most real-world
                       resume PDFs.  This is what was MISSING — pdfplumber
                       and pypdf both silently returned empty text for many
                       common resume formats.
  2. pdfplumber      — secondary: tables, multi-column layouts
  3. pypdf           — tertiary: pure-Python last resort

Response schema extended with `strengths` and `weaknesses`.
All sync I/O runs via asyncio.to_thread (never blocks the event loop).
"""

import os
import asyncio
import logging
import tempfile
import json as _json
from datetime import datetime, timezone
from typing import List, Optional
import httpx

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.middleware.auth import require_student, require_admin
from app.db.database import get_database
from app.services.student_service import StudentService
from app.services.ai_resume_service import analyze_resume_text
from app.utils.file_upload import BASE_DIR
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Resume Analyzer"])
limiter = Limiter(key_func=get_remote_address)


# Custom rate limit key function for authenticated endpoints (per-user instead of per-IP)
def get_user_id_for_rate_limit(request: Request) -> str:
    """Extract user ID from request state for per-user rate limiting."""
    # The require_student dependency populates request.state.user
    user = getattr(request.state, "user", None)
    if user and isinstance(user, dict):
        user_id = user.get("id") or user.get("sub")
        if user_id:
            return f"user:{user_id}"
    # Fallback to IP if user not found (shouldn't happen with require_student)
    return get_remote_address(request)


# ── Request / Response schemas ───────────────────────────────────────────────

class AnalyzeResumeRequest(BaseModel):
    job_description: Optional[str] = None


class JobSuggestion(BaseModel):
    role: str
    matchScore: str
    requiredSkills: List[str]


class AnalyzeResumeResponse(BaseModel):
    atsScore: int
    extractedSkills: List[str]
    missingSkills: List[str]
    strengths: List[str] = []     # Added: resume strengths
    weaknesses: List[str] = []    # Added: resume weaknesses
    suggestions: List[str]
    jobSuggestions: List[JobSuggestion] = []  # Added: job role recommendations


# ── PDF text extraction ──────────────────────────────────────────────────────

def _extract_text_sync(file_path: str) -> str:
    """
    Synchronous PDF text extraction — 5-method cascade with OCR fallback.

    Cascade order (fastest/most reliable first):
      1. PyMuPDF (fitz)  — primary, handles most PDFs
      2. pdfplumber      — secondary, good for tables
      3. LangChain PyPDFLoader — tertiary, alternative approach
      4. pypdf           — quaternary, last text-based method
      5. OCR (Tesseract) — final fallback for scanned/image-based PDFs

    Called via asyncio.to_thread so the FastAPI event loop is never blocked.
    Raises ValueError (→ 422) only when all methods return empty text.
    """
    filename = os.path.basename(file_path)

    # Verify file exists and is readable
    if not os.path.exists(file_path):
        raise ValueError(f"PDF file not found: {file_path}")

    if not os.path.isfile(file_path):
        raise ValueError(f"Path is not a file: {file_path}")

    logger.info(f"Starting PDF extraction for: {filename} (size: {os.path.getsize(file_path)} bytes)")

    # ── 1. PyMuPDF (fitz) ────────────────────────────────────────────────────
    # Handles: Word/LibreOffice exports, Canva PDFs, unusual font encodings,
    # PDFs with XFA/AcroForms, and most real-world resume formats.
    try:
        import fitz  # PyMuPDF

        pages_text: List[str] = []
        with fitz.open(file_path) as doc:
            if doc.page_count == 0:
                raise ValueError("PDF has no pages")

            for page_num, page in enumerate(doc):
                # "text" mode: plain ordered text, best for resumes
                text = page.get_text("text")
                if text and text.strip():
                    pages_text.append(text.strip())
                else:
                    # Try "blocks" mode as a fallback within the same page —
                    # sometimes gets text that "text" mode misses
                    blocks = page.get_text("blocks")
                    block_texts = [
                        b[4].strip() for b in blocks
                        if len(b) >= 5 and isinstance(b[4], str) and b[4].strip()
                    ]
                    if block_texts:
                        pages_text.append("\n".join(block_texts))

        full_text = "\n\n".join(pages_text).strip()
        if full_text:
            logger.info("PyMuPDF extracted %d chars from '%s'", len(full_text), filename)
            return full_text

        logger.warning("PyMuPDF: no text on any page of '%s', trying pdfplumber", filename)

    except ImportError:
        logger.warning("PyMuPDF (fitz) not installed — trying pdfplumber")
    except Exception as exc:
        logger.warning("PyMuPDF failed on '%s': %s — trying pdfplumber", filename, exc)

    # ── 2. pdfplumber ─────────────────────────────────────────────────────────
    # Good at tables and multi-column layouts.
    try:
        import pdfplumber

        pages_text = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text and text.strip():
                    pages_text.append(text.strip())

        full_text = "\n\n".join(pages_text).strip()
        if full_text:
            logger.info("pdfplumber extracted %d chars from '%s'", len(full_text), filename)
            return full_text

        logger.warning("pdfplumber: no text from '%s', trying pypdf", filename)

    except ImportError:
        logger.warning("pdfplumber not installed — trying pypdf")
    except Exception as exc:
        logger.warning("pdfplumber failed on '%s': %s — trying pypdf", filename, exc)

    # ── 3. LangChain PyPDFLoader (alternative approach) ──────────────────────
    try:
        from langchain_community.document_loaders import PyPDFLoader

        loader = PyPDFLoader(file_path)
        documents = loader.load()

        if documents:
            pages_text = []
            for doc in documents:
                if doc.page_content and doc.page_content.strip():
                    pages_text.append(doc.page_content.strip())

            full_text = "\n\n".join(pages_text).strip()
            if full_text:
                logger.info("LangChain PyPDFLoader extracted %d chars from '%s'", len(full_text), filename)
                return full_text

        logger.warning("LangChain PyPDFLoader: no text from '%s', trying pypdf", filename)

    except ImportError:
        logger.warning("LangChain not installed — trying pypdf")
    except Exception as exc:
        logger.warning("LangChain PyPDFLoader failed on '%s': %s — trying pypdf", filename, exc)

    # ── 4. pypdf (last resort) ────────────────────────────────────────────────
    try:
        from pypdf import PdfReader

        reader = PdfReader(file_path)
        pages_text = []
        for page in reader.pages:
            text = page.extract_text()
            if text and text.strip():
                pages_text.append(text.strip())

        full_text = "\n".join(pages_text).strip()
        if full_text:
            logger.info("pypdf extracted %d chars from '%s'", len(full_text), filename)
            return full_text

        logger.warning("pypdf: no text from '%s'", filename)

    except Exception as exc:
        logger.error("pypdf also failed on '%s': %s", filename, exc, exc_info=True)

    # ── 5. OCR Fallback (Tesseract) — for scanned/image-based PDFs ──────────
    # All text-based methods failed, this is likely a scanned PDF.
    # Try OCR as the final fallback.
    logger.warning("All text extraction methods failed for '%s', attempting OCR...", filename)

    try:
        from app.services.resume_extractor import extract_resume_text_with_ocr

        # This will attempt OCR and provide detailed error messages if it fails
        ocr_text = extract_resume_text_with_ocr(file_path)

        if ocr_text and len(ocr_text.strip()) >= 50:
            logger.info("OCR extracted %d chars from '%s'", len(ocr_text), filename)
            return ocr_text

    except ValueError as exc:
        # OCR failed with a descriptive error message
        logger.error("OCR extraction failed for '%s': %s", filename, exc)
        raise ValueError(str(exc))
    except Exception as exc:
        logger.error("OCR extraction error for '%s': %s", filename, exc, exc_info=True)
        # Fall through to the final error message

    # ── All five methods (including OCR) failed ───────────────────────────────
    raise ValueError(
        "Could not extract text from your resume PDF. "
        "All extraction methods (PyMuPDF, pdfplumber, LangChain, pypdf, OCR) failed. "
        "This could mean:\n"
        "• The PDF is corrupted or password-protected\n"
        "• The PDF contains only images with no readable text\n"
        "• If this is a scanned PDF, OCR may require Tesseract installation\n\n"
        "Please try:\n"
        "• Re-export your resume from Google Docs or Microsoft Word (File → Download → PDF)\n"
        "• If you used Canva/Figma, enable 'Flatten PDF' OFF and use 'Standard PDF' export\n"
        "• Ensure the file is not password-protected\n"
        "• Make sure the PDF contains selectable text (not just images)\n"
        "• For scanned PDFs: Install Tesseract OCR (https://github.com/UB-Mannheim/tesseract/wiki)"
    )


async def _extract_pdf_text(file_path: str) -> str:
    """
    Async wrapper: runs the blocking PDF extraction in a thread pool
    so FastAPI's event loop stays responsive during I/O.
    Converts ValueError from the sync function into a clean 422 HTTP error.
    """
    try:
        text = await asyncio.to_thread(_extract_text_sync, file_path)
        return text
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error("Unexpected PDF parsing error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to parse resume PDF. Please try re-uploading.",
        )


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/analyze-existing-resume", response_model=AnalyzeResumeResponse)
@limiter.limit("20/hour", key_func=get_user_id_for_rate_limit)  # FIXED: Per-user rate limit instead of per-IP
async def analyze_existing_resume(
    request: Request,
    body: AnalyzeResumeRequest = AnalyzeResumeRequest(),
    current_user: dict = Depends(require_student),
    db=Depends(get_database),
):
    """
    Read the student's already-uploaded resume from disk, extract its text,
    send it to the configured AI model, and return structured analysis.

    Steps:
      1. Load student profile → get resume_url
      2. Resolve file path using BASE_DIR (CWD-independent)
      3. Validate file exists, ≤5 MB, is a .pdf
      4. Extract text (PyMuPDF → pdfplumber → pypdf cascade)
      5. Call AI service (OpenAI → OpenRouter fallback chain)
      6. Return ATS score, skills, strengths, weaknesses, suggestions

    Errors:
      - 403: Forbidden — user is not authenticated as a STUDENT
      - 400: Bad Request — no resume uploaded or file too large
      - 502: Bad Gateway — AI service failed or resume download failed
      - 503: Service Unavailable — AI keys not configured
      - 500: Internal Server Error — unexpected error (check logs)
    """
    try:
        user_id = current_user.get("id", "unknown")
        logger.info(f"[{user_id}] Starting ATS analysis request")

        # 1. Get student profile & resume URL
        service = StudentService(db)
        try:
            profile = await service.get_profile(current_user)
        except Exception as e:
            logger.error(f"[{user_id}] Failed to load student profile: {e}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student profile not found. Please create your profile first.",
            )

        resume_url = profile.resume_url
        if not resume_url:
            logger.warning(f"[{user_id}] No resume uploaded")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No resume uploaded yet. Please upload your resume first.",
            )

    try:
        user_id = current_user.get("id", "unknown")
        logger.info(f"[{user_id}] Starting ATS analysis request")

        # 1. Get student profile & resume URL
        service = StudentService(db)
        try:
            profile = await service.get_profile(current_user)
        except Exception as e:
            logger.error(f"[{user_id}] Failed to load student profile: {e}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student profile not found. Please create your profile first.",
            )

        resume_url = profile.resume_url
        if not resume_url:
            logger.warning(f"[{user_id}] No resume uploaded")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No resume uploaded yet. Please upload your resume first.",
            )

        # 2. Handle Cloudinary URLs vs local files
        temp_file_path = None
        try:
        if "cloudinary.com" in resume_url:
            # Download from Cloudinary to temp file
            logger.info("Downloading resume from Cloudinary: %s", resume_url)
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(resume_url)
                    if response.status_code != 200:
                        logger.error(f"Cloudinary returned status {response.status_code}")
                        raise HTTPException(
                            status_code=status.HTTP_502_BAD_GATEWAY,
                            detail="Failed to fetch resume from cloud storage. Please try re-uploading.",
                        )
                    response.raise_for_status()

                    # Create temp file
                    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
                    temp_file.write(response.content)
                    temp_file.close()
                    temp_file_path = temp_file.name
                    file_path = temp_file_path

                    # Validate size
                    if len(response.content) > 5 * 1024 * 1024:
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail="Resume file exceeds the 5 MB limit.",
                        )
            except httpx.RequestError as e:
                logger.error(f"Network error downloading resume: {e}")
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="Network error while fetching resume. Please try again.",
                )
        else:
            # Legacy local file
            relative_path = resume_url.lstrip("/")
            file_path = os.path.join(BASE_DIR, relative_path)

            if not os.path.isfile(file_path):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=(
                        "Resume file not found on the server. "
                        "Please re-upload your resume and try again."
                    ),
                )

            # Validate size
            file_size = os.path.getsize(file_path)
            if file_size == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Your resume file appears to be empty. Please re-upload it.",
                )

            if file_size > 5 * 1024 * 1024:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="Resume file exceeds the 5 MB limit.",
                )

        # 3. Extract text from PDF
        logger.info("Extracting text from resume: %s", file_path)
        resume_text = await _extract_pdf_text(file_path)
        logger.info("Extraction successful: %d characters", len(resume_text))

        # 4. Validate AI API keys before calling service
        logger.info("Validating AI service configuration...")
        if not settings.OPENAI_API_KEY and not settings.OPENROUTER_API_KEY:
            logger.error("No AI API keys configured (OPENAI_API_KEY or OPENROUTER_API_KEY)")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI resume analysis service is not configured. Please contact the administrator.",
            )

        # 5. Call AI service
        logger.info("Sending resume text (%d chars) to AI service", len(resume_text))
        try:
            result = await analyze_resume_text(resume_text, body.job_description)
        except RuntimeError as exc:
            logger.error("AI service error: %s", exc, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=str(exc),
            )
        except Exception as exc:
            logger.error("Unexpected AI error: %s", exc, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"AI analysis failed: {str(exc)[:100]}. Please try again later.",
            )

        # 6. Return — Pydantic validates and serialises the dict
        return AnalyzeResumeResponse(**result)

    finally:
        # IMPROVED: Clean up temporary file if it was created with retry logic
        if temp_file_path and os.path.exists(temp_file_path):
            cleanup_success = False
            for attempt in range(3):  # Try up to 3 times
                try:
                    os.unlink(temp_file_path)
                    logger.info("Cleaned up temporary file: %s", temp_file_path)
                    cleanup_success = True
                    break
                except PermissionError as e:
                    # File might still be locked - wait and retry
                    if attempt < 2:
                        await asyncio.sleep(0.1 * (attempt + 1))
                        continue
                    logger.error(
                        f"Failed to cleanup temp file {temp_file_path} after {attempt + 1} attempts: "
                        f"Permission denied. File may be locked. Error: {e}"
                    )
                except Exception as e:
                    logger.error(
                        f"Failed to cleanup temp file {temp_file_path} on attempt {attempt + 1}: "
                        f"{type(e).__name__}: {e}"
                    )
                    break

            if not cleanup_success:
                # Log to a dedicated cleanup failures file for manual intervention
                try:
                    import json
                    from datetime import datetime
                    failure_log_path = os.path.join(tempfile.gettempdir(), "ai_resume_cleanup_failures.log")
                    with open(failure_log_path, "a") as f:
                        json.dump({
                            "timestamp": datetime.utcnow().isoformat(),
                            "file_path": temp_file_path,
                            "user_id": current_user.get("_id", "unknown")
                        }, f)
                        f.write("\n")
                except Exception:
                    pass  # Don't let logging failure crash the response


# ── Feature 5: AI Candidate Ranking ──────────────────────────────────────────

class RankingRequest(BaseModel):
    job_id: str
    application_ids: List[str] = Field(..., min_length=1, max_length=50)


class ApplicantRankItem(BaseModel):
    application_id: str
    student_name: str
    score: int
    strengths: List[str] = []
    gaps: List[str] = []
    cgpa: Optional[float] = None


class RankingResponse(BaseModel):
    job_id: str
    ranked: List[ApplicantRankItem]
    cached: bool
    ranked_at: str


_RANKING_CACHE_TTL_HOURS = 24


@router.post("/rank-applicants", response_model=RankingResponse)
async def rank_applicants(
    body: RankingRequest,
    current_user: dict = Depends(require_admin),
    db=Depends(get_database),
):
    """
    AI-powered ranking of applicants for a given job.
    Fetches each applicant's profile, builds an OpenAI prompt, and returns
    a ranked list sorted by score descending. Results are cached in Firestore
    for 24 hours (keyed by job_id).
    """
    # 1. Check cache
    cache_ref = db.collection("ai_rankings").document(body.job_id)
    cache_doc = await asyncio.to_thread(cache_ref.get)
    if cache_doc.exists:
        cache_data = cache_doc.to_dict() or {}
        ranked_at_raw = cache_data.get("ranked_at")
        if ranked_at_raw:
            try:
                ranked_at = datetime.fromisoformat(ranked_at_raw)
                if ranked_at.tzinfo is None:
                    ranked_at = ranked_at.replace(tzinfo=timezone.utc)
                age_hours = (datetime.now(timezone.utc) - ranked_at).total_seconds() / 3600
                if age_hours < _RANKING_CACHE_TTL_HOURS:
                    return RankingResponse(
                        job_id=body.job_id,
                        ranked=[ApplicantRankItem(**r) for r in cache_data.get("ranked", [])],
                        cached=True,
                        ranked_at=ranked_at_raw,
                    )
            except Exception:
                pass  # Expired or malformed cache — re-rank

    # 2. Fetch job details
    job_doc = await asyncio.to_thread(db.collection("jobs").document(body.job_id).get)
    if not job_doc.exists:
        raise HTTPException(status_code=404, detail="Job not found")
    job = job_doc.to_dict() or {}
    job_title = job.get("title", "the position")
    required_skills = job.get("required_skills", [])
    job_description = job.get("description", "")

    # 3. Fetch applications + student profiles
    applicants = []
    for app_id in body.application_ids:
        try:
            app_doc = await asyncio.to_thread(db.collection("applications").document(app_id).get)
            if not app_doc.exists:
                continue
            app_data = app_doc.to_dict() or {}
            student_id = app_data.get("student_id", "")
            profile_doc = await asyncio.to_thread(db.collection("student_profiles").document(student_id).get)
            profile = profile_doc.to_dict() if profile_doc.exists else {}
            applicants.append({
                "application_id": app_id,
                "student_name": profile.get("full_name", "Unknown"),
                "skills": profile.get("skills", []),
                "cgpa": profile.get("cgpa"),
                "branch": profile.get("branch", ""),
            })
        except Exception:
            pass

    if not applicants:
        raise HTTPException(status_code=400, detail="No valid applicants found for ranking")

    # 4. Build AI prompt
    applicants_text = "\n".join([
        f"- ID: {a['application_id']}, Name: {a['student_name']}, "
        f"CGPA: {a['cgpa'] or 'N/A'}, Skills: {', '.join(a['skills']) or 'none'}"
        for a in applicants
    ])

    prompt = f"""You are an expert recruiter evaluating candidates for a job position.

Job Title: {job_title}
Required Skills: {', '.join(required_skills) or 'Not specified'}
Job Description: {job_description[:500] if job_description else 'Not provided'}

Candidates:
{applicants_text}

Rank each candidate from 0-100 based on skill match, CGPA, and overall fit.
Return ONLY a JSON array (no markdown, no code blocks) with objects containing:
- "application_id": string (exact ID from input)
- "score": integer 0-100
- "strengths": list of 1-3 short strength strings
- "gaps": list of 1-2 short gap strings

Example: [{{"application_id": "abc123", "score": 85, "strengths": ["Strong Python skills"], "gaps": ["Missing SQL"]}}]"""

    # 5. Call OpenAI
    if not settings.OPENAI_API_KEY and not settings.OPENROUTER_API_KEY:
        raise HTTPException(status_code=503, detail="AI ranking service not configured. Please set OPENAI_API_KEY.")

    api_key = settings.OPENAI_API_KEY or settings.OPENROUTER_API_KEY
    base_url = "https://api.openai.com/v1" if settings.OPENAI_API_KEY else "https://openrouter.ai/api/v1"
    model = "gpt-4o-mini" if settings.OPENAI_API_KEY else "openai/gpt-4o-mini"

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                    "max_tokens": 1000,
                },
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"].strip()
    except httpx.HTTPStatusError as exc:
        logger.error("OpenAI ranking call failed: %s", exc)
        raise HTTPException(status_code=502, detail="AI ranking service error. Please try again.")
    except Exception as exc:
        logger.error("Unexpected ranking error: %s", exc)
        raise HTTPException(status_code=500, detail="AI ranking failed unexpectedly.")

    # 6. Parse AI response
    try:
        # Strip markdown code fences if present
        clean = content.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        raw_ranked = _json.loads(clean)
    except Exception:
        logger.error("Could not parse AI ranking response: %s", content[:200])
        raise HTTPException(status_code=502, detail="AI returned an unparseable response. Please try again.")

    # Build lookup by application_id for profile data
    profile_map = {a["application_id"]: a for a in applicants}

    ranked = []
    for item in raw_ranked:
        app_id = item.get("application_id", "")
        profile_info = profile_map.get(app_id, {})
        ranked.append(ApplicantRankItem(
            application_id=app_id,
            student_name=profile_info.get("student_name", item.get("student_name", "Unknown")),
            score=max(0, min(100, int(item.get("score", 0)))),
            strengths=item.get("strengths", [])[:3],
            gaps=item.get("gaps", [])[:2],
            cgpa=profile_info.get("cgpa"),
        ))
    ranked.sort(key=lambda x: x.score, reverse=True)

    # 7. Cache result
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        await asyncio.to_thread(
            cache_ref.set,
            {
                "job_id": body.job_id,
                "ranked": [r.model_dump() for r in ranked],
                "ranked_at": now_iso,
            },
        )
    except Exception as e:
        logger.warning("Failed to cache ranking: %s", e)

    return RankingResponse(job_id=body.job_id, ranked=ranked, cached=False, ranked_at=now_iso)
