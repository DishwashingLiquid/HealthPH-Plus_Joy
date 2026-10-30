"""Shared PSGC region normalization and location-name resolution."""
import json
import logging
import re
import unicodedata
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

DIRECTORY_PATH = (
    Path(__file__).resolve().parent
    / "data"
    / "psgc_locations.json"
)


@lru_cache(maxsize=1)
def _directory():
    data = json.loads(DIRECTORY_PATH.read_text(encoding="utf-8"))

    if data.get("schema_version") != 1:
        raise ValueError("Unsupported PSGC directory format.")

    return data


def _key(value):
    text = unicodedata.normalize(
        "NFKD",
        str(value or "").casefold(),
    )
    text = "".join(
        character
        for character in text
        if not unicodedata.combining(character)
    )
    return " ".join(re.findall(r"[a-z0-9]+", text))


REGION_NAMES = {
    region["code"]: region["name"]
    for region in _directory()["regions"]
}

REGIONS = tuple(REGION_NAMES)

NUMERIC_REGION_CODES = {
    value: region["code"]
    for region in _directory()["regions"]
    for value in (
        region["psgc_code"],
        region["correspondence_code"],
    )
    if value
}

REGION_ALIASES = {code: code for code in REGIONS}
REGION_ALIASES.update({
    f"REGION {code}": code
    for code in REGIONS
})

for item in _directory()["regions"]:
    for name in (item["name"], item["official_name"]):
        REGION_ALIASES[name.upper()] = item["code"]

    if item["name"].endswith(" Region"):
        REGION_ALIASES[item["name"][:-7].upper()] = item["code"]

REGION_ALIASES.update({
    "IV-A": "IVA",
    "REGION IV-A": "IVA",
    "IV-B": "IVB",
    "REGION IV-B": "IVB",
    "REGION XIII (CARAGA)": "XIII",
    "METRO MANILA": "NCR",
    "MIMAROPA REGION": "IVB",
    "REGION III - CENTRAL LUZON": "III",
    "REGION IV-A - CALABARZON": "IVA",
    "REGION I - ILOCOS REGION": "I",
    **NUMERIC_REGION_CODES,
})


def normalize_region(value):
    key = " ".join(str(value or "").strip().upper().split())
    return REGION_ALIASES.get(
        key.replace("REGION REGION", "REGION")
    )


@lru_cache(maxsize=1)
def _place_index():
    index = {}

    def add(name, region):
        key = _key(name)

        if key:
            index.setdefault(key, set()).add(region)

    for name, region in REGION_ALIASES.items():
        add(name, region)

    for place in _directory()["places"]:
        name = place["name"]
        region = place["region"]

        add(name, region)
        add(place["code"], region)
        add(place.get("correspondence_code"), region)

        base = _key(name)

        if place["level"] == "City":
            base = re.sub(r"^city of | city$", "", base)
            aliases = (
                base,
                f"city of {base}",
                f"{base} city",
            )

        elif place["level"] == "Prov":
            aliases = (
                base,
                f"province of {base}",
                f"{base} province",
            )
        elif place["level"] == "Mun":
            aliases = (
                base,
                f"municipality of {base}",
                f"{base} municipality",
            )
        else:
            aliases = (base,)

        for alias in aliases:
            add(alias, region)

    return index


def _text_regions(value):
    candidates = None

    for part in str(value or "").split(","):
        key = _key(part)

        if not key or key in {
            "philippines",
            "ph",
            "phl",
            "republic of the philippines",
        }:
            continue

        matches = _place_index().get(key)

        if not matches:
            return set()

        candidates = (
            set(matches)
            if candidates is None
            else candidates & matches
        )

        if not candidates:
            return set()

    return candidates or set()


def resolve_region(location, *, allow_raw=False):
    """Return (region, issue); unresolved locations remain unassigned."""
    if not isinstance(location, dict):
        return None, "invalid_location"

    supplied = [
        location.get(field)
        for field in ("region", "regionCode", "regionName")
        if str(location.get(field) or "").strip()
    ]

    if supplied:
        regions = {
            region
            for value in supplied
            if (region := normalize_region(value))
        }

        if len(regions) > 1:
            return None, "conflicting_region"

        if not regions:
            return None, "unrecognized_region"

        issue = (
            "unrecognized_region_name"
            if (
                location.get("regionName")
                and not normalize_region(location["regionName"])
            )
            else None
        )

        if (
            location.get("regionCode")
            and not normalize_region(location["regionCode"])
            and normalize_region(location.get("regionName"))
        ):
            issue = "region_name_fallback"

        return regions.pop(), issue

    if not allow_raw:
        return None, "unrecognized_region"

    values = [
        location.get(field)
        for field in (
            "province",
            "provinceName",
            "city",
            "cityName",
        )
        if str(location.get(field) or "").strip()
    ]

    if not values:
        values = [location.get("raw")]

    candidates = None

    for value in values:
        matches = _text_regions(value)

        if not matches:
            return None, "unrecognized_location"

        candidates = (
            matches
            if candidates is None
            else candidates & matches
        )

        if not candidates:
            return None, "conflicting_location"

    if len(candidates or set()) != 1:
        return None, "ambiguous_location"

    return candidates.pop(), None

def observed_region(location, report_id=None):
    region, issue = resolve_region(location)

    if issue:
        logger.warning(
            "Region normalization: report=%s issue=%s resolved=%s",
            report_id,
            issue,
            region,
        )

    return region