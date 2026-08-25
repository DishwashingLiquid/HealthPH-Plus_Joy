from collections import Counter


def calculate_percentage(count: int, total: int) -> int:
    if total == 0:
        return 0

    return round((count / total) * 100)


def normalize_answer_value(value) -> str:
    return str(value).strip()


def is_empty_answer(value) -> bool:
    if value is None:
        return True

    if isinstance(value, str):
        return value.strip() == ""

    if isinstance(value, list):
        return len(value) == 0

    return False


def get_question_label(question: dict, index: int) -> str:
    title = str(question.get("title") or "").strip()
    return title or f"Question {index + 1}"


def get_question_result_type(question: dict) -> str:
    question_type = str(question.get("type") or "").strip()

    if question_type == "multipleChoice":
        return "multipleChoice"

    if question_type == "rating":
        return "rating"

    return "text"


def get_choice_labels(question: dict) -> list[str]:
    choices = question.get("choices") or []

    return [
        normalize_answer_value(choice)
        for choice in choices
        if normalize_answer_value(choice)
    ]


def get_rating_labels(question: dict) -> list[str]:
    rate_min = int(question.get("rateMin") or 1)
    rate_max = int(question.get("rateMax") or 5)
    start = min(rate_min, rate_max)
    end = max(rate_min, rate_max)

    return [str(value) for value in range(start, end + 1)]


def build_choice_or_rating_rows(
    configured_labels: list[str],
    answer_counts: Counter,
    answered_count: int,
) -> list[dict]:
    rows = [
        {
            "label": label,
            "count": answer_counts[label],
            "percentage": calculate_percentage(answer_counts[label], answered_count),
        }
        for label in configured_labels
    ]
    configured_set = set(configured_labels)
    unknown_count = sum(
        count for label, count in answer_counts.items() if label not in configured_set
    )

    if unknown_count > 0:
        rows.append(
            {
                "label": "Other / Removed option",
                "count": unknown_count,
                "percentage": calculate_percentage(unknown_count, answered_count),
            }
        )

    return rows


def build_question_results(question: dict, index: int, responses: list[dict]) -> dict:
    question_id = question.get("id")
    result_type = get_question_result_type(question)
    answer_counts = Counter()
    answered_count = 0

    for response in responses:
        answers = response.get("answers") or {}

        if question_id not in answers:
            continue

        answer_value = answers.get(question_id)

        if is_empty_answer(answer_value):
            continue

        answered_count += 1

        if result_type == "text":
            answer_counts.update(["Non-empty text response"])
            continue

        if isinstance(answer_value, list):
            answer_counts.update(
                normalize_answer_value(value)
                for value in answer_value
                if not is_empty_answer(value)
            )
            continue

        answer_counts.update([normalize_answer_value(answer_value)])

    if result_type == "multipleChoice":
        rows = build_choice_or_rating_rows(
            get_choice_labels(question),
            answer_counts,
            answered_count,
        )
    elif result_type == "rating":
        rows = build_choice_or_rating_rows(
            get_rating_labels(question),
            answer_counts,
            answered_count,
        )
    else:
        text_count = answer_counts["Non-empty text response"]
        rows = [
            {
                "label": "Non-empty text responses",
                "count": text_count,
                "percentage": calculate_percentage(text_count, answered_count),
            }
        ]

    return {
        "id": question_id,
        "title": get_question_label(question, index),
        "type": result_type,
        "answeredResponses": answered_count,
        "rows": rows,
    }
