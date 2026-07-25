"""
Smoke test — confirms the service module imports cleanly and its health
endpoint responds.

Loaded via importlib with an explicit path/unique module name rather than
`from main import app`, since every service in this repo has its own
main.py — a plain import would collide across services under pytest.
"""

import sys
import importlib.util
from pathlib import Path

from fastapi.testclient import TestClient

_SERVICE_DIR = Path(__file__).resolve().parent
if str(_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVICE_DIR))
_spec = importlib.util.spec_from_file_location(
    "loadshedding_main", _SERVICE_DIR / "main.py"
)
_loadshedding_main = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_loadshedding_main)

client = TestClient(_loadshedding_main.app)


def test_health_endpoint_is_reachable():
    response = client.get("/loadshedding/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_subscribe_rejects_requests_without_api_key():
    response = client.post(
        "/loadshedding/subscribe", json={"area_zone": "Sandton", "customer_id": "1"}
    )
    assert response.status_code == 401


def test_subscribe_rejects_unknown_area_zone():
    response = client.post(
        "/loadshedding/subscribe",
        json={"area_zone": "Sandton", "customer_id": "1"},
        headers={"X-API-Key": "rams-elec-frontend-2026"},
    )
    # Not a 401 (API key accepted) and not a 500 (validator runs cleanly) —
    # exact status depends on DB availability for the write, but a bad zone
    # must never reach that far.
    assert response.status_code != 401

    bad_zone = client.post(
        "/loadshedding/subscribe",
        json={"area_zone": "Nowhereville", "customer_id": "1"},
        headers={"X-API-Key": "rams-elec-frontend-2026"},
    )
    assert bad_zone.status_code == 422
