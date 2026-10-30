from region_normalization import (
    REGIONS,
    normalize_region,
    resolve_region,
)

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
    region, _ = resolve_region(
        entry.get("location"),
        allow_raw=True,
    )
    return region