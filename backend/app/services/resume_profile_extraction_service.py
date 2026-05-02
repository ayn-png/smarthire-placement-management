"""Resume-to-profile autofill extraction for student profile onboarding."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import tempfile
from typing import Any, Optional

import httpx

from app.core.config import settings
from app.services.marksheet_service import (
    _extract_score_from_text,
    _normalize_branch,
    _normalize_full_name_for_extraction,
    _normalize_roll_number_for_extraction,
    _parse_semester_token,
)
from app.services.resume_extractor import extract_resume_text_with_ocr

logger = logging.getLogger(__name__)

_POPUP_MESSAGE = (
    "Please review all auto-filled details carefully before saving your profile. "
    "You can edit any incorrect information."
)

_SECTION_BREAK = re.compile(
    r"\n\s*(?:education|experience|projects|certifications?|achievements|summary|objective|contact)\b",
    re.IGNORECASE,
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
            "phone": None,
            "linkedin_url": None,
            "github_url": None,
            "skills": [],
            "certifications": [],
        },
        "system_flags": {
            "needs_review": True,
            "missing_fields": [
                "student_profile.full_name",
                "student_profile.roll_number",
                "student_profile.branch",
                "student_profile.current_semester",
                "student_profile.sgpa",
                "student_profile.cgpa",
                "student_profile.phone",
                "student_profile.linkedin_url",
                "student_profile.github_url",
                "student_profile.skills",
                "student_profile.certifications",
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
                "student_profile.phone",
                "student_profile.linkedin_url",
                "student_profile.github_url",
                "student_profile.skills",
                "student_profile.certifications",
            ],
        },
    }


def _with_legacy_aliases(payload: dict) -> dict:
    profile = payload.get("student_profile", {})
    result = dict(payload)
    result["roll_number"] = profile.get("roll_number")
    result["full_name"] = profile.get("full_name")
    result["semester"] = profile.get("current_semester")
    result["branch"] = profile.get("branch")
    result["sgpa"] = profile.get("sgpa")
    result["cgpa"] = profile.get("cgpa")
    result["phone"] = profile.get("phone")
    result["linkedin_url"] = profile.get("linkedin_url")
    result["github_url"] = profile.get("github_url")
    result["skills"] = profile.get("skills", [])
    result["certifications"] = profile.get("certifications", [])
    return result


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


def _normalize_phone(value: Any) -> Optional[str]:
    if value is None:
        return None
    digits = re.sub(r"\D", "", str(value))
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[-10:]
    if len(digits) == 11 and digits.startswith("0"):
        digits = digits[-10:]
    if len(digits) == 10:
        return digits
    return None


def _normalize_url(value: Any, domain: str) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    match = re.search(rf"(https?://[^\s]*{re.escape(domain)}[^\s]*)", text, re.IGNORECASE)
    if match:
        return match.group(1).rstrip(".,);")
    match = re.search(rf"({re.escape(domain)}[^\s]*)", text, re.IGNORECASE)
    if match:
        return f"https://{match.group(1).rstrip('.,);')}"
    return None


def _clean_string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        raw_items = value
    else:
        raw_items = re.split(r"[,|\n\r•\-]+", str(value))

    cleaned: list[str] = []
    seen: set[str] = set()
    for item in raw_items:
        text = re.sub(r"\s+", " ", str(item)).strip(" .,:;")
        if len(text) < 2 or len(text) > 100:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(text)
    return cleaned[:20]


def _extract_first_match(text: str, patterns: list[str]) -> Optional[str]:
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match:
            return match.group(1).strip()
    return None


def _extract_candidate_name(text: str) -> Optional[str]:
    labelled = _extract_first_match(
        text,
        [
            r"(?:name|candidate name|full name)\s*[:\-]\s*([A-Za-z][A-Za-z .'-]{2,80})",
            r"resume of\s+([A-Za-z][A-Za-z .'-]{2,80})",
        ],
    )
    if labelled:
        return _normalize_full_name_for_extraction(labelled)

    for line in text.splitlines()[:8]:
        cleaned = re.sub(r"\s+", " ", line).strip(" .,:;-")
        if not cleaned or len(cleaned) < 4 or len(cleaned) > 60:
            continue
        if re.search(r"\d|@|linkedin|github|resume|curriculum vitae", cleaned, re.IGNORECASE):
            continue
        if len(cleaned.split()) > 5:
            continue
        normalized = _normalize_full_name_for_extraction(cleaned)
        if normalized:
            return normalized
    return None


def _extract_branch_from_text(text: str) -> Optional[str]:
    degree_match = _extract_first_match(
        text,
        [
            r"(?:degree|branch|specialization|specialisation)\s*[:\-]\s*([^\n\r]{2,120})",
            r"(b\.?tech|b\.?e\.?|m\.?tech|bachelor)[^\n\r]{0,80}",
        ],
    )
    if degree_match:
        return _normalize_branch(degree_match)

    lowered = text.lower()
    branch_tokens = [
        "computer science and engineering",
        "computer science engineering",
        "computer science",
        "information technology",
        "electronics and communication engineering",
        "electronics and communication",
        "mechanical engineering",
        "civil engineering",
        "electrical engineering",
        "electrical and electronics engineering",
        "artificial intelligence and machine learning",
        "artificial intelligence",
        "cse",
        "it",
        "ece",
        "me",
        "ce",
        "ee",
        "ai",
    ]
    for token in branch_tokens:
        if re.search(rf"\b{re.escape(token)}\b", lowered):
            return _normalize_branch(token)
    return None


def _extract_semester_from_text(text: str) -> Optional[int]:
    match = _extract_first_match(
        text,
        [
            r"(?:current semester|semester|sem)\s*[:\-]?\s*([A-Za-z0-9]+)",
            r"([0-9]{1,2})(?:st|nd|rd|th)?\s+semester",
            r"semester\s+([ivx]+)",
        ],
    )
    if not match:
        return None
    return _parse_semester_token(match)


def _extract_phone_from_text(text: str) -> Optional[str]:
    match = re.search(r"(?<!\d)(?:\+?91[-\s]?)?[6-9]\d{9}(?!\d)", text)
    if not match:
        match = re.search(r"(?<!\d)(?:\+?91[-\s]?)?\d{10}(?!\d)", text)
    return _normalize_phone(match.group(0)) if match else None


def _extract_section_list(text: str, heading_patterns: list[str]) -> list[str]:
    for heading in heading_patterns:
        match = re.search(heading, text, re.IGNORECASE)
        if not match:
            continue
        section = text[match.end():]
        section = _SECTION_BREAK.split(section, maxsplit=1)[0]
        items = _clean_string_list(section)
        if items:
            return items
    return []


def _sanitize_student_profile(raw_profile: Any) -> dict:
    profile = raw_profile if isinstance(raw_profile, dict) else {}
    return {
        "full_name": _normalize_full_name_for_extraction(profile.get("full_name")),
        "roll_number": _normalize_roll_number_for_extraction(profile.get("roll_number")),
        "branch": _normalize_branch(profile.get("branch")),
        "current_semester": _parse_semester_token(profile.get("current_semester")),
        "sgpa": _to_float(profile.get("sgpa"), minimum=0.0, maximum=10.0),
        "cgpa": _to_float(profile.get("cgpa"), minimum=0.0, maximum=10.0),
        "phone": _normalize_phone(profile.get("phone")),
        "linkedin_url": _normalize_url(profile.get("linkedin_url"), "linkedin.com"),
        "github_url": _normalize_url(profile.get("github_url"), "github.com"),
        "skills": _clean_string_list(profile.get("skills")),
        "certifications": _clean_string_list(profile.get("certifications")),
    }


def _collect_missing_fields(student_profile: dict) -> list[str]:
    missing: list[str] = []
    for key in (
        "full_name",
        "roll_number",
        "branch",
        "current_semester",
        "sgpa",
        "cgpa",
        "phone",
        "linkedin_url",
        "github_url",
    ):
        if student_profile.get(key) is None:
            missing.append(f"student_profile.{key}")
    if not student_profile.get("skills"):
        missing.append("student_profile.skills")
    if not student_profile.get("certifications"):
        missing.append("student_profile.certifications")
    return missing


def _collect_low_confidence_fields(student_profile: dict) -> list[str]:
    low_conf: list[str] = []
    if student_profile.get("branch") == "Other":
        low_conf.append("student_profile.branch")
    if student_profile.get("full_name") and len(student_profile["full_name"]) < 4:
        low_conf.append("student_profile.full_name")
    if student_profile.get("skills") and len(student_profile["skills"]) < 2:
        low_conf.append("student_profile.skills")
    return low_conf


def _calculate_confidence_score(student_profile: dict) -> float:
    weights = {
        "full_name": 0.18,
        "phone": 0.14,
        "branch": 0.12,
        "current_semester": 0.10,
        "cgpa": 0.12,
        "sgpa": 0.06,
        "roll_number": 0.06,
        "linkedin_url": 0.07,
        "github_url": 0.05,
        "skills": 0.06,
        "certifications": 0.04,
    }
    score = 0.0
    for key, weight in weights.items():
        value = student_profile.get(key)
        if isinstance(value, list):
            if value:
                score += weight
        elif value is not None:
            score += weight
    if student_profile.get("branch") == "Other":
        score -= 0.05
    return round(max(0.0, min(1.0, score)), 2)


def _build_structured_payload(student_profile: Any) -> dict:
    cleaned_profile = _sanitize_student_profile(student_profile)
    missing_fields = _collect_missing_fields(cleaned_profile)
    low_confidence_fields = _collect_low_confidence_fields(cleaned_profile)
    confidence_score = _calculate_confidence_score(cleaned_profile)

    highlight_fields: list[str] = []
    seen: set[str] = set()
    for key in [*missing_fields, *low_confidence_fields]:
        if key not in seen:
            seen.add(key)
            highlight_fields.append(key)

    return {
        "student_profile": cleaned_profile,
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
    return _build_structured_payload(raw_payload.get("student_profile"))


def _fallback_regex_extract(text: str) -> dict:
    profile = {
        "full_name": _extract_candidate_name(text),
        "roll_number": _extract_first_match(
            text,
            [
                r"(?:roll(?:\s*number|\s*no\.?)?|enrollment(?:\s*number|\s*no\.?)?|enrolment(?:\s*number|\s*no\.?)?)\s*[:\-]?\s*([A-Za-z0-9/\-]{4,30})",
            ],
        ),
        "branch": _extract_branch_from_text(text),
        "current_semester": _extract_semester_from_text(text),
        "sgpa": _extract_score_from_text(text, "SGPA"),
        "cgpa": _extract_score_from_text(text, "CGPA"),
        "phone": _extract_phone_from_text(text),
        "linkedin_url": _normalize_url(text, "linkedin.com"),
        "github_url": _normalize_url(text, "github.com"),
        "skills": _extract_section_list(
            text,
            [
                r"\btechnical skills\b",
                r"\bskills\b",
                r"\bcore competencies\b",
            ],
        ),
        "certifications": _extract_section_list(
            text,
            [
                r"\bcertifications?\b",
                r"\blicenses?\b",
            ],
        ),
    }
    return _with_legacy_aliases(_build_structured_payload(profile))


async def _call_openai(text: str) -> dict:
    empty = _with_legacy_aliases(_empty_structured_payload())
    try:
        from langchain_core.messages import HumanMessage  # type: ignore
        from langchain_openai import ChatOpenAI  # type: ignore

        use_openrouter = bool(settings.OPENROUTER_API_KEY)
        use_openai = bool(settings.OPENAI_API_KEY) and not use_openrouter
        api_key = settings.OPENAI_API_KEY if use_openai else settings.OPENROUTER_API_KEY
        if not api_key:
            return empty

        llm_kwargs = {
            "model": "gpt-4o-mini" if use_openai else "openai/gpt-4o-mini",
            "temperature": 0.0,
            "api_key": api_key,
        }
        if not use_openai:
            llm_kwargs["base_url"] = "https://openrouter.ai/api/v1"

        llm = ChatOpenAI(**llm_kwargs)
        prompt = f"""You are an AI assistant integrated into a student placement platform.

