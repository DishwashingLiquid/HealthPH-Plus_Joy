import json
from functools import lru_cache
from pathlib import Path


def _clean_label(value):
    return " ".join(value.split()) if isinstance(value, str) else ""

@lru_cache(maxsize=1)
def _symptom_aliases():
    path = (
        Path(__file__).resolve().parents[2]
        / "services"
        / "disease-detection-service"
        / "healthph_symptoms"
        / "aliases.json"
    )

    payload = json.loads(path.read_text(encoding="utf-8"))
    aliases = {}

    for alias in payload["aliases"]:
        phrase = _clean_label(alias["text"])
        canonical = _clean_label(alias["normalized_symptom"])

        if not phrase or not canonical:
            raise ValueError("Symptom aliases contain an empty label.")

        aliases[phrase.casefold()] = canonical
        aliases.setdefault(canonical.casefold(), canonical)

    return aliases


def get_entry_symptoms(entry):
    aliases = _symptom_aliases()
    symptoms = {}

    def add_label(value):
        label = _clean_label(value)

        if label:
            label = aliases.get(label.casefold(), label)
            symptoms.setdefault(label.casefold(), label)

    # keep selected symptoms from self reports. the buttons
    if entry.get("source_type") == "self_report":
        metadata = entry.get("metadata") or {}
        submitted = metadata.get("symptom_labels", [])

        if isinstance(submitted, list):
            for label in submitted:
                add_label(label)

    # add non-negated extracted mentions from either source
    analysis = entry.get("analysis") or {}
    extraction = analysis.get("symptom_extraction") or {}
    mentions = analysis.get("symptoms", [])

    if (
        extraction.get("status") == "completed"
        and isinstance(mentions, list)
    ):
        for mention in mentions:
            if (
                not isinstance(mention, dict)
                or mention.get("negated") is not False
            ):
                continue

            add_label(
                mention.get("normalized_symptom")
                or mention.get("text")
            )

    return symptoms