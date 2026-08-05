def individual_role_label(role_label) -> dict:
    return {
        "id": str(role_label["_id"]),
        "name": role_label.get("name", ""),
        "description": role_label.get("description", ""),
        "is_active": role_label.get("is_active", True),
        "is_system": role_label.get("is_system", False),
        "created_at": str(role_label.get("created_at", "")),
        "updated_at": str(role_label.get("updated_at", "")),
    }


def list_role_labels(role_labels) -> list:
    return [individual_role_label(role_label) for role_label in role_labels]
