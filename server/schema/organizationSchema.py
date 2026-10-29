def individual_organization(organization) -> dict:
    return {
        "id": str(organization["_id"]),
        "name": organization.get("name", ""),
        "description": organization.get("description", ""),
        "main_region": organization.get("main_region", ""),
        "region_coverage": str(organization.get("region_coverage", "")).split(","),
        "partnership_status": organization.get("partnership_status", "ACTIVE"),
        "created_by": organization.get("created_by", ""),
        "created_at": str(organization.get("created_at", "")),
        "updated_at": str(organization.get("updated_at", "")),
    }

def list_organizations(organizations) -> list:
    return [individual_organization(organization) for organization in organizations]