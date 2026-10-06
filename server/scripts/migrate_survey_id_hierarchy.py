"""Migrate survey identifiers. Dry run by default; stop survey writers for --apply.

The plan is computed and validated before any write. Re-running after an
interrupted apply uses legacyId/legacyName/legacyAnswerKeys to finish links.
"""

import argparse
from collections import defaultdict
from copy import deepcopy
from datetime import datetime
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from controllers.sentiment_pulse.survey_ids import (  # noqa: E402
    ANSWER_ID_PATTERN,
    HISTORIC_QUESTION_ID_PATTERN,
    HISTORIC_SURVEY_ID_PATTERN,
    QUESTION_ID_PATTERN,
    SURVEY_ID_PATTERN,
    sync_survey_json_names,
    format_answer_id,
    format_question_id,
    format_survey_id,
)


def _order(document):
    value = document.get("createdAt") or document.get("created_at")
    return (str(value or datetime.min), str(document["_id"]))


def _number(value, pattern):
    match = pattern.fullmatch(str(value or ""))
    return int(match.group(1)) if match else 0


def _claim(preferred, used, next_number):
    if preferred and preferred not in used:
        used.add(preferred)
        return preferred, max(next_number, preferred + 1)
    while next_number in used:
        next_number += 1
    used.add(next_number)
    return next_number, next_number + 1


