from typing import Optional, Any
from datetime import datetime, timezone


def serialize_doc(doc: dict) -> dict:
    """
    Convert a Firestore document dict to a JSON-serializable dict.
    Firestore docs use string IDs (not ObjectIds), so no bson conversion needed.
    Handles datetime serialization (including Firestore DatetimeWithNanoseconds).
    """
    if doc is None:
        return None
    result = {}
    for key, value in doc.items():
        if isinstance(value, datetime):
            result[key] = value.isoformat()
        elif isinstance(value, list):
            result[key] = [serialize_doc(v) if isinstance(v, dict) else v for v in value]
        elif isinstance(value, dict):
            result[key] = serialize_doc(value)
        else:
            result[key] = value
    return result


def firestore_doc_to_dict(doc_snapshot) -> Optional[dict]:
    """
    Convert a Firestore DocumentSnapshot to a plain dict with 'id' field.
    Returns None if the document doesn't exist.
    """
    if not doc_snapshot.exists:
        return None
    data = doc_snapshot.to_dict() or {}
    return {"id": doc_snapshot.id, **serialize_doc(data)}


def validate_id(id_str: Any) -> Optional[str]:
    """
    Validate that an ID string is non-empty.
    Replaces validate_object_id() — Firestore uses plain string IDs.
    Returns the string if valid, None otherwise.
    """
    if not id_str:
        return None
    return str(id_str)


# Keep validate_object_id as an alias for backward compatibility
def validate_object_id(id_str: Any) -> Optional[str]:
    """Alias for validate_id() — Firestore uses string IDs, not ObjectIds."""
    return validate_id(id_str)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
