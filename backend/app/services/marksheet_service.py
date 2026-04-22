"""AI marksheet extraction service used by student profile auto-fill.

The service:
1) Downloads marksheet from Cloudinary URL
2) Extracts text via a PDF/OCR cascade
3) Uses OpenAI/OpenRouter-compatible LLM extraction
4) Returns structured JSON payload for UI verification

To avoid regressions in existing consumers, the returned dict also includes
legacy top-level aliases: roll_number, full_name, semester, branch, sgpa, cgpa.
"""

import asyncio
import json
import logging
import os
import re
import tempfile
from typing import Any, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_VALID_BRANCHES = {"CSE", "ECE", "ME", "CE", "EE", "IT", "AI", "Other"}
_VALID_SUBJECT_STATUS = {"Pass", "Fail", "KT"}
_POPUP_MESSAGE = (
    "Please review all extracted details carefully before saving your profile. "
    "You can edit any incorrect information."
)


def _empty_structured_payload() -> dict:
    return {
        "student_profile": {
            "full_name": None,
            "roll_number": None,
            "branch": None,
            "current_semester": None,
            "sgpa": None,
            "cgpa": None,
        },
        "subjects": [],
        "system_flags": {
            "needs_review": True,
            "missing_fields": [
                "student_profile.full_name",
                "student_profile.roll_number",
                "student_profile.branch",
                "student_profile.current_semester",
                "student_profile.sgpa",
                "student_profile.cgpa",
                "subjects",
            ],
            "confidence_score": 0.0,
        },
        "ui_instructions": {
            "show_popup": True,
            "popup_message": _POPUP_MESSAGE,
            "highlight_fields": [
                "student_profile.full_name",
                "student_profile.roll_number",
                "student_profile.branch",
                "student_profile.current_semester",
                "student_profile.sgpa",
                "student_profile.cgpa",
                "subjects",
            ],
        },
    }


def _with_legacy_aliases(payload: dict) -> dict:
    """Add legacy flat keys so existing UI auto-fill code keeps working."""
    profile = payload.get("student_profile", {})
    result = dict(payload)
    result["roll_number"] = profile.get("roll_number")
    result["full_name"] = profile.get("full_name")
    result["semester"] = profile.get("current_semester")
    result["branch"] = profile.get("branch")
    result["sgpa"] = profile.get("sgpa")
    result["cgpa"] = profile.get("cgpa")
    return result


def _clean_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned if cleaned else None


def _to_int(value: Any, minimum: Optional[int] = None, maximum: Optional[int] = None) -> Optional[int]:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    if minimum is not None and parsed < minimum:
        return None
    if maximum is not None and parsed > maximum:
        return None
    return parsed


def _to_float(value: Any, minimum: Optional[float] = None, maximum: Optional[float] = None) -> Optional[float]:
    try:
        parsed = round(float(value), 2)
    except (TypeError, ValueError):
        return None
    if minimum is not None and parsed < minimum:
        return None
    if maximum is not None and parsed > maximum:
        return None
    return parsed

def _normalize_roll_number_for_extraction(value: Any) -> Optional[str]:
    cleaned = _clean_str(value)
    if not cleaned:
        return None

    cleaned = cleaned.strip().strip(".,;:")
    cleaned = re.sub(r"\s+", "", cleaned)
    cleaned = re.sub(r"[^A-Za-z0-9/\-]", "", cleaned)
    if not cleaned:
        return None

    return cleaned.upper()


def _normalize_full_name_for_extraction(value: Any) -> Optional[str]:
    cleaned = _clean_str(value)
    if not cleaned:
        return None

    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .,:;-")
    cleaned = re.split(
        r"\b(?:roll|enrollment|enrolment|enrollement|sgpa|cgpa|semester|sem)\b",
        cleaned,
        maxsplit=1,
        flags=re.IGNORECASE,
    )[0].strip(" .,:;-")

    if len(cleaned) < 2 or re.search(r"\d", cleaned):
        return None

    return cleaned[:80].title()


