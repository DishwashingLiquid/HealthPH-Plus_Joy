from region_normalization import REGIONS, normalize_region

def get_allowed_analytics_regions(user):
    # None means unrestricted access for SUPERADMIN.
    if user.get("user_type") == "SUPERADMIN":
        return None

    assigned = user.get("accessible_regions") or []

    if isinstance(assigned, str):
        assigned = assigned.split(",")

    if not isinstance(assigned, list):
        return set()

    allowed = set()

    for value in assigned:
        if str(value).strip().upper() == "ALL":
            allowed.update(REGIONS)
            continue

        region = normalize_region(value)
        if region:
            allowed.add(region)

    return allowed

def get_analytics_entry_region(entry):
    location = entry.get("location") or {}

    if not isinstance(location, dict):
        return None

    recognized = {
        region
        for field in ("region", "regionCode", "regionName")
        if (region := normalize_region(location.get(field)))
    }

    # Unknown or conflicting regions cannot establish regional access.
    if len(recognized) != 1:
        return None

    return recognized.pop()