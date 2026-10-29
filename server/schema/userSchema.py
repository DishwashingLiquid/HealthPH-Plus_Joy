import re

from config.database import role_label_collection
from helpers.roleLabelHelpers import HEALTHPH_PLUS_PAGES


def get_accessible_pages(user) -> list[str]:
    if user.get("user_type") == "SUPERADMIN":
        return HEALTHPH_PLUS_PAGES.copy()

    role_name = str(user.get("role_label", "")).strip()
    if not role_name:
        return []

    role_label = role_label_collection.find_one(
        {
            "name": {"$regex": f"^{re.escape(role_name)}$", "$options": "i"},
            "is_active": {"$ne": False},
        },
        {"accessible_pages": 1},
    )

    if not role_label:
        return []

    accessible_pages = role_label.get("accessible_pages")
    return (
        accessible_pages
        if isinstance(accessible_pages, list)
        else HEALTHPH_PLUS_PAGES.copy()
    )


# Create a dictionary of a single User
def individual_user(user, accessible_pages=None) -> dict:
    return {
        "id": str(user["_id"]),
        "region": user["region"],
        "accessible_regions": str(user["accessible_regions"]).split(","),
        "organization": user["organization"],
        "email": user["email"],
        "first_name": user["first_name"] or "",
        "last_name": user["last_name"] or "",
        "is_disabled": user["is_disabled"],
        "user_type": user["user_type"],
        "role_label": user.get("role_label", ""),
        "accessible_pages": (
            accessible_pages
            if accessible_pages is not None
            else get_accessible_pages(user)
        ),
        "created_at": str(user["created_at"]) if "created_at" in user.keys() else "",
        "updated_at": str(user["updated_at"]) if "updated_at" in user.keys() else "",
    }

# Create a list of User dictionaries
def list_users(users) -> list:
    user_list = list(users)
    roles_by_name = {}
    for role in role_label_collection.find(
        {"is_active": {"$ne": False}},
        {"name": 1, "accessible_pages": 1},
    ):
        accessible_pages = role.get("accessible_pages")
        roles_by_name[str(role.get("name", "")).strip().casefold()] = (
            accessible_pages
            if isinstance(accessible_pages, list)
            else HEALTHPH_PLUS_PAGES.copy()
        )

    return [
        individual_user(
            user,
            HEALTHPH_PLUS_PAGES.copy()
            if user.get("user_type") == "SUPERADMIN"
            else roles_by_name.get(
                str(user.get("role_label", "")).strip().casefold(), []
            ),
        )
        for user in user_list
    ]
