"""
Smoke + security tests for the sentiment service.

Loaded via importlib with an explicit path/unique module name rather than
`from main import app`, since every service in this repo has its own
main.py — a plain import would collide across services under pytest. The
service directory goes on sys.path first so main.py's sibling imports
resolve exactly as they would under a real `uvicorn main:app` run.

These tests deliberately require neither a GROQ_API_KEY nor network access:
the service is built to degrade to a neutral, `analyzed=False` result when
Groq is unavailable, which is precisely the state CI runs in.
"""

import sys
import importlib.util
from pathlib import Path

from fastapi.testclient import TestClient

_SERVICE_DIR = Path(__file__).resolve().parent
if str(_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVICE_DIR))
_spec = importlib.util.spec_from_file_location(
    "sentiment_main", _SERVICE_DIR / "main.py"
)
_sentiment_main = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_sentiment_main)

client = TestClient(_sentiment_main.app)

API_KEY_HEADER = {"X-API-Key": "rams-elec-frontend-2026"}


def test_health_endpoint_is_reachable_without_api_key():
    response = client.get("/sentiment/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    # The taxonomy is part of the contract n8n and the dashboard rely on.
    assert "professionalism" in body["valid_themes"]


def test_analyze_rejects_requests_without_api_key():
    response = client.post(
        "/sentiment/analyze", json={"comment_text": "Great service, very tidy"}
    )
    assert response.status_code == 401


def test_analyze_rejects_unexpected_fields():
    """extra='forbid' — an unknown field must not be silently ignored."""
    response = client.post(
        "/sentiment/analyze",
        json={"comment_text": "Fine", "injected_field": "x"},
        headers=API_KEY_HEADER,
    )
    assert response.status_code == 422


def test_analyze_degrades_to_neutral_without_groq():
    """A missing/failed Groq client must not 500 the follow-up conversation."""
    response = client.post(
        "/sentiment/analyze",
        json={"comment_text": "The technician was very professional"},
        headers=API_KEY_HEADER,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["sentiment_score"] == 0.0
    assert body["sentiment_themes"] == []
    # Callers must be able to tell a real 0.0 from a fallback 0.0.
    assert body["analyzed"] is False


def test_score_is_clamped_to_valid_range():
    """The model can return anything; the score must stay in [-1.0, 1.0]."""
    coerce = _sentiment_main._coerce_score
    assert coerce(5.0) == 1.0
    assert coerce(-5.0) == -1.0
    assert coerce(0.42) == 0.42
    assert coerce("not a number") == 0.0
    assert coerce(None) == 0.0


def test_themes_outside_taxonomy_are_discarded():
    """A hallucinated theme is not evidence of that theme — drop it."""
    coerce = _sentiment_main._coerce_themes
    assert coerce(["professionalism", "made_up_theme"]) == ["professionalism"]
    assert coerce(["PRICING", "pricing"]) == ["pricing"]  # normalised, de-duped
    assert coerce("not a list") == []
    assert coerce([1, 2, 3]) == []
    assert coerce([]) == []
