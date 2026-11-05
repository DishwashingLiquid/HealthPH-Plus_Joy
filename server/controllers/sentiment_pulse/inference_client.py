"""Private HTTP boundary. No model/runtime imports in the application backend."""

import math
import os
import re
from urllib.parse import urlsplit

import httpx

VERSION = re.compile(r"sha256:[0-9a-f]{64}\Z")
BATCH_SIZE = 32


class SentimentServiceError(RuntimeError):
    pass


def valid_version(value):
    return isinstance(value, str) and VERSION.fullmatch(value) is not None


def probability(value):
    return type(value) in (int, float) and math.isfinite(value) and 0 <= value <= 1


def validate_prediction(row, version):
    if not isinstance(row, dict):
        raise SentimentServiceError("Invalid prediction")
    score, threshold = row.get("worried_probability"), row.get("threshold_used")
    if not probability(score) or not probability(threshold):
        raise SentimentServiceError("Invalid probability or threshold")
    label = int(score >= threshold)
    if (type(row.get("predicted_label")) is not int
            or row["predicted_label"] != label
            or row.get("predicted_label_name") != ("calm", "worried")[label]
            or not valid_version(version) or row.get("model_version") != version):
        raise SentimentServiceError("Inconsistent label or model version")
    return row


class SentimentClient:
    def __init__(self, transport=None):
        url = os.getenv("HEALTHPH_SENTIMENT_URL", "http://127.0.0.1:8002").rstrip("/")
        parts = urlsplit(url)
        if (parts.scheme not in {"http", "https"} or not parts.hostname
                or parts.username or parts.password or parts.query or parts.fragment
                or parts.path):
            raise SentimentServiceError("Configure a private HTTP(S) service origin")
        try:
            timeout = float(os.getenv("HEALTHPH_SENTIMENT_TIMEOUT_SECONDS", "30"))
        except ValueError:
            raise SentimentServiceError("Invalid sentiment timeout") from None
        if not math.isfinite(timeout) or not 0 < timeout <= 120:
            raise SentimentServiceError("Sentiment timeout must be in (0, 120] seconds")
        self.client = httpx.Client(base_url=url, timeout=timeout, trust_env=False,
                                   follow_redirects=False, transport=transport)
        self.version = None
        self.threshold = None

    def close(self):
        self.client.close()

    def _request(self, method, path, **kwargs):
        try:
            response = self.client.request(method, path, **kwargs)
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError):
            # Do not expose response bodies, texts, URLs, or credentials to callers.
            raise SentimentServiceError("Sentiment service unavailable or invalid response") from None
        if not isinstance(payload, dict):
            raise SentimentServiceError("Invalid sentiment response")
        return payload

    def ready(self):
        payload = self._request("GET", "/health/ready")
        if payload.get("status") != "ready" or not valid_version(payload.get("model_version")):
            raise SentimentServiceError("Sentiment model is not ready")
        self.version = payload["model_version"]
        return self.version

    def predict_batch(self, texts):
        if (not isinstance(texts, list) or not 1 <= len(texts) <= BATCH_SIZE
                or any(not isinstance(t, str) or not t.strip() or len(t) > 10000 for t in texts)):
            raise SentimentServiceError("Invalid sentiment input batch")
        if self.version is None:
            self.ready()
        payload = self._request("POST", "/v1/sentiment/predict-batch", json={"texts": texts})
        rows = payload.get("results")
        if not isinstance(rows, list) or len(rows) != len(texts):
            raise SentimentServiceError("Sentiment response count mismatch")
        validated = [validate_prediction(row, self.version) for row in rows]
        thresholds = {row["threshold_used"] for row in validated}
        if len(thresholds) != 1 or (self.threshold is not None and self.threshold not in thresholds):
            raise SentimentServiceError("Sentiment threshold changed during processing")
        self.threshold = next(iter(thresholds))
        # API guarantees positional order; it supplies no echoed text/IDs with
        # which a dishonest server's permutation could be independently detected.
        return validated
