"""
Admin approval check dependency — checks that PLACEMENT_ADMIN users are approved
by the portal owner before they can access admin endpoints.

Does NOT modify middleware/auth.py (which is protected).
"""
from fastapi import Depends, HTTPException, status
from app.middleware.auth import get_current_user
from app.core.enums import UserRole


async def require_approved_placement_admin(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Checks that the current user is an APPROVED PLACEMENT_ADMIN.
    - None / "APPROVED"  → allow (backwards-compat for existing admins)
    - "PENDING"          → 403 with waiting message
    - "REJECTED"         → 403 with rejection reason
    """
    role = current_user.get("role")
    if role != UserRole.PLACEMENT_ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Placement Admin access required",
        )

    approval_status = current_user.get("approval_status")

    # Existing admins may not have this field — treat as approved
    if approval_status in (None, "APPROVED"):
        return current_user

    if approval_status == "PENDING":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is pending approval by the portal owner. You will receive an email when approved.",
        )

    # REJECTED
    reason = current_user.get("rejection_reason") or "Please contact the portal administrator."
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Your account has been rejected: {reason}",
    )