def _parse_semester_token(value: Any) -> Optional[int]:
    sem = _clean_str(value)
    if not sem:
        return None

    token = re.sub(r"(?i)(st|nd|rd|th)$", "", sem.strip()).upper()
    roman_map = {
        "I": 1,
        "II": 2,
        "III": 3,
        "IV": 4,
        "V": 5,
        "VI": 6,
        "VII": 7,
        "VIII": 8,
        "IX": 9,
        "X": 10,
    }
    if token in roman_map:
        return roman_map[token]

    try:
        parsed = int(token)
    except ValueError:
        return None

    if 1 <= parsed <= 10:
        return parsed
    return None


def _extract_score_from_text(text: str, metric: str) -> Optional[float]:
    pattern = rf"\b{metric}\b(?:\s*\([^\n\r)]{{0,50}}\))?\s*[:=\-]\s*(\d{{1,2}}(?:\.\d{{1,2}})?)"
    match = re.search(pattern, text, re.IGNORECASE)
    if not match:
        return None

    try:
        value = float(match.group(1))
    except ValueError:
        return None

    if 0.0 <= value <= 10.0:
        return round(value, 2)
    return None


def _normalize_branch(raw_branch: Any) -> Optional[str]:
    branch = _clean_str(raw_branch)
    if not branch:
        return None

    if branch in _VALID_BRANCHES:
        return branch

    lowered = branch.lower()
    branch_map = {
        "computer science": "CSE",
        "computer science and engineering": "CSE",
        "computer science engineering": "CSE",
        "b.tech cse": "CSE",
        "b.e. cs": "CSE",
        "cse": "CSE",
        "cs": "CSE",
        "artificial intelligence": "AI",
        "artificial intelligence and machine learning": "AI",
        "artificial intelligence & machine learning": "AI",
        "ai and ml": "AI",
        "ai & ml": "AI",
        "aiml": "AI",
        "ai/ml": "AI",
        "b.tech ai": "AI",
        "ai": "AI",
        "electronics and communication": "ECE",
        "electronics and communication engineering": "ECE",
        "electronics": "ECE",
        "e&c": "ECE",
        "ece": "ECE",
        "mechanical": "ME",
        "mechanical engineering": "ME",
        "me": "ME",
        "civil": "CE",
        "civil engineering": "CE",
        "ce": "CE",
        "electrical": "EE",
        "electrical engineering": "EE",
        "electrical and electronics": "EE",
        "eee": "EE",
        "ee": "EE",
        "information technology": "IT",
        "b.tech it": "IT",
        "it": "IT",
    }
    if lowered in branch_map:
        return branch_map[lowered]

    for pattern, code in branch_map.items():
        if pattern in lowered:
            return code

    return "Other"


def _normalize_subject_status(raw_status: Any, grade: Optional[str]) -> Optional[str]:
    status = _clean_str(raw_status)
    if status:
        lower = status.lower()
        if "kt" in lower or "backlog" in lower or "supplementary" in lower:
            return "KT"
        if "fail" in lower or lower == "f":
            return "Fail"
        if "pass" in lower or "clear" in lower:
            return "Pass"

    if grade:
        grade_upper = grade.upper()
        if "KT" in grade_upper or "BACK" in grade_upper:
            return "KT"
        if grade_upper in {"F", "FAIL", "RA", "AB", "U", "FF"}:
            return "Fail"
        return "Pass"

    return None


def _sanitize_student_profile(raw_profile: Any) -> dict:
    profile = raw_profile if isinstance(raw_profile, dict) else {}

    return {
        "full_name": _normalize_full_name_for_extraction(profile.get("full_name")),
        "roll_number": _normalize_roll_number_for_extraction(profile.get("roll_number")),
        "branch": _normalize_branch(profile.get("branch")),
        "current_semester": _parse_semester_token(profile.get("current_semester")),
        "sgpa": _to_float(profile.get("sgpa"), minimum=0.0, maximum=10.0),
        "cgpa": _to_float(profile.get("cgpa"), minimum=0.0, maximum=10.0),
    }


