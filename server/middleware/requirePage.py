import re

from bson import ObjectId
from fastapi import Depends, HTTPException, status
from typing_extensions import Annotated

from config.database import user_collection, role_label_collection
from middleware.requireAuth import require_auth


def require_page(page_name: str):
    def page_checker(
        user_id: Annotated[str, Depends(require_auth)],
    ):
        user = user_collection.find_one(
            {"_id": ObjectId(user_id)},
            {
                "user_type": 1,
                "role_label": 1,
                "accessible_regions": 1,
                "is_disabled": 1,
            },
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Your session is invalid. Please sign in again.",
            )

        if user.get("is_disabled", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been disabled.",
            )

        if user.get("user_type") == "SUPERADMIN":
            return user

        role_name = str(user.get("role_label") or "").strip()

        role = role_label_collection.find_one(
            {
                "name": {
                    "$regex": f"^{re.escape(role_name)}$",
                    "$options": "i",
                },
                "is_active": {"$ne": False},
            },
            {"accessible_pages": 1},
        ) if role_name else None

        pages = role.get("accessible_pages") if role else None

        if not isinstance(pages, list) or page_name not in pages:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this page.",
            )

        return  user

    return page_checker