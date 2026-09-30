import math
import os

import httpx

DEFAULT_LANGUAGE_SERVICE_URL = "http://127.0.0.1:8001"
DEFAULT_LANGUAGE_TIMEOUT_SECONDS = 30.0
LANGUAGE_BATCH_SIZE = 32

SUPPORTED_LANGUAGE_CODES = {"en", "fil", "ceb", "ilo", "hil"}

class LanguageDetectionServiceError(RuntimeError):
    """Raised when language detection cannot return a valid result."""

def _get_service_url():
    return os.getenv(
        "HEALTHPH_LANGUAGE_URL",
        DEFAULT_LANGUAGE_SERVICE_URL,
    ).rstrip("/")

def _get_timeout_seconds():
    raw_timeout = os.getenv(
        "HEALTHPH_LANGUAGE_TIMEOUT_SECONDS",
        str(DEFAULT_LANGUAGE_TIMEOUT_SECONDS),
    )

    try:
        timeout = float(raw_timeout)
    except ValueError as error:
        raise LanguageDetectionServiceError(
            "HEALTHPH_LANGUAGE_TIMEOUT_SECONDS must be a number."
        ) from error

    if timeout <= 0:
        raise LanguageDetectionServiceError(
            "HEALTHPH_LANGUAGE_TIMEOUT_SECONDS must be greater than zero."
        )

    return timeout

def _validate_prediction(prediction):
    if not isinstance(prediction, dict):
        raise LanguageDetectionServiceError(
            "Language service returned an invalid prediction."
        )

    language = prediction.get("language")
    source = prediction.get("prediction_source")
    confidence = prediction.get("fasttext_confidence")
    is_supported = prediction.get("is_supported")

    if not isinstance(language, str) or not language.strip():
        raise LanguageDetectionServiceError(
            "Language service returned a prediction without a language."
        )

    if not isinstance(is_supported, bool):
        raise LanguageDetectionServiceError(
            "Language service returned an invalid supported-language flag."
        )

    if is_supported and language not in SUPPORTED_LANGUAGE_CODES:
        raise LanguageDetectionServiceError(
            "Language service marked an unsupported language as supported."
        )

    if source not in {"fasttext", "keyword_override"}:
        raise LanguageDetectionServiceError(
            "Language service returned an invalid prediction source."
        )

    if not isinstance(confidence, (int, float)) or not math.isfinite(confidence):
        raise LanguageDetectionServiceError(
            "Language service returned an invalid confidence score."
        )

    if not 0 <= confidence <= 1:
        raise LanguageDetectionServiceError(
            "Language confidence must be between zero and one."
        )

    return {
        "language": language,
        "is_supported": is_supported,
        "detection_source": source,
        # keyword overrides do not provide confidence for the final language.
        "confidence": confidence if source == "fasttext" else None,
    }

def detect_languages(texts):
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
            for start in range(0, len(texts), LANGUAGE_BATCH_SIZE):
                batch = texts[start:start + LANGUAGE_BATCH_SIZE]

                response = client.post(
                    "/v1/language/predict-batch",
                    json={"texts": batch},
                )
                response.raise_for_status()

                payload = response.json()
                batch_predictions = payload.get("results")

                if not isinstance(batch_predictions, list):
                    raise LanguageDetectionServiceError(
                        "Language service response is missing results."
                    )

                if len(batch_predictions) != len(batch):
                    raise LanguageDetectionServiceError(
                        "Language service returned an incomplete batch."
                    )

                predictions.extend(
                    _validate_prediction(prediction)
                    for prediction in batch_predictions
                )

    except httpx.TimeoutException as error:
        raise LanguageDetectionServiceError(
            "Language detection service timed out."
        ) from error
    except httpx.HTTPStatusError as error:
        raise LanguageDetectionServiceError(
            "Language detection service rejected the request "
            f"with status {error.response.status_code}."
        ) from error
    except httpx.RequestError as error:
        raise LanguageDetectionServiceError(
            "Language detection service is unavailable."
        ) from error
    except ValueError as error:
        raise LanguageDetectionServiceError(
            "Language detection service returned invalid JSON."
        ) from error

    return predictions