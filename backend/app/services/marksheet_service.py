"""
marksheet_service.py — AI Marksheet Extraction Agent
-----------------------------------------------------
Uploads a marksheet from a Cloudinary URL, extracts text via a 5-method
cascade (PyMuPDF → pdfplumber → pypdf → OCR), then calls OpenAI GPT-4o-mini
via LangChain to extract structured student data.

Returns: {"roll_number", "full_name", "semester", "branch", "sgpa"} — any
field not found is None. Non-fatal: if OpenAI is not configured or extraction
fails, returns all-None dict so the upload still succeeds.
"""

import asyncio
import json
import logging
import os
import re
import tempfile
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


async def extract_marksheet_data(marksheet_url: str) -> dict:
    """
    Download the marksheet from Cloudinary and extract student data using OpenAI.
    Returns dict with keys: roll_number, full_name, semester, branch, sgpa, cgpa.
    All values default to None if not found or on any error.
    """
    empty = {"roll_number": None, "full_name": None, "semester": None, "branch": None, "sgpa": None, "cgpa": None}

    if not (settings.OPENAI_API_KEY or settings.OPENROUTER_API_KEY):
        logger.warning("[marksheet] OPENAI_API_KEY/OPENROUTER_API_KEY not set — skipping extraction")
        return empty

    if not marksheet_url:
        return empty

    # Determine file extension from URL
    url_path = marksheet_url.split("?")[0]  # strip query params
    ext = ".pdf"
    lower_url = url_path.lower()
    if lower_url.endswith(".jpg") or lower_url.endswith(".jpeg"):
        ext = ".jpg"
    elif lower_url.endswith(".png"):
        ext = ".png"

    tmp_path: Optional[str] = None
    try:
        # Download the file
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(marksheet_url)
            response.raise_for_status()
            file_bytes = response.content

        # Write to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        # Extract text
        text = await asyncio.to_thread(_extract_text, tmp_path, ext)

        if not text or len(text.strip()) < 20:
            logger.warning("[marksheet] Could not extract meaningful text from marksheet")
            return empty

        # Call OpenAI via LangChain
        result = await _call_openai(text)
        return result

    except Exception as e:
        logger.error(f"[marksheet] Extraction failed: {e}")
        return empty
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass


def _extract_text(file_path: str, ext: str) -> str:
    """5-method text extraction cascade. Runs in asyncio.to_thread()."""
    text = ""

    if ext == ".pdf":
        # Method 1: PyMuPDF (fitz)
        try:
            import fitz  # type: ignore
            doc = fitz.open(file_path)
            for page in doc:
                text += page.get_text()
            doc.close()
            if text.strip():
                return text
        except Exception as e:
            logger.debug(f"[marksheet] PyMuPDF failed: {e}")

        # Method 2: pdfplumber
        try:
            import pdfplumber  # type: ignore
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
            if text.strip():
                return text
        except Exception as e:
            logger.debug(f"[marksheet] pdfplumber failed: {e}")

        # Method 3: pypdf
        try:
            from pypdf import PdfReader  # type: ignore
            reader = PdfReader(file_path)
            for page in reader.pages:
                text += page.extract_text() or ""
            if text.strip():
                return text
        except Exception as e:
            logger.debug(f"[marksheet] pypdf failed: {e}")

    # Method 4: OCR via pytesseract (for images and scanned PDFs)
    try:
        import pytesseract  # type: ignore
        from PIL import Image  # type: ignore

        if ext == ".pdf":
            # Convert PDF to image via fitz
            try:
                import fitz  # type: ignore
                doc = fitz.open(file_path)
                page = doc[0]
                pix = page.get_pixmap(dpi=200)
                img_path = file_path + "_ocr.png"
                pix.save(img_path)
                doc.close()
                img = Image.open(img_path)
                text = pytesseract.image_to_string(img)
                try:
                    os.unlink(img_path)
                except Exception:
                    pass
                if text.strip():
                    return text
            except Exception as e:
                logger.debug(f"[marksheet] OCR PDF conversion failed: {e}")
        else:
            img = Image.open(file_path)
            text = pytesseract.image_to_string(img)
            if text.strip():
                return text
    except Exception as e:
        logger.debug(f"[marksheet] OCR failed: {e}")

    return text


