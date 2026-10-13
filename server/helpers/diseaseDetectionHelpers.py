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

def _validate_prediction(prediction):
    if not isinstance(prediction, dict):
        raise DiseaseDetectionServiceError(
            "Disease service returned an invalid prediction."
        )

    labels = prediction.get("labels")
    model_version = prediction.get("model_version")

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
                    _validate_prediction(prediction)
                    for prediction in batch_predictions
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