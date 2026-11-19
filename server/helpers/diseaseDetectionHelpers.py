import math
import os

import httpx

DEFAULT_DISEASE_SERVICE_URL = "http://127.0.0.1:8002"
DEFAULT_DISEASE_TIMEOUT_SECONDS = 30.0
DISEASE_BATCH_SIZE = 32

DISEASE_LABELS = {"AURI", "PN", "TB", "COVID"}

class DiseaseDetectionServiceError(RuntimeError):
    """Raised when disease detection cannot return a valid result."""

def _get_service_url():
    return os.getenv(
        "HEALTHPH_DISEASE_URL",
        DEFAULT_DISEASE_SERVICE_URL,
    ).rstrip("/")

def _get_timeout_seconds():
    raw_timeout = os.getenv(
        "HEALTHPH_DISEASE_TIMEOUT_SECONDS",
        str(DEFAULT_DISEASE_TIMEOUT_SECONDS),
    )

    try:
        timeout = float(raw_timeout)
    except ValueError as error:
        raise DiseaseDetectionServiceError(
            "HEALTHPH_DISEASE_TIMEOUT_SECONDS must be a number."
        ) from error

    if timeout <= 0:
        raise DiseaseDetectionServiceError(
            "HEALTHPH_DISEASE_TIMEOUT_SECONDS must be greater than zero."
        )

    return timeout


def _validate_scores(scores, field_name):
    if not isinstance(scores, dict) or set(scores) != DISEASE_LABELS:
        raise DiseaseDetectionServiceError(
            f"Disease service returned invalid {field_name}."
        )

    validated = {}

    for label in DISEASE_LABELS:
        value = scores.get(label)

        if (
            type(value) not in (int, float)
            or not math.isfinite(value)
            or not 0 <= value <= 1
        ):
            raise DiseaseDetectionServiceError(
                f"Disease service returned an invalid score for {label}."
            )

        validated[label] = float(value)

    return validated

def _validate_symptoms(symptoms, text):
    if not isinstance(symptoms, list):
        raise DiseaseDetectionServiceError(
            "Disease service returned invalid symptoms."
        )

    validated = []
    previous_end = 0

    for symptom in symptoms:
        if not isinstance(symptom, dict):
            raise DiseaseDetectionServiceError(
                "Disease service returned an invalid symptom."
            )

        mention = symptom.get("text")
        normalized = symptom.get("normalized_symptom")
        start = symptom.get("start_index")
        end = symptom.get("end_index")
        confidence = symptom.get("confidence")
        negated = symptom.get("negated")

        if (
            not isinstance(mention, str)
            or not mention.strip()
            or type(start) is not int
            or type(end) is not int
            or not previous_end <= start < end <= len(text)
            or text[start:end] != mention
            or (
                normalized is not None
                and (
                    not isinstance(normalized, str)
                    or not normalized.strip()
                )
            )
            or type(confidence) not in (int, float)
            or not math.isfinite(confidence)
            or not 0 <= confidence <= 1
            or type(negated) is not bool
        ):
            raise DiseaseDetectionServiceError(
                "Disease service returned invalid symptom details or offsets."
            )

        validated.append({
            "text": mention,
            "normalized_symptom": normalized,
            "start_index": start,
            "end_index": end,
            "confidence": float(confidence),
            "negated": negated,
        })

        previous_end = end

    return validated

def _validate_prediction(prediction, text):
    if not isinstance(prediction, dict):
        raise DiseaseDetectionServiceError(
            "Disease service returned an invalid prediction."
        )

    labels = prediction.get("labels")
    model_version = prediction.get("model_version")

    symptom_model_version = prediction.get("symptom_model_version")

    if (
        not isinstance(symptom_model_version, str)
        or not symptom_model_version.strip()
    ):
        raise DiseaseDetectionServiceError(
            "Disease service returned an invalid symptom extractor version."
        )

    if not isinstance(labels, list):
        raise DiseaseDetectionServiceError(
            "Disease service returned invalid disease labels."
        )

    if (
        any(label not in DISEASE_LABELS for label in labels)
        or len(labels) != len(set(labels))
    ):
        raise DiseaseDetectionServiceError(
           "Disease service returned unsupported or duplicate labels." 
        )

    if not isinstance(model_version, str) or not model_version.strip():
        raise DiseaseDetectionServiceError(
            "Disease service returned an invalid model version."
        )

    return {
        "labels": labels,
        "probabilities": _validate_scores(
            prediction.get("probabilities"),
            "probabilities",
        ),
        "thresholds_used": _validate_scores(
            prediction.get("thresholds_used"),
            "thresholds",
        ),
        "model_version": model_version,
        "symptoms": _validate_symptoms(
            prediction.get("symptoms"),
            text,
        ),
        "symptom_model_version": symptom_model_version,
    }

def detect_diseases(texts):
    if not isinstance(texts, list):
        raise TypeError("texts must be a list")

    if not texts:
        return []

    predictions = []
    service_url = _get_service_url()
    timeout = _get_timeout_seconds()

    try:
        with httpx.Client(
            base_url=service_url,
            timeout=timeout,
        ) as client:
            for start in range(0, len(texts), DISEASE_BATCH_SIZE):
                batch = texts[start:start + DISEASE_BATCH_SIZE]

                response = client.post(
                    "/v1/disease/predict-batch",
                    json={"texts": batch},
                )
                response.raise_for_status()

                payload = response.json()
                batch_predictions = payload.get("results")

                if not isinstance(batch_predictions, list):
                    raise DiseaseDetectionServiceError(
                        "Disease service response is missing results."
                    )

                if len(batch_predictions) != len(batch):
                    raise DiseaseDetectionServiceError(
                        "Disease service returned an incomplete batch."
                    )

                predictions.extend(
                    _validate_prediction(prediction, text)
                    for prediction, text in zip(
                        batch_predictions,
                        batch,
                        strict=True,
                    )
                )

    except httpx.TimeoutException as error:
        raise DiseaseDetectionServiceError(
            "Disease detection service timed out."
        ) from error
    except httpx.HTTPStatusError as error:
        raise DiseaseDetectionServiceError(
            "Disease detection service rejected the request "
            f"with status {error.response.status_code}."
        ) from error
    except httpx.RequestError as error:
        raise DiseaseDetectionServiceError(
            "Disease detection service is unavailable."
        ) from error
    except ValueError as error:
        raise DiseaseDetectionServiceError(
            "Disease detection service returned invalid JSON."
        ) from error

    return predictions