Extract resume details for auto-filling a student profile form.

Return ONLY valid JSON in this structure:
{{
  "student_profile": {{
    "full_name": string or null,
    "roll_number": string or null,
    "branch": "CSE | ECE | ME | CE | EE | IT | AI | Other" or null,
    "current_semester": number or null,
    "sgpa": number or null,
    "cgpa": number or null,
    "phone": string or null,
    "linkedin_url": string or null,
    "github_url": string or null,
    "skills": [string],
    "certifications": [string]
  }},
  "system_flags": {{
    "needs_review": true,
    "missing_fields": [list of fields that are null or unclear],
    "confidence_score": number
  }},
  "ui_instructions": {{
    "show_popup": true,
    "popup_message": "{_POPUP_MESSAGE}",
    "highlight_fields": [list of fields that are null or low confidence]
  }}
}}

Rules:
- Use only information that is clearly present in the resume text.
- If a field is missing or unclear, return null.
- Normalize branch to the allowed short codes only.
- current_semester must be an integer between 1 and 10 when present.
- SGPA and CGPA must be between 0 and 10.
- phone must be digits only, ideally 10 digits.
- skills and certifications must be arrays of short strings, not paragraphs.
- Do not hallucinate roll number or semester if they are not explicitly mentioned.

Resume text:
{text[:12000]}
"""
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        raw = (response.content or "").strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
        data = json.loads(raw)
        return _with_legacy_aliases(_sanitize_extraction_payload(data))
    except json.JSONDecodeError as exc:
        logger.warning("[resume-profile] JSON parse failed: %s", exc)
        return _fallback_regex_extract(text)
    except Exception as exc:
        logger.error("[resume-profile] LLM extraction failed: %s", exc)
        return _fallback_regex_extract(text)


async def _extract_resume_text(resume_url: str) -> str:
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        response = await client.get(resume_url)
        response.raise_for_status()
        file_bytes = response.content

    tmp_path: Optional[str] = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name
        return await asyncio.to_thread(extract_resume_text_with_ocr, tmp_path)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


async def extract_resume_profile_data(resume_url: str) -> dict:
    """Extract profile autofill data from an uploaded resume URL."""
    empty = _with_legacy_aliases(_empty_structured_payload())
    if not resume_url:
        return empty

    try:
        text = await _extract_resume_text(resume_url)
    except Exception as exc:
        logger.error("[resume-profile] Text extraction failed: %s", exc)
        return empty

    if not text or len(text.strip()) < 20:
        return empty

    if settings.OPENAI_API_KEY or settings.OPENROUTER_API_KEY:
        return await _call_openai(text)

    return _fallback_regex_extract(text)
