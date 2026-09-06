"""
Rams @Elec — End-to-End Integration Test

Simulates a full customer journey through the platform:
  1. Health-check every service
  2. Classify an inquiry via triage
  3. Get a cost estimate
  4. Get a technician recommendation
  5. Query load-shedding status
  6. Ask the RAG chatbot a question
  7. Get a dispatch recommendation
  8. Score a follow-up comment via sentiment
  9. Verify the frontend is reachable

Requires all services running (docker compose up).
Run: python scripts/integration_test.py
"""

import os
import sys
import json
import time
import httpx
from datetime import datetime

BASE_URLS = {
    "triage": os.getenv("TRIAGE_URL", "http://localhost:8001"),
    "loadshedding": os.getenv("LOADSHEDDING_URL", "http://localhost:8002"),
    "chatbot": os.getenv("CHATBOT_URL", "http://localhost:8003"),
    "dispatch": os.getenv("DISPATCH_URL", "http://localhost:8004"),
    "crew": os.getenv("CREW_URL", "http://localhost:8005"),
    "sentiment": os.getenv("SENTIMENT_URL", "http://localhost:8006"),
    "frontend": os.getenv("FRONTEND_URL", "http://localhost:3000"),
}

API_KEY = os.getenv("INTERNAL_API_KEY", "rams-elec-frontend-2026")
AUTH_HEADERS = {"X-API-Key": API_KEY}

PASS = "✅"
FAIL = "❌"
SKIP = "⏭️"

results = []


def log(step: str, passed: bool, detail: str = ""):
    icon = PASS if passed else FAIL
    results.append({"step": step, "passed": passed, "detail": detail})
    print(f"  {icon} {step}" + (f" — {detail}" if detail else ""))


def test_service_health(name: str, url: str):
    """Test that a service is reachable (health endpoints are unauthenticated)."""
    health_paths = {
        "triage": "/triage/health",
        "loadshedding": "/loadshedding/health",
        "chatbot": "/chatbot/health",
        "dispatch": "/dispatch/health",
        "crew": "/crew/health",
        "sentiment": "/sentiment/health",
        "frontend": "/",
    }
    path = health_paths.get(name, f"/{name}/health")
    try:
        resp = httpx.get(f"{url}{path}", timeout=5)
        passed = resp.status_code == 200
        log(f"{name} health check", passed, f"status={resp.status_code}")
        return passed
    except Exception as e:
        log(f"{name} health check", False, str(e)[:80])
        return False


def test_triage_classify():
    """Test inquiry classification."""
    try:
        resp = httpx.post(
            f"{BASE_URLS['triage']}/triage/classify",
            headers=AUTH_HEADERS,
            json={
                "raw_message": "My cold room is not cooling properly, temperature keeps rising. I have perishable goods inside. Need urgent help in Sandton.",
                "source": "web_form",
                "customer_name": "Test Customer",
                "customer_phone": "+27831234567",
            },
            timeout=15,
        )
        data = resp.json()
        passed = (
            resp.status_code == 200 and "service_category" in data and "urgency" in data
        )
        log(
            "Triage classify",
            passed,
            f"category={data.get('service_category')}, urgency={data.get('urgency')}",
        )
        return data if passed else None
    except Exception as e:
        log("Triage classify", False, str(e)[:80])
        return None


def test_triage_estimate_cost(classification: dict):
    """Test cost estimation."""
    if not classification:
        log("Triage estimate cost", False, "No classification to use")
        return None
    try:
        resp = httpx.post(
            f"{BASE_URLS['triage']}/triage/estimate-cost",
            headers=AUTH_HEADERS,
            json={
                "service_category": classification.get(
                    "service_category", "refrigeration"
                ),
                "urgency": classification.get("urgency", "emergency"),
                "area_zone": classification.get("area_zone", "Sandton"),
                "estimated_scope": classification.get("estimated_scope", ""),
            },
            timeout=10,
        )
        data = resp.json()
        passed = resp.status_code == 200 and "cost_min" in data and "cost_max" in data
        log(
            "Triage estimate cost",
            passed,
            f"R{data.get('cost_min', 0)}–R{data.get('cost_max', 0)}",
        )
        return data if passed else None
    except Exception as e:
        log("Triage estimate cost", False, str(e)[:80])
        return None


def test_triage_assign_technician(classification: dict):
    """Test technician recommendation."""
    if not classification:
        log("Triage assign technician", False, "No classification to use")
        return None
    try:
        resp = httpx.post(
            f"{BASE_URLS['triage']}/triage/assign-technician",
            headers=AUTH_HEADERS,
            json=classification,
            timeout=10,
        )
        data = resp.json()
        passed = resp.status_code == 200 and "recommendations" in data
        count = len(data.get("recommendations", []))
        log("Triage assign technician", passed, f"{count} recommendations")
        return data if passed else None
    except Exception as e:
        log("Triage assign technician", False, str(e)[:80])
        return None


