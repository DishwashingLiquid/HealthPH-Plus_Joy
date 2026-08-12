import re

from config.database import role_label_collection
from helpers.miscHelpers import get_ph_datetime


DEFAULT_ROLE_LABELS = [
    {"name": "Admin", "description": "Administrative platform access"},
    {"name": "Analyst", "description": "Access to analytics and analysis tools"},
    {"name": "DOH Official", "description": "Official DOH representative"},
    {"name": "LGU Worker", "description": "Local government health worker"},
    {"name": "Researcher", "description": "Academic or research institution member"},
    {"name": "Viewer", "description": "Read-only dashboard access"},
]


def normalize_role_label_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip()) if name else ""


def ensure_default_role_labels():
    for role_label in DEFAULT_ROLE_LABELS:
        existing_role_label = role_label_collection.find_one(
            {
                "name": {
                    "$regex": f"^{re.escape(role_label['name'])}$",
                    "$options": "i",
                }
            }
        )

        if existing_role_label:
            continue

        role_label_collection.insert_one(
            {
                "name": role_label["name"],
                "description": role_label["description"],
                "is_active": True,
                "is_system": True,
                "created_at": get_ph_datetime(),
                "updated_at": get_ph_datetime(),
            }
        )


def role_label_exists(name: str) -> bool:
    ensure_default_role_labels()
    normalized_name = normalize_role_label_name(name)

    if not normalized_name:
        return False

    return (
        role_label_collection.count_documents(
            {
                "name": {
                    "$regex": f"^{re.escape(normalized_name)}$",
                    "$options": "i",
                },
                "is_active": {"$ne": False},
            }
        )
        > 0
    )


def get_role_label_name(name: str) -> str:
    ensure_default_role_labels()
    normalized_name = normalize_role_label_name(name)

    if not normalized_name:
        return ""

    role_label = role_label_collection.find_one(
        {
            "name": {
                "$regex": f"^{re.escape(normalized_name)}$",
                "$options": "i",
            },
            "is_active": {"$ne": False},
        }
    )

    return role_label.get("name", "") if role_label else normalized_name