def make_plan(surveys, responses, entries, settings=None):
    """Return replacement documents and next counters, without touching MongoDB."""
    surveys = sorted(deepcopy(surveys), key=_order)
    responses = sorted(deepcopy(responses), key=_order)
    entries = deepcopy(entries)
    by_survey = defaultdict(list)
    for response in responses:
        by_survey[str(response.get("surveyId"))].append(response)

    used_surveys = {_number(s.get("id"), SURVEY_ID_PATTERN) for s in surveys}
    used_surveys.discard(0)
    sequence = max(1, int((settings or {}).get("nextSentimentPulseSurveyDisplaySequence") or 1))
    survey_aliases = {}
    question_aliases = {}
    planned_surveys = []

    for survey in surveys:
        old_survey_id = str(survey["id"])
        current = _number(old_survey_id, SURVEY_ID_PATTERN)
        if current:
            survey_number = current
        else:
            preferred = (_number(survey.get("displayId"), HISTORIC_SURVEY_ID_PATTERN)
                         or _number(old_survey_id, HISTORIC_SURVEY_ID_PATTERN)
                         or int(survey.get("displaySequence") or 0))
            survey_number, sequence = _claim(preferred, used_surveys, sequence)
            survey["legacyId"] = old_survey_id
        survey_id = format_survey_id(survey_number)
        survey_aliases[old_survey_id] = survey_id
        if survey.get("legacyId"):
            survey_aliases[str(survey["legacyId"])] = survey_id

        used_questions = set()
        for question in survey.get("questions") or []:
            match = QUESTION_ID_PATTERN.fullmatch(str(question.get("id") or ""))
            if match and int(match.group(1)) == survey_number:
                used_questions.add(int(match.group(2)))
        for question in survey.get("archivedQuestions") or []:
            match = QUESTION_ID_PATTERN.fullmatch(str(question.get("id") or ""))
            if match and int(match.group(1)) == survey_number:
                used_questions.add(int(match.group(2)))
        next_question = max(1, int(survey.get("nextQuestionIdSequence") or 1),
                            int(survey.get("nextQuestionDisplaySequence") or 1))
        aliases = {}
        seen_question_ids = set()
        for question in survey.get("questions") or []:
            old_id = str(question.get("id") or "")
            old_name = str(question.get("name") or old_id)
            if not old_id or old_id in seen_question_ids:
                raise ValueError(f"Ambiguous question IDs in survey {old_survey_id}")
            seen_question_ids.add(old_id)
            match = QUESTION_ID_PATTERN.fullmatch(old_id)
            if match and int(match.group(1)) == survey_number:
                number = int(match.group(2))
            else:
                historic = HISTORIC_QUESTION_ID_PATTERN.fullmatch(str(question.get("displayId") or old_id))
                preferred = int(historic.group(2)) if historic and int(historic.group(1)) == survey_number else 0
                number, next_question = _claim(preferred, used_questions, next_question)
                question["legacyId"] = old_id
                if old_name != old_id:
                    question["legacyName"] = old_name
            new_id = format_question_id(survey_number, number)
            question["id"] = question["name"] = new_id
            for alias in (old_id, old_name, question.get("legacyId"), question.get("legacyName"), new_id):
                if alias:
                    if alias in aliases and aliases[alias] != new_id:
                        raise ValueError(f"Question alias collision in survey {old_survey_id}: {alias}")
                    aliases[alias] = new_id

        archived = survey.get("archivedQuestions") or []
        for question in archived:
            for alias in (question["id"], question.get("legacyKey")):
                if alias:
                    aliases[alias] = question["id"]
        # Historic submissions may contain answers to questions later removed
        # from the current survey. Keep a stable, explicit link for each one.
        related_responses = (by_survey.get(old_survey_id, []) +
                             by_survey.get(survey_id, []) if old_survey_id != survey_id
                             else by_survey.get(survey_id, []))
        unknown_keys = sorted({str(key) for response in related_responses
                               for key in (response.get("answers") or {}) if key not in aliases})
        for key in unknown_keys:
            number, next_question = _claim(0, used_questions, next_question)
            question_id = format_question_id(survey_number, number)
            archived.append({"id": question_id, "legacyKey": key})
            aliases[key] = question_id
        survey["archivedQuestions"] = archived
        survey["id"] = survey_id
        survey["surveyJson"] = sync_survey_json_names(survey.get("surveyJson") or {}, aliases)
        survey["nextQuestionIdSequence"] = max(next_question,
                                                 max(used_questions, default=0) + 1)
        question_aliases[survey_id] = aliases
        planned_surveys.append(survey)

    if len({s["id"] for s in planned_surveys}) != len(planned_surveys):
        raise ValueError("Survey ID collision")
    used_answers = defaultdict(set)
    seen_answer_ids = set()
    for response in responses:
        for value in (response.get("answerIds") or {}).values():
            if value in seen_answer_ids:
                raise ValueError(f"Duplicate stored answer ID: {value}")
            seen_answer_ids.add(value)
            match = ANSWER_ID_PATTERN.fullmatch(str(value))
            if not match:
                raise ValueError(f"Invalid stored answer ID: {value}")
            used_answers[str(value).rsplit("-RES", 1)[0]].add(int(match.group(3)))
    answer_next = defaultdict(lambda: 1)
    for survey in planned_surveys:
        for question_id, last_reserved in (survey.get("nextAnswerIdSequences") or {}).items():
            answer_next[question_id] = max(answer_next[question_id], int(last_reserved) + 1)
    for question_id, numbers in used_answers.items():
        answer_next[question_id] = max(answer_next[question_id], max(numbers) + 1)
    response_lookup = {}
    planned_responses = []
    for response in responses:
        old_survey_id = str(response.get("surveyId") or "")
        if old_survey_id not in survey_aliases:
            raise ValueError(f"Response {response['_id']} refers to a missing survey {old_survey_id}")
        survey_id = survey_aliases[old_survey_id]
        aliases = question_aliases[survey_id]
        old_answers = response.get("answers") or {}
        old_ids = response.get("answerIds") or {}
        new_answers, new_ids, legacy_keys = {}, {}, dict(response.get("legacyAnswerKeys") or {})
        for old_key, value in old_answers.items():
            question_id = aliases.get(old_key)
            if not question_id or question_id in new_answers:
                raise ValueError(f"Ambiguous answer key in submission {response['_id']}: {old_key}")
            new_answers[question_id] = value
            if old_key != question_id:
                legacy_keys[question_id] = old_key
            existing = old_ids.get(old_key) or old_ids.get(question_id)
            if existing:
                if not ANSWER_ID_PATTERN.fullmatch(existing) or not existing.startswith(question_id + "-RES"):
                    raise ValueError(f"Invalid existing answer ID: {existing}")
                answer_id = existing
            else:
                number, answer_next[question_id] = _claim(0, used_answers[question_id], answer_next[question_id])
                answer_id = format_answer_id(question_id, number)
            new_ids[question_id] = answer_id
        old_submission = str(response.get("id") or response.get("submissionId") or response["_id"])
        response["legacySubmissionId"] = response.get("legacySubmissionId") or old_submission
        response["submissionId"] = str(response.get("submissionId") or old_submission)
        response.pop("id", None)
        response["surveyId"] = survey_id
        response["answers"] = new_answers
        response["answerIds"] = new_ids
        response["legacyAnswerKeys"] = legacy_keys
        for question_id, answer_id in new_ids.items():
            old_key = legacy_keys.get(question_id, question_id)
            for submission_alias in (old_submission, str(response["_id"]), str(response["legacySubmissionId"])):
                response_lookup[(submission_alias, old_key)] = (survey_id, question_id, answer_id, response["submissionId"])
                response_lookup[(submission_alias, question_id)] = (survey_id, question_id, answer_id, response["submissionId"])
            response_lookup[(answer_id, question_id)] = (survey_id, question_id, answer_id, response["submissionId"])
        planned_responses.append(response)

    for survey in planned_surveys:
        counters = dict(survey.get("nextAnswerIdSequences") or {})
        for question_id, numbers in used_answers.items():
            if question_id.startswith(survey["id"] + "-Q"):
                counters[question_id] = max(int(counters.get(question_id) or 0),
                                            answer_next[question_id] - 1, max(numbers, default=0))
        survey["nextAnswerIdSequences"] = counters

    planned_entries = []
    for entry in entries:
        if entry.get("source_type") not in ("survey", "survey_response"):
            continue
        old_survey_id = str(entry.get("survey_id") or "")
        old_response = str(entry.get("response_id") or "")
        old_question = str(entry.get("question_id") or (entry.get("metadata") or {}).get("question_id") or "")
        if not old_question and ":" in str(entry.get("source_id") or ""):
            old_response, old_question = str(entry["source_id"]).rsplit(":", 1)
        link = response_lookup.get((old_response, old_question))
        if not link:
            raise ValueError(f"Survey analytics {entry['_id']} has no matching saved answer")
        survey_id, question_id, answer_id, submission_id = link
        if old_survey_id and survey_aliases.get(old_survey_id) != survey_id:
            raise ValueError(f"Survey analytics {entry['_id']} has a conflicting survey ID")
        entry["survey_id"] = survey_id
        entry["question_id"] = question_id
        entry["response_id"] = entry["source_id"] = answer_id
        entry["submission_id"] = submission_id
        if isinstance(entry.get("metadata"), dict) and "question_id" in entry["metadata"]:
            entry["metadata"]["question_id"] = question_id
        planned_entries.append(entry)

    next_survey = max(sequence, max(used_surveys, default=0) + 1)
    return planned_surveys, planned_responses, planned_entries, next_survey


