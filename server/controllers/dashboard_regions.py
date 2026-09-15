"""Read-only region adapters for Disease Watch, Health Literacy and Sentiment Pulse.

Stored/mobile contracts and the shared normalizer remain unchanged. These
adapters resolve legacy field layouts only while building dashboard results.
"""

from region_normalization import REGION_ALIASES, REGIONS, normalize_region


LOCATION_REGION_PATHS = ("location.regionCode", "location.regionName")
USER_REGION_PATHS = ("region", "regionCode", "regionLabel", *LOCATION_REGION_PATHS)
EVENT_REGION_PATHS = (
    "region", "regionCode", "regionName", "regionLabel",
    *LOCATION_REGION_PATHS,
    "metadata.region", "metadata.regionCode", "metadata.regionName",
    "user_location.regionCode", "user_location.regionLabel",
    "userLocation.regionCode", "userLocation.regionLabel",
)


def _field_value(document, path):
    value = document
    for field in path.split("."):
        if not isinstance(value, dict):
            return None
        value = value.get(field)
    return value


def dashboard_region(document, paths=EVENT_REGION_PATHS):
    """Unknown fields may fall back; contradictory recognized fields stay unknown."""
    regions = {
        region for path in paths
        if (region := normalize_region(_field_value(document, path))) is not None
    }
    return next(iter(regions)) if len(regions) == 1 else None


def mongo_region_expression(paths=EVENT_REGION_PATHS):
    """Equivalent resolution inside MongoDB, without fetching every response.

    Normalize each candidate once, then accept exactly one distinct known code.
    Alias tables come from the existing normalizer, including its explicit
    numeric-code allowlist. No city/province or PH-* numbering is guessed.
    """
    text = {"$cond": [
        {"$in": [{"$type": "$$candidate"}, ["string", "int", "long"]]},
        {"$toString": "$$candidate"}, "",
    ]}
    key = {"$replaceAll": {
        "input": {"$toUpper": {"$reduce": {
            "input": {"$regexFindAll": {"input": text, "regex": r"\S+"}},
            "initialValue": "",
            "in": {"$concat": [
                "$$value", {"$cond": [{"$eq": ["$$value", ""]}, "", " "]}, "$$this.match",
            ]},
        }}},
        "find": "REGION REGION", "replacement": "REGION",
    }}
    normalized = {"$map": {
        "input": [{"$ifNull": [f"${path}", None]} for path in paths],
        "as": "candidate",
        "in": {"$let": {
            "vars": {"key": key},
            "in": {"$switch": {
                "branches": [
                    {"case": {"$in": ["$$key", [alias for alias, code in REGION_ALIASES.items() if code == region]]},
                     "then": region}
                    for region in REGIONS
                ],
                "default": None,
            }},
        }},
    }}
    return {"$let": {
        "vars": {"regions": {"$setDifference": [normalized, [None]]}},
        "in": {"$cond": [
            {"$eq": [{"$size": "$$regions"}, 1]},
            {"$arrayElemAt": ["$$regions", 0]}, None,
        ]},
    }}


def dashboard_region_match(regions, paths=EVENT_REGION_PATHS):
    """Keep source/date filters indexable; apply legacy normalization only in reads."""
    codes = list(dict.fromkeys(normalize_region(region) for region in regions))
    return {"$expr": {"$in": [mongo_region_expression(paths), [code for code in codes if code]]}}
