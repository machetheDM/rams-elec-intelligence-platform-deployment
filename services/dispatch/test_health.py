"""
Smoke test — confirms the service module imports cleanly (including the
security/ middleware wired in per Module 2) and its health endpoint responds.

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
_spec = importlib.util.spec_from_file_location("dispatch_main", _SERVICE_DIR / "main.py")
_dispatch_main = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_dispatch_main)

client = TestClient(_dispatch_main.app)


def test_health_endpoint_is_reachable_without_api_key():
    response = client.get("/dispatch/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_recommend_rejects_requests_without_api_key():
    response = client.post(
        "/dispatch/recommend",
        json={"service_category": "electrical", "urgency": "medium", "area_zone": "Sandton"},
    )
    assert response.status_code == 401
