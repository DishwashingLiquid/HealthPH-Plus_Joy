"""Approved question-type defaults with optional per-survey overrides."""

import json
import os
from dataclasses import dataclass, field


class ConfigurationError(ValueError):
    pass


@dataclass(frozen=True)
class SurveyRules:
    explanations: frozenset = frozenset()
    satisfaction: dict = field(default_factory=dict)
    excluded_texts: frozenset = frozenset()


def answer_key(value):
    """Typed scalar comparison: a choice '5' is distinct from numeric rating 5."""
    if type(value) not in (str, int, float) or (isinstance(value, str) and not value.strip()):
        return None
    import math
    if type(value) is float and not math.isfinite(value):
        return None
    return ("string", value) if isinstance(value, str) else ("number", value)


def parse_config(payload):
    try:
        if not isinstance(payload, dict) or set(payload) != {"surveys"} or not isinstance(payload["surveys"], dict):
            raise ValueError()
        result = {}
        for sid, rule in payload["surveys"].items():
            if not isinstance(sid, str) or not sid or not isinstance(rule, dict):
                raise ValueError()
            if set(rule) - {"explanationQuestionIds", "satisfaction", "excludedTexts"}:
                raise ValueError()
            ids = rule.get("explanationQuestionIds", [])
            excluded = rule.get("excludedTexts", [])
            satisfaction = rule.get("satisfaction", {})
            if (not isinstance(ids, list) or any(not isinstance(i, str) or not i for i in ids)
                    or len(set(ids)) != len(ids) or not isinstance(excluded, list)
                    or any(not isinstance(t, str) or not t.strip() for t in excluded)
                    or not isinstance(satisfaction, dict)):
                raise ValueError()
            for qid, scoring in satisfaction.items():
                required = {"validValues", "satisfiedValues"}
                optional = {"dissatisfiedValues", "neutralValues"}
                if (not isinstance(qid, str) or not qid or qid in ids
                        or not isinstance(scoring, dict) or not required <= set(scoring)
                        or set(scoring) - required - optional):
                    raise ValueError()
                for name in scoring:
                    values = scoring[name]
                    if not isinstance(values, list) or any(answer_key(v) is None for v in values):
                        raise ValueError()
                valid = {answer_key(v) for v in scoring["validValues"]}
                satisfied = {answer_key(v) for v in scoring["satisfiedValues"]}
                if not valid or not satisfied <= valid:
                    raise ValueError()
                groups = [satisfied]
                for name in ("dissatisfiedValues", "neutralValues"):
                    if name in scoring:
                        group = {answer_key(v) for v in scoring[name]}
                        if not group <= valid or any(group & previous for previous in groups):
                            raise ValueError()
                        groups.append(group)
                if optional <= set(scoring) and set().union(*groups) != valid:
                    raise ValueError()
            result[sid] = SurveyRules(frozenset(ids), satisfaction,
                                     frozenset(t.strip().casefold() for t in excluded))
        return result
    except (ValueError, TypeError, KeyError):
        raise ConfigurationError("Invalid Sentiment Pulse question configuration") from None


def load_config():
    path = os.getenv("HEALTHPH_SENTIMENT_QUESTIONS_FILE")
    if not path:
        return {}
    try:
        with open(path, encoding="utf-8") as stream:
            return parse_config(json.load(stream))
    except (OSError, ValueError):
        raise ConfigurationError("Cannot load Sentiment Pulse question configuration") from None


def rules_for_survey(survey, fallback):
    config = survey.get("sentimentPulseConfig")
    if config is not None:
        return parse_config({"surveys": {survey["id"]: config}})[survey["id"]]
    if survey["id"] in fallback:
        return fallback[survey["id"]]
    # The owner approved text/choice inference and a specific 1–5 rating rule.
    # Derive IDs from actual survey definitions; no title/keyword guessing.
    inference_ids = set()
    satisfaction = {}
    for question in survey.get("questions") or []:
        if not isinstance(question, dict):
            continue
        qid = question.get("name") or question.get("id")
        if not isinstance(qid, str) or not qid:
            continue
        kind = question.get("type")
        if kind in {"text", "multipleChoice"}:
            inference_ids.add(qid)
        if kind == "rating":
            low, high = question.get("rateMin", 1), question.get("rateMax", 5)
            if type(low) in (int, float) and type(high) in (int, float) and low == 1 and high == 5:
                satisfaction[qid] = {"validValues": [1, 2, 3, 4, 5], "satisfiedValues": [4, 5],
                                     "dissatisfiedValues": [1, 2], "neutralValues": [3]}
    return SurveyRules(frozenset(inference_ids), satisfaction)


def validate_survey_rules(survey, rules):
    questions = {q.get("name") or q.get("id"): q for q in survey.get("questions", []) if isinstance(q, dict)}
    for qid in rules.explanations:
        if questions.get(qid, {}).get("type") not in {"text", "multipleChoice"}:
            raise ConfigurationError("Inference IDs must identify existing text/choice answer keys")
    for qid in rules.satisfaction:
        if questions.get(qid, {}).get("type") not in {"rating", "multipleChoice"}:
            raise ConfigurationError("Satisfaction IDs must identify existing rating/choice answer keys")


def eligible_text(entry, rules):
    text, raw = entry.get("text"), entry.get("raw_answer")
    kind = entry.get("question_type")
    if (entry.get("question_id") not in rules.explanations or kind not in {"text", "multipleChoice"}
            or not isinstance(text, str) or not text.strip() or len(text) > 10000):
        return False
    if kind == "multipleChoice":
        # Choice values have already been converted to text by the existing
        # staging builder. Verify that representation without changing the input.
        if answer_key(raw) is None or text != str(raw).strip():
            return False
        return text.strip().casefold() not in rules.excluded_texts
    if not isinstance(raw, str) or text != raw.strip():
        return False
    normalized = text.strip().casefold()
    # Contextless placeholders and ratings remain ineligible even if misconfigured.
    if normalized in {"n/a", "na", "none", "null", "nil", "-", "--", "...", "no comment",
                      "yes", "no", "ok", "okay", "satisfied", "dissatisfied", "not satisfied", *rules.excluded_texts}:
        return False
    if not any(c.isalpha() for c in text):
        return False
    return True