def _sanitize_subjects(raw_subjects: Any) -> list:
    if not isinstance(raw_subjects, list):
        return []

    cleaned_subjects = []
    for row in raw_subjects:
        if not isinstance(row, dict):
            continue

        subject_name = _clean_str(row.get("subject_name"))
        subject_code = _clean_str(row.get("subject_code"))
        credits = _to_float(row.get("credits"), minimum=0.0)
        marks_obtained = _to_float(row.get("marks_obtained"), minimum=0.0)
        grade = _clean_str(row.get("grade"))
        if grade:
            grade = grade.upper()
        status = _normalize_subject_status(row.get("status"), grade)
        if status not in _VALID_SUBJECT_STATUS:
            status = None

        # Ignore completely empty rows from OCR/LLM noise.
        if not any([subject_name, subject_code, credits is not None, marks_obtained is not None, grade, status]):
            continue

        cleaned_subjects.append(
            {
                "subject_name": subject_name,
                "subject_code": subject_code,
                "credits": credits,
                "marks_obtained": marks_obtained,
                "grade": grade,
                "status": status,
            }
        )

    return cleaned_subjects


def _collect_missing_fields(student_profile: dict, subjects: list) -> list[str]:
    missing = []
    for key in ("full_name", "roll_number", "branch", "current_semester", "sgpa", "cgpa"):
        if student_profile.get(key) is None:
            missing.append(f"student_profile.{key}")

    if not subjects:
        missing.append("subjects")
    else:
        for idx, subject in enumerate(subjects):
            for key in ("subject_name", "subject_code", "credits", "marks_obtained", "grade", "status"):
                if subject.get(key) is None:
                    missing.append(f"subjects[{idx}].{key}")

    return missing


def _collect_low_confidence_fields(student_profile: dict, subjects: list) -> list[str]:
    low_conf = []
    if student_profile.get("branch") == "Other":
        low_conf.append("student_profile.branch")

    if student_profile.get("full_name") and len(student_profile["full_name"]) < 3:
        low_conf.append("student_profile.full_name")

    if subjects and all(s.get("subject_code") is None for s in subjects):
        low_conf.append("subjects")

    for idx, subject in enumerate(subjects):
        if subject.get("grade") and subject.get("status") is None:
            low_conf.append(f"subjects[{idx}].status")

    return low_conf


def _calculate_confidence_score(student_profile: dict, subjects: list) -> float:
    profile_fields = ("full_name", "roll_number", "branch", "current_semester", "sgpa", "cgpa")
    profile_filled = sum(1 for key in profile_fields if student_profile.get(key) is not None)
    profile_score = profile_filled / len(profile_fields)

    if subjects:
        subject_field_total = len(subjects) * 6
        subject_filled = 0
        for subject in subjects:
            for key in ("subject_name", "subject_code", "credits", "marks_obtained", "grade", "status"):
                if subject.get(key) is not None:
                    subject_filled += 1
        subject_score = subject_filled / subject_field_total if subject_field_total else 0.0
    else:
        subject_score = 0.0

    score = (0.65 * profile_score) + (0.35 * subject_score)

    if not subjects:
        score -= 0.15
    if student_profile.get("branch") == "Other":
        score -= 0.05
    if student_profile.get("sgpa") is None and student_profile.get("cgpa") is None:
        score -= 0.05

    return round(max(0.0, min(1.0, score)), 2)