async def _call_openai(text: str) -> dict:
    """Call an OpenAI-compatible LLM (OpenAI/OpenRouter) to extract structured data."""
    empty = {"roll_number": None, "full_name": None, "semester": None, "branch": None, "sgpa": None, "cgpa": None}

    try:
        from langchain_openai import ChatOpenAI  # type: ignore
        from langchain_core.messages import HumanMessage  # type: ignore

        use_openrouter = bool(settings.OPENROUTER_API_KEY)
        use_openai = bool(settings.OPENAI_API_KEY) and not use_openrouter
        api_key = settings.OPENAI_API_KEY if use_openai else settings.OPENROUTER_API_KEY
        model_name = "gpt-4o-mini" if use_openai else "openai/gpt-4o-mini"

        llm_kwargs = {
            "model": model_name,
            "temperature": 0.0,
            "api_key": api_key,
        }
        if not use_openai:
            llm_kwargs["base_url"] = "https://openrouter.ai/api/v1"

        llm = ChatOpenAI(**llm_kwargs)

        prompt = f"""You are an expert at reading Indian university marksheets and grade cards.
Extract the following fields from the marksheet text below.

Fields to extract:
- roll_number: Student's roll number or enrollment number (string)
- full_name: Student's full name (string)
- semester: Current semester number as an integer (1-10)
- branch: MUST be exactly one of these short codes:
    CSE  → Computer Science Engineering / Computer Science / B.Tech CSE / B.E. CS
    ECE  → Electronics and Communication Engineering / E&C / Electronics
    ME   → Mechanical Engineering / Mechanical
    CE   → Civil Engineering / Civil
    EE   → Electrical Engineering / Electrical / EEE / Electrical & Electronics
    IT   → Information Technology / B.Tech IT
    Other → Any other branch (Chemical, Aerospace, Biotechnology, etc.)
  Return ONLY the short code (e.g., "CSE", "ECE", "ME", "CE", "EE", "IT", or "Other").
- sgpa: Semester GPA or SGPA as a decimal number between 0.0 and 10.0 (float)
- cgpa: Cumulative GPA or CGPA as a decimal number between 0.0 and 10.0 (float)

IMPORTANT:
- Return ONLY a valid JSON object with exactly these 6 keys: roll_number, full_name, semester, branch, sgpa, cgpa.
- If a field is not found or unclear, use null.
- Do NOT include any explanation or markdown formatting.
- For semester, extract the number only (e.g., "Semester III" → 3, "6th Semester" → 6).
- For sgpa, extract SGPA/semester GPA only.
- For cgpa, extract CGPA/cumulative GPA only. These are different values; do not confuse them.

Marksheet text:
{text[:5000]}

JSON output:"""

        response = await llm.ainvoke([HumanMessage(content=prompt)])
        raw = response.content.strip()

        # Strip markdown code blocks if present
        raw = re.sub(r"```json\s*", "", raw)
        raw = re.sub(r"```\s*", "", raw)
        raw = raw.strip()

        data = json.loads(raw)

        # Sanitize and type-cast
        result = {
            "roll_number": str(data["roll_number"]).strip() if data.get("roll_number") is not None else None,
            "full_name": str(data["full_name"]).strip() if data.get("full_name") is not None else None,
            "semester": None,
            "branch": str(data["branch"]).strip() if data.get("branch") is not None else None,
            "sgpa": None,
            "cgpa": None,
        }

        # Validate branch is one of the allowed short codes; fall back to "Other" if not
        _VALID_BRANCHES = {"CSE", "ECE", "ME", "CE", "EE", "IT", "Other"}
        if result["branch"] and result["branch"] not in _VALID_BRANCHES:
            # Try to normalise common LLM deviations
            _BRANCH_MAP = {
                "computer science": "CSE", "cse": "CSE", "cs": "CSE",
                "information technology": "IT", "it": "IT",
                "electronics": "ECE", "ece": "ECE",
                "electrical": "EE", "ee": "EE", "eee": "EE",
                "mechanical": "ME", "me": "ME",
                "civil": "CE", "ce": "CE",
            }
            normalised = _BRANCH_MAP.get(result["branch"].lower().strip())
            result["branch"] = normalised if normalised else "Other"

        # Safely cast semester
        try:
            sem = data.get("semester")
            if sem is not None:
                result["semester"] = int(sem)
                if not 1 <= result["semester"] <= 10:
                    result["semester"] = None
        except (TypeError, ValueError):
            result["semester"] = None

        # Safely cast sgpa
        try:
            sgpa = data.get("sgpa")
            if sgpa is not None:
                result["sgpa"] = round(float(sgpa), 2)
                if not 0.0 <= result["sgpa"] <= 10.0:
                    result["sgpa"] = None
        except (TypeError, ValueError):
            result["sgpa"] = None

        # Safely cast cgpa
        try:
            cgpa = data.get("cgpa")
            if cgpa is not None:
                result["cgpa"] = round(float(cgpa), 2)
                if not 0.0 <= result["cgpa"] <= 10.0:
                    result["cgpa"] = None
        except (TypeError, ValueError):
            result["cgpa"] = None

        return result

    except json.JSONDecodeError as e:
        logger.warning(f"[marksheet] JSON parse failed: {e}, raw={raw[:200]}")
        return _fallback_regex_extract(text)
    except Exception as e:
        logger.error(f"[marksheet] OpenAI call failed: {e}")
        return empty


def _fallback_regex_extract(text: str) -> dict:
    """Fallback regex extraction when OpenAI JSON parsing fails."""
    result = {"roll_number": None, "full_name": None, "semester": None, "branch": None, "sgpa": None, "cgpa": None}

    # Roll number patterns
    roll_match = re.search(r"(?:roll\s*(?:no|number|num)\.?|enrollment\s*(?:no|number)?)[:\s]+([A-Z0-9]+)", text, re.IGNORECASE)
    if roll_match:
        result["roll_number"] = roll_match.group(1).strip()

    # SGPA pattern (must appear before CGPA to avoid false match)
    sgpa_match = re.search(r"\bSGPA\b[:\s]+(\d+\.?\d*)", text, re.IGNORECASE)
    if sgpa_match:
        try:
            val = float(sgpa_match.group(1))
            if 0.0 <= val <= 10.0:
                result["sgpa"] = round(val, 2)
        except ValueError:
            pass

    # CGPA pattern
    cgpa_match = re.search(r"\bCGPA\b[:\s]+(\d+\.?\d*)", text, re.IGNORECASE)
    if cgpa_match:
        try:
            val = float(cgpa_match.group(1))
            if 0.0 <= val <= 10.0:
                result["cgpa"] = round(val, 2)
        except ValueError:
            pass

    # Semester pattern
    sem_match = re.search(r"semester[:\s]+(?:([IVX]+|\d+))", text, re.IGNORECASE)
    if sem_match:
        sem_str = sem_match.group(1)
        roman = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8, "IX": 9, "X": 10}
        if sem_str in roman:
            result["semester"] = roman[sem_str]
        else:
            try:
                val = int(sem_str)
                if 1 <= val <= 10:
                    result["semester"] = val
            except ValueError:
                pass

    return result
