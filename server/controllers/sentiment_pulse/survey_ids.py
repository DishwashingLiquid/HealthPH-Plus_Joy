"""Pure survey identifier and SurveyJS name utilities."""

from copy import deepcopy
import re

SURVEY_ID_PATTERN = re.compile(r"^SUR(\d{5,})$")
QUESTION_ID_PATTERN = re.compile(r"^SUR(\d{5,})-Q(\d{2,})$")
ANSWER_ID_PATTERN = re.compile(r"^SUR(\d{5,})-Q(\d{2,})-RES(\d{4,})$")
HISTORIC_SURVEY_ID_PATTERN = re.compile(r"^SUR-(\d+)$")
HISTORIC_QUESTION_ID_PATTERN = re.compile(r"^Q-SUR(\d+)-(\d+)$")


def format_survey_id(sequence: int) -> str:
    return f"SUR{sequence:05d}"


def format_question_id(survey_sequence: int, sequence: int) -> str:
    return f"{format_survey_id(survey_sequence)}-Q{sequence:02d}"


def format_answer_id(question_id: str, sequence: int) -> str:
    return f"{question_id}-RES{sequence:04d}"


def sync_survey_json_names(survey_json: dict, id_mapping: dict[str, str]) -> dict:
    normalized = deepcopy(survey_json or {})

    def visit(value):
        if isinstance(value, dict):
            if isinstance(value.get("name"), str) and value["name"] in id_mapping:
                value["name"] = id_mapping[value["name"]]
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(normalized)
    return normalized