def _build_structured_payload(student_profile: Any, subjects: Any) -> dict:
    cleaned_profile = _sanitize_student_profile(student_profile)
    cleaned_subjects = _sanitize_subjects(subjects)

    missing_fields = _collect_missing_fields(cleaned_profile, cleaned_subjects)
    low_confidence_fields = _collect_low_confidence_fields(cleaned_profile, cleaned_subjects)
    confidence_score = _calculate_confidence_score(cleaned_profile, cleaned_subjects)

    # Highlight fields that are missing or low confidence.
    highlight_fields = []
    seen = set()
    for key in [*missing_fields, *low_confidence_fields]:
        if key not in seen:
            seen.add(key)
            highlight_fields.append(key)

    return {
        "student_profile": cleaned_profile,
        "subjects": cleaned_subjects,
        "system_flags": {
            "needs_review": True,
            "missing_fields": missing_fields,
            "confidence_score": confidence_score,
        },
        "ui_instructions": {
            "show_popup": True,
            "popup_message": _POPUP_MESSAGE,
            "highlight_fields": highlight_fields,
        },
    }


def _sanitize_extraction_payload(raw_payload: Any) -> dict:
    if not isinstance(raw_payload, dict):
        return _empty_structured_payload()

    return _build_structured_payload(
        student_profile=raw_payload.get("student_profile"),
        subjects=raw_payload.get("subjects"),
    )


async def extract_marksheet_data(marksheet_url: str) -> dict:
    """
    Download marksheet and extract structured profile data.

    Returns required structured payload plus legacy aliases:
    - student_profile/full_name, roll_number, branch, current_semester, sgpa, cgpa
    - subjects[]
    - system_flags
    - ui_instructions
    - roll_number, full_name, semester, branch, sgpa, cgpa (compat)
    """
    empty = _with_legacy_aliases(_empty_structured_payload())

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
    empty = _with_legacy_aliases(_empty_structured_payload())

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

        prompt = f"""You are an AI assistant integrated into a student placement platform.

Your job has TWO responsibilities:
1) Extract structured data from an Indian university marksheet
2) Prepare it for auto-filling a student profile form with user verification

STEP 1: EXTRACTION
Extract the following fields from the marksheet text.

Return ONLY valid JSON in this structure:
{{
    "student_profile": {{
        "full_name": string or null,
        "roll_number": string or null,
        "branch": "CSE | ECE | ME | CE | EE | IT | AI | Other" or null,
        "current_semester": number or null,
        "sgpa": number or null,
        "cgpa": number or null
    }},
    "subjects": [
        {{
            "subject_name": string or null,
            "subject_code": string or null,
            "credits": number or null,
            "marks_obtained": number or null,
            "grade": string or null,
            "status": "Pass | Fail | KT" or null
        }}
    ],
    "system_flags": {{
        "needs_review": true,
        "missing_fields": [list of fields that are null or unclear],
        "confidence_score": number (0 to 1)
    }},
    "ui_instructions": {{
        "show_popup": true,
        "popup_message": "Please review all extracted details carefully before saving your profile. You can edit any incorrect information.",
        "highlight_fields": [list of fields that are null or low confidence]
    }}
}}

STEP 2: RULES
- If any field is missing or unclear, set it to null.
- Always normalize branch into allowed short codes.
- Extract semester as an integer only.
- SGPA and CGPA must be between 0 and 10.
- Name labels may appear as: "Name of the Student", "Student Name", "Full Name".
- Roll labels may appear as: "Roll No", "Roll Number", "Enrollment/Enrolment/Enrollement No".
- SGPA/CGPA may use separators like ":", "-", or "=" and may include parenthetical text.
- Semester can appear as "Semester IV", "Sem 4", or "4th Semester".
- Identify failed subjects and mark status correctly.
- Do NOT hallucinate missing data.

STEP 3: UI BEHAVIOR (IMPORTANT)
- Always set needs_review = true
- Always set show_popup = true
- Highlight fields that are null or low confidence

STEP 4: OUTPUT CONSTRAINT
- Return ONLY JSON
- No explanation
- No markdown

Marksheet text:
{text[:7000]}

JSON output:"""

        response = await llm.ainvoke([HumanMessage(content=prompt)])
        raw = response.content.strip()

        # Strip markdown code blocks if present
        raw = re.sub(r"```json\s*", "", raw)
        raw = re.sub(r"```\s*", "", raw)
        raw = raw.strip()

        data = json.loads(raw)
        structured = _sanitize_extraction_payload(data)
        return _with_legacy_aliases(structured)

    except json.JSONDecodeError as e:
        logger.warning(f"[marksheet] JSON parse failed: {e}, raw={raw[:200]}")
        return _fallback_regex_extract(text)
    except Exception as e:
        logger.error(f"[marksheet] OpenAI call failed: {e}")
        return empty


