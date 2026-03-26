"""
Verification service — AI-powered Aadhar/Govt ID verification.
Uses OpenAI Vision to extract data from uploaded documents and compare with profile.
All Firestore SDK calls are synchronous and wrapped in asyncio.to_thread().
"""
import asyncio
import difflib
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from app.core.config import settings
from app.db.helpers import utcnow

logger = logging.getLogger(__name__)


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _doc_to_dict(doc_snapshot) -> Optional[dict]:
    if not doc_snapshot.exists:
        return None
    data = doc_snapshot.to_dict() or {}
    result = {"id": doc_snapshot.id}
    for k, v in data.items():
        if isinstance(v, datetime):
            result[k] = v.isoformat()
        else:
            result[k] = v
    return result


def _normalize_name(name: str) -> str:
    """Normalize a name for fuzzy comparison."""
    return " ".join(name.lower().strip().split())


def _names_match(name1: str, name2: str, threshold: float = 0.80) -> bool:
    """Fuzzy match two names using SequenceMatcher."""
    if not name1 or not name2:
        return False
    n1 = _normalize_name(name1)
    n2 = _normalize_name(name2)
    ratio = difflib.SequenceMatcher(None, n1, n2).ratio()
    return ratio >= threshold


def _dobs_match(dob1: str, dob2: str) -> bool:
    """Compare two date strings (flexible format)."""
    if not dob1 or not dob2:
        return False
    # Normalize: extract digits only and compare DDMMYYYY or YYYYMMDD
    digits1 = "".join(filter(str.isdigit, dob1))
    digits2 = "".join(filter(str.isdigit, dob2))
    if len(digits1) != 8 or len(digits2) != 8:
        return False
    # Try to parse both and compare
    for fmt in ["%d%m%Y", "%Y%m%d"]:
        try:
            d1 = datetime.strptime(digits1, fmt)
            d2 = datetime.strptime(digits2, fmt)
            return d1.date() == d2.date()
        except ValueError:
            continue
    return digits1 == digits2


