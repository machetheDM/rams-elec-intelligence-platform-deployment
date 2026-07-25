"""
Smoke test — confirms the service module imports cleanly (including the
security/ middleware wired in per Module 2) and its health endpoint responds.

Loaded via importlib with an explicit path/unique module name rather than
`from main import app`, since every service in this repo has its own
main.py — a plain import would collide across services under pytest. The
service directory is put on sys.path first so main.py's own sibling
imports (e.g. `from feature_encoding import ...`) resolve exactly as they
would under a real `uvicorn main:app` run from inside services/triage/.
"""

import sys
import importlib.util
from pathlib import Path

from fastapi.testclient import TestClient

_SERVICE_DIR = Path(__file__).resolve().parent
if str(_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVICE_DIR))
_spec = importlib.util.spec_from_file_location("triage_main", _SERVICE_DIR / "main.py")
_triage_main = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_triage_main)

client = TestClient(_triage_main.app)


def test_health_endpoint_is_reachable_without_api_key():
    response = client.get("/triage/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"


def test_classify_rejects_requests_without_api_key():
    response = client.post(
        "/triage/classify", json={"raw_message": "no power in my house"}
    )
    assert response.status_code == 401


def test_model_metrics_requires_api_key():
    # Same service-to-service gate as every other triage endpoint — the
    # frontend's server-side /api/model-metrics route holds the key
    # (frontend/src/app/api/model-metrics/route.ts), the browser never does.
    unauthenticated = client.get("/triage/model-metrics")
    assert unauthenticated.status_code == 401

    response = client.get(
        "/triage/model-metrics", headers={"X-API-Key": "rams-elec-frontend-2026"}
    )
    assert response.status_code == 200
    body = response.json()
    assert "trained" in body
    if body["trained"]:
        assert body["mae"] is not None
        assert body["data_source"] is not None