def _fallback_regex_extract(text: str) -> dict:
    """Fallback regex extraction when OpenAI JSON parsing fails."""
    profile = {
        "full_name": None,
        "roll_number": None,
        "branch": None,
        "current_semester": None,
        "sgpa": None,
        "cgpa": None,
    }

    # Roll number / enrollment patterns.
    roll_match = re.search(
        r"(?:\broll\s*(?:no|number|num)?\.?\b|\benrollment\s*(?:no|number|num)?\.?\b|\benrolment\s*(?:no|number|num)?\.?\b|\benrollement\s*(?:no|number|num)?\.?\b|\bregistration\s*(?:no|number|num)?\.?\b|\breg\.?\s*(?:no|number|num)\.?\b)\s*[:=\-]?\s*([A-Z0-9]+(?:[\-/ ][A-Z0-9]+){0,6})",
        text,
        re.IGNORECASE,
    )
    if roll_match:
        profile["roll_number"] = _normalize_roll_number_for_extraction(roll_match.group(1))

    # Full name patterns with common label variants.
    name_match = re.search(
        r"(?:\bname\s*of\s*(?:the\s*)?student(?:s)?\b|\bstudent\s*name\b|\bfull\s*name\b|\bname\b)\s*(?:[:=\-]|\s{2,})\s*([A-Za-z][A-Za-z\s\.'\-]{1,80})",
        text,
        re.IGNORECASE,
    )
    if name_match:
        profile["full_name"] = _normalize_full_name_for_extraction(name_match.group(1))

    # SGPA/CGPA patterns support parenthetical labels and :, -, = separators.
    profile["sgpa"] = _extract_score_from_text(text, "SGPA")
    profile["cgpa"] = _extract_score_from_text(text, "CGPA")

    # Semester patterns like Semester IV, Sem 4, 4th Semester.
    semester_patterns = [
        r"\b(?:semester|sem)\s*(?:no\.?|number)?\s*[:=\-]?\s*([IVX]+|\d{1,2}(?:st|nd|rd|th)?)\b",
        r"\b(\d{1,2}(?:st|nd|rd|th)?)\s*(?:semester|sem)\b",
    ]
    for pattern in semester_patterns:
        sem_match = re.search(pattern, text, re.IGNORECASE)
        if not sem_match:
            continue
        parsed_semester = _parse_semester_token(sem_match.group(1))
        if parsed_semester is not None:
            profile["current_semester"] = parsed_semester
            break

    branch_patterns = {
        "CSE": r"\b(cse|computer\s*science)\b",
        "ECE": r"\b(ece|electronics\s*(and|&)\s*communication|electronics)\b",
        "ME": r"\b(me|mechanical)\b",
        "CE": r"\b(ce|civil)\b",
        "EE": r"\b(ee|eee|electrical)\b",
        "IT": r"\b(it|information\s*technology)\b",
        "AI": r"\b(ai|aiml|artificial\s*intelligence|artificial\s*intelligence\s*(and|&)\s*machine\s*learning|ai\s*(and|&)\s*ml)\b",
    }
    for code, pattern in branch_patterns.items():
        if re.search(pattern, text, re.IGNORECASE):
            profile["branch"] = code
            break

    structured = _build_structured_payload(profile, subjects=[])
    return _with_legacy_aliases(structured)
