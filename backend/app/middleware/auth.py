import asyncio
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.firebase_jwt import decode_firebase_token
from app.core.enums import UserRole
from app.core.exceptions import CredentialsException, ForbiddenException
from app.db.database import get_database

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_database),
) -> dict:
    token = credentials.credentials
    payload = decode_firebase_token(token)
    if not payload:
        raise CredentialsException()

    firebase_uid = payload.get("uid")
    if not firebase_uid:
        raise CredentialsException()

    # Look up user document in Firestore (document ID = firebase_uid)
    user_ref = db.collection("users").document(firebase_uid)
    user_doc = await asyncio.to_thread(user_ref.get)

    if not user_doc.exists:
        raise CredentialsException()

    user = {"id": firebase_uid, **user_doc.to_dict()}

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    return user


async def get_current_active_user(current_user: dict = Depends(get_current_user)) -> dict:
    return current_user


def require_roles(*roles: UserRole):
    async def role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        user_role = current_user.get("role")
        if user_role not in [r.value for r in roles]:
            raise ForbiddenException()
        return current_user
    return role_checker


require_student = require_roles(UserRole.STUDENT)
require_admin = require_roles(UserRole.PLACEMENT_ADMIN)
require_management = require_roles(UserRole.COLLEGE_MANAGEMENT)
require_admin_or_management = require_roles(UserRole.PLACEMENT_ADMIN, UserRole.COLLEGE_MANAGEMENT)