class VerificationService:
    def __init__(self, db):
        self.db = db

    async def extract_aadhar_data(self, doc_url: str) -> dict:
        """Use OpenAI Vision to extract name, DOB, and last 4 digits from Aadhar/Govt ID."""
        if not settings.OPENAI_API_KEY:
            logger.warning("OPENAI_API_KEY not configured — skipping OCR extraction")
            return {"name": None, "dob": None, "aadhar_last4": None, "raw_response": "API key not configured"}

        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

            prompt = (
                "This is an Aadhar card or government ID document. "
                "Extract the following information and return ONLY valid JSON with these exact keys: "
                '{"name": "full name as printed", "dob": "date of birth in DD/MM/YYYY format", '
                '"aadhar_last4": "last 4 digits of Aadhar number or ID number"}. '
                "If a field cannot be found, set it to null. "
                "Return only the JSON object, no explanation."
            )

            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": doc_url, "detail": "high"}},
                        ],
                    }
                ],
                max_tokens=200,
                response_format={"type": "json_object"},
            )

            raw = response.choices[0].message.content or "{}"
            import json
            data = json.loads(raw)
            return {
                "name": data.get("name"),
                "dob": data.get("dob"),
                "aadhar_last4": data.get("aadhar_last4"),
                "raw_response": raw,
            }

        except Exception as e:
            logger.error(f"[VerificationService] OCR extraction failed: {e}")
            return {"name": None, "dob": None, "aadhar_last4": None, "raw_response": str(e)}

    async def submit_verification(self, student_id: str, doc_url: str) -> dict:
        """Submit Aadhar document for verification. Extracts data via AI and compares with profile."""
        # Fetch student profile
        profile_doc = await asyncio.to_thread(
            self.db.collection("student_profiles").document(student_id).get
        )
        if not profile_doc.exists:
            raise HTTPException(status_code=404, detail="Student profile not found")

        profile = profile_doc.to_dict() or {}

        # Extract data from document via AI
        extracted = await self.extract_aadhar_data(doc_url)

        # Compare with profile
        name_match = _names_match(extracted.get("name") or "", profile.get("full_name") or "")

        # DOB comparison: profile stores YYYY-MM-DD, extracted is DD/MM/YYYY
        profile_dob = profile.get("date_of_birth") or ""
        extracted_dob = extracted.get("dob") or ""
        dob_match = _dobs_match(extracted_dob, profile_dob)

        # Aadhar last 4 comparison
        profile_last4 = profile.get("aadhar_last4") or ""
        extracted_last4 = extracted.get("aadhar_last4") or ""
        aadhar_last4_match = bool(profile_last4 and extracted_last4 and profile_last4 == extracted_last4[-4:])

        # Confidence
        matches = sum([name_match, dob_match, aadhar_last4_match])
        if matches == 3:
            confidence = "HIGH"
        elif matches == 2:
            confidence = "MEDIUM"
        else:
            confidence = "LOW"

        now = utcnow()
        verification_data = {
            "student_id": student_id,
            "student_name": profile.get("full_name"),
            "document_url": doc_url,
            "extracted_name": extracted.get("name"),
            "extracted_dob": extracted.get("dob"),
            "extracted_aadhar_last4": extracted.get("aadhar_last4"),
            "name_match": name_match,
            "dob_match": dob_match,
            "aadhar_last4_match": aadhar_last4_match,
            "overall_confidence": confidence,
            "status": "PENDING",
            "admin_notes": None,
            "submitted_at": now,
            "reviewed_at": None,
            "reviewed_by": None,
        }

        # Upsert: use student_id as document ID (one verification per student)
        await asyncio.to_thread(
            self.db.collection("verifications").document(student_id).set,
            verification_data,
        )

        result = {"id": student_id, **verification_data}
        result["submitted_at"] = now.isoformat() if hasattr(now, "isoformat") else str(now)
        return result

    async def get_verification(self, student_id: str) -> Optional[dict]:
        """Get verification record for a student."""
        doc = await asyncio.to_thread(
            self.db.collection("verifications").document(student_id).get
        )
        return _doc_to_dict(doc)

    async def list_verifications(self, status: Optional[str] = None, page: int = 1, limit: int = 20) -> dict:
        """List all verifications, optionally filtered by status."""
        docs = await asyncio.to_thread(
            self.db.collection("verifications").get
        )
        all_records = [_doc_to_dict(d) for d in docs if d.exists]

        if status:
            all_records = [r for r in all_records if r and r.get("status") == status]

        # Sort by submitted_at descending
        all_records.sort(key=lambda x: x.get("submitted_at", ""), reverse=True)

        total = len(all_records)
        skip = (page - 1) * limit
        paginated = all_records[skip: skip + limit]

        return {"verifications": paginated, "total": total, "page": page, "limit": limit}

    async def review_verification(self, student_id: str, admin_user: dict, status: str, admin_notes: Optional[str]) -> dict:
        """Admin reviews a verification — approve or reject."""
        doc = await asyncio.to_thread(
            self.db.collection("verifications").document(student_id).get
        )
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Verification record not found")

        now = utcnow()
        update_data = {
            "status": status,
            "admin_notes": admin_notes,
            "reviewed_at": now,
            "reviewed_by": admin_user.get("id"),
        }
        await asyncio.to_thread(
            self.db.collection("verifications").document(student_id).update,
            update_data,
        )

        # Send in-app notification to student
        try:
            from app.services.notification_service import NotificationService
            notif_service = NotificationService(self.db)
            if status == "VERIFIED":
                title = "Identity Verified"
                message = "Your Aadhar/Govt ID has been verified successfully."
            else:
                reason = admin_notes or "Please re-upload a clearer document."
                title = "Identity Verification Rejected"
                message = f"Your identity verification was not approved. Reason: {reason}"
            await notif_service.create(student_id, title, message, "/student/profile")
        except Exception as e:
            logger.warning(f"[VerificationService] Failed to send notification: {e}")

        updated = _doc_to_dict(await asyncio.to_thread(
            self.db.collection("verifications").document(student_id).get
        ))
        return updated
