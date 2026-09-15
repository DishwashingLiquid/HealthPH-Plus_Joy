"""Shared region identifiers for ingestion and derived regional reporting.

Numeric codes are an explicit allowlist, not inferred from the map's PH-* IDs
(those use a different numbering scheme). Extend only with verified mappings.
"""
import logging

logger = logging.getLogger(__name__)
REGION_NAMES = {
    "NCR": "National Capital Region", "I": "Ilocos Region",
    "II": "Cagayan Valley", "III": "Central Luzon", "IVA": "CALABARZON",
    "IVB": "MIMAROPA", "V": "Bicol Region", "CAR": "Cordillera Administrative Region",
    "VI": "Western Visayas", "VII": "Central Visayas", "VIII": "Eastern Visayas",
    "IX": "Zamboanga Peninsula", "X": "Northern Mindanao", "XI": "Davao Region",
    "XII": "SOCCSKSARGEN", "XIII": "Caraga",
    "BARMM": "Bangsamoro Autonomous Region in Muslim Mindanao",
}
REGIONS = tuple(REGION_NAMES)
NUMERIC_REGION_CODES = {
    # Verified code/name pairs in the read-only source inventory, 2026-09-11.
    "010000000": "I", "020000000": "II", "030000000": "III",
    "040000000": "IVA", "050000000": "V", "110000000": "XI",
    "130000000": "NCR", "170000000": "IVB",
}
REGION_ALIASES = {code: code for code in REGIONS}
REGION_ALIASES.update({f"REGION {code}": code for code in REGIONS})
REGION_ALIASES.update({name.upper(): code for code, name in REGION_NAMES.items()})
REGION_ALIASES.update({
    "IV-A": "IVA", "REGION IV-A": "IVA", "IV-B": "IVB", "REGION IV-B": "IVB",
    "REGION XIII (CARAGA)": "XIII", "METRO MANILA": "NCR",
    "MIMAROPA REGION": "IVB", "REGION III - CENTRAL LUZON": "III",
    "REGION IV-A - CALABARZON": "IVA", "REGION I - ILOCOS REGION": "I",
    **NUMERIC_REGION_CODES,
})


def normalize_region(value):
    key = " ".join(str(value or "").strip().upper().split())
    return REGION_ALIASES.get(key.replace("REGION REGION", "REGION"))


def resolve_region(location):
    """Return (canonical code, issue). Conflicting recognized values are skipped."""
    if not isinstance(location, dict):
        return None, "invalid_location"
    code, name = normalize_region(location.get("regionCode")), normalize_region(location.get("regionName"))
    if code and name and code != name:
        return None, "conflicting_region"
    if code:
        return code, "unrecognized_region_name" if location.get("regionName") and not name else None
    if name:
        return name, "region_name_fallback" if location.get("regionCode") else None
    return None, "unrecognized_region"


def observed_region(location, report_id=None):
    region, issue = resolve_region(location)
    if issue:
        # Avoid logging source text or personal/location details.
        logger.warning("Region normalization: report=%s issue=%s resolved=%s", report_id, issue, region)
    return region