def run(db, apply=False):
    settings = db.application_settings.find_one({"_id": "sentiment_pulse_display_sequences"})
    surveys, responses, entries, next_survey = make_plan(
        list(db.surveys.find()), list(db.survey_responses.find()),
        list(db.analytics_entries.find({"source_type": {"$in": ["survey", "survey_response"]}})), settings)
    report = {"surveys": len(surveys), "submissions": len(responses),
              "answers": sum(len(r["answers"]) for r in responses),
              "analyticsEntries": len(entries), "nextSurveySequence": next_survey}
    if apply:
        for collection, documents in ((db.surveys, surveys), (db.survey_responses, responses),
                                      (db.analytics_entries, entries)):
            for document in documents:
                collection.replace_one({"_id": document["_id"]}, document)
        db.application_settings.update_one(
            {"_id": "sentiment_pulse_display_sequences"},
            {"$max": {"nextSentimentPulseSurveyDisplaySequence": next_survey}}, upsert=True)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--writers-paused", action="store_true")
    parser.add_argument("--database", required=True)
    args = parser.parse_args()
    if args.apply and not args.writers_paused:
        parser.error("--apply requires --writers-paused and a database backup")
    from pymongo import MongoClient
    uri = os.environ.get("MONGO_URI")
    if not uri:
        parser.error("Set MONGO_URI")
    db = MongoClient(uri)[args.database]
    print(run(db, apply=args.apply))


if __name__ == "__main__":
    main()
