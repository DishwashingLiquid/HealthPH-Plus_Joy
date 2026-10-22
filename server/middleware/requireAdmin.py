from bson import ObjectId
from fastapi import Depends, HTTPException, status
from typing_extensions import Annotated

from config.database import user_collection
from middleware.requireAuth import require_auth
from models.user import AdminResult


def require_admin(
    user_id: Annotated[str, Depends(require_auth)],
):
    user = user_collection.find_one(
        {"_id": ObjectId(user_id)},
        {"user_type": 1, "role_label": 1, "is_disabled": 1},
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session is invalid. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.get("is_disabled", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been disabled. Please contact support.",
        )

    is_admin = (
        user.get("user_type") == "SUPERADMIN"
        or user.get("role_label") == "Admin"
    )

    return AdminResult(result=is_admin, id=user_id)