def test_loadshedding_status():
    """Test load-shedding status endpoint."""
    try:
        resp = httpx.get(
            f"{BASE_URLS['loadshedding']}/loadshedding/status/Sandton",
            headers=AUTH_HEADERS,
            timeout=10,
        )
        data = resp.json()
        passed = resp.status_code == 200 and "area_zone" in data
        log(
            "Load-shedding status",
            passed,
            f"stage={data.get('current_stage')}, status={data.get('status')}",
        )
        return passed
    except Exception as e:
        log("Load-shedding status", False, str(e)[:80])
        return False


def test_chatbot_query():
    """Test RAG chatbot."""
    try:
        resp = httpx.post(
            f"{BASE_URLS['chatbot']}/chatbot/query",
            headers=AUTH_HEADERS,
            json={"message": "What is SANS 10142?", "customer_id": None},
            timeout=20,
        )
        data = resp.json()
        passed = resp.status_code == 200 and "reply" in data
        log(
            "Chatbot query",
            passed,
            f"escalate={data.get('escalate_to_human')}, sources={len(data.get('sources', []))}",
        )
        return passed
    except Exception as e:
        log("Chatbot query", False, str(e)[:80])
        return False


def test_dispatch_recommend():
    """Test dispatch recommendation."""
    try:
        resp = httpx.post(
            f"{BASE_URLS['dispatch']}/dispatch/recommend",
            headers=AUTH_HEADERS,
            json={
                "service_category": "refrigeration",
                "urgency": "high",
                "area_zone": "Sandton",
            },
            timeout=10,
        )
        data = resp.json()
        passed = resp.status_code == 200 and "recommendations" in data
        count = len(data.get("recommendations", []))
        log("Dispatch recommend", passed, f"{count} technicians")
        return data if passed else None
    except Exception as e:
        log("Dispatch recommend", False, str(e)[:80])
        return None


def test_sentiment_score():
    """Test sentiment analysis on a follow-up comment."""
    try:
        resp = httpx.post(
            f"{BASE_URLS['sentiment']}/sentiment/score",
            headers=AUTH_HEADERS,
            json={
                "comment": "The technician was very professional and fixed the issue quickly. Very happy with the service.",
            },
            timeout=10,
        )
        data = resp.json()
        passed = resp.status_code == 200 and "sentiment" in data
        log(
            "Sentiment score",
            passed,
            f"sentiment={data.get('sentiment')}, score={data.get('score')}",
        )
        return passed
    except Exception as e:
        log("Sentiment score", False, str(e)[:80])
        return False


def test_frontend_reachable():
    """Test that the frontend returns a 200."""
    try:
        resp = httpx.get(BASE_URLS["frontend"], timeout=5)
        passed = resp.status_code == 200
        log("Frontend reachable", passed, f"status={resp.status_code}")
        return passed
    except Exception as e:
        log("Frontend reachable", False, str(e)[:80])
        return False


def main():
    print("=" * 60)
    print("Rams @Elec — Integration Test")
    print(f"Time: {datetime.now().isoformat()}")
    print("=" * 60)

    # Step 1: Health checks
    print("\n[1] Service Health Checks")
    services_ok = all(
        [
            test_service_health("triage", BASE_URLS["triage"]),
            test_service_health("loadshedding", BASE_URLS["loadshedding"]),
            test_service_health("chatbot", BASE_URLS["chatbot"]),
            test_service_health("dispatch", BASE_URLS["dispatch"]),
            test_service_health("crew", BASE_URLS["crew"]),
            test_service_health("sentiment", BASE_URLS["sentiment"]),
        ]
    )

    if not services_ok:
        print("\n  Some services are not running. Start them with: docker compose up")
        print("  Continuing with available services...\n")

    # Step 2: Full inquiry flow
    print("\n[2] Customer Inquiry Flow")
    classification = test_triage_classify()
    cost_estimate = test_triage_estimate_cost(classification)
    technician_assignment = test_triage_assign_technician(classification)

    # Step 3: Load-shedding
    print("\n[3] Load-Shedding Intelligence")
    test_loadshedding_status()

    # Step 4: Chatbot
    print("\n[4] RAG Chatbot")
    test_chatbot_query()

    # Step 5: Dispatch
    print("\n[5] Smart Dispatch")
    test_dispatch_recommend()

    # Step 6: Sentiment
    print("\n[6] Sentiment Analysis")
    test_sentiment_score()

    # Step 7: Frontend
    print("\n[7] Frontend")
    test_frontend_reachable()

    # Summary
    print("\n" + "=" * 60)
    passed = sum(1 for r in results if r["passed"])
    total = len(results)
    print(f"Results: {passed}/{total} passed")

    if passed == total:
        print("🎉 All tests passed!")
    elif passed >= total * 0.7:
        print("⚠️  Most tests passed. Review failures above.")
    else:
        print("❌ Multiple failures. Check service logs.")

    print("=" * 60)
    return passed == total


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
