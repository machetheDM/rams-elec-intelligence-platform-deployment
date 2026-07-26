"""
CrewAI Tools — thin HTTP clients over the existing Rams @Elec services
=====================================================================

Each tool wraps an endpoint that already exists, is already hardened, and is
already API-key gated (security/auth/api_key_middleware.py). Nothing here
reimplements business logic — the XGBoost cost model and the technician
scoring SQL stay exactly where they are, in services/triage and
services/dispatch.

WHY HTTP RATHER THAN DIRECT IMPORTS
  services/triage/main.py builds its FastAPI app, applies middleware,
  connects the database and calls load_model() at *import* time, so importing
  its helpers from here would be a circular import and would drag xgboost,
  shap and mlflow into this service. Calling the internal API instead keeps
  this service's dependency tree small and mirrors how production agent
  systems actually wrap internal capabilities.

DETERMINISM
  An LLM agent decides *when* to call these tools and then narrates the
  result — which means it can paraphrase or round a number that was exact.
  Every tool therefore records its untouched response in LAST_TOOL_RESULTS
  so main.py can compare the crew's final answer against ground truth and
  override it if the model drifted. See `verify_cost_against_tool` there.
"""

import json
import logging
import os
import threading
from typing import Any

import httpx
from crewai.tools import tool

logger = logging.getLogger("crew.tools")

TRIAGE_SERVICE_URL = os.getenv("TRIAGE_SERVICE_URL", "http://localhost:8001")
DISPATCH_SERVICE_URL = os.getenv("DISPATCH_SERVICE_URL", "http://localhost:8004")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "rams-elec-frontend-2026")
TOOL_TIMEOUT_SECONDS = float(os.getenv("CREW_TOOL_TIMEOUT", "30"))

# ---------------------------------------------------------------------------
# Ground-truth capture
# ---------------------------------------------------------------------------
# Keyed by tool name. Written by the tools, read by main.py after kickoff().
# Thread-local because FastAPI runs the blocking crew.kickoff() in a
# threadpool — a plain module-level dict would let two concurrent requests
# read each other's tool results.
_local = threading.local()


def reset_tool_results() -> None:
    """Clear captured results. Call before each crew run."""
    _local.results = {}


def get_tool_results() -> dict[str, Any]:
    """Return the raw, unmodified responses captured during this run."""
    return getattr(_local, "results", {})


def _record(tool_name: str, payload: Any) -> None:
    if not hasattr(_local, "results"):
        _local.results = {}
    _local.results[tool_name] = payload


def _post(url: str, body: dict[str, Any]) -> dict[str, Any]:
    """POST to an internal service with the shared API key.

    Never raises to the agent — a downed service returns a structured error
    the LLM can reason about and report, matching the never-raise contract
    the other services use for Groq.
    """
    try:
        response = httpx.post(
            url,
            json=body,
            headers={"X-API-Key": INTERNAL_API_KEY, "Content-Type": "application/json"},
            timeout=TOOL_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as exc:
        logger.warning(f"Tool call to {url} failed: {exc}")
        return {"error": f"Service unreachable: {exc.__class__.__name__}"}

    if response.status_code >= 400:
        logger.warning(f"Tool call to {url} returned HTTP {response.status_code}")
        return {"error": f"Service returned HTTP {response.status_code}"}

    try:
        return response.json()
    except ValueError:
        return {"error": "Service returned a non-JSON response"}


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------


@tool("classify_inquiry")
def classify_inquiry_tool(raw_message: str) -> str:
    """Classify a customer inquiry into service category, urgency, equipment
    mentioned and area zone.

    Use this first, on the customer's raw message. Returns JSON with keys:
    service_category, urgency, equipment_mentioned, area_zone,
    estimated_scope, confidence.

    Args:
        raw_message: The customer's inquiry text, verbatim.
    """
    result = _post(
        f"{TRIAGE_SERVICE_URL}/triage/classify",
        {"raw_message": raw_message, "source": "crew"},
    )
    _record("classify_inquiry", result)
    return json.dumps(result)


@tool("estimate_cost")
def estimate_cost_tool(
    service_category: str,
    urgency: str,
    estimated_scope: str,
    area_zone: str | None = None,
) -> str:
    """Estimate the cost range for a job using the trained XGBoost model with
    SHAP explainability, falling back to documented heuristic ranges.

    The returned cost_min and cost_max are model output and are AUTHORITATIVE
    — report them exactly as given. Do not round, recalculate or adjust them.

    Args:
        service_category: One of electrical, refrigeration, emergency,
            maintenance, installation, general.
        urgency: One of low, medium, high, emergency.
        estimated_scope: Short description of the work required.
        area_zone: The suburb, if known.
    """
    body: dict[str, Any] = {
        "service_category": service_category,
        "urgency": urgency,
        "estimated_scope": estimated_scope,
    }
    if area_zone:
        body["area_zone"] = area_zone

    result = _post(f"{TRIAGE_SERVICE_URL}/triage/estimate-cost", body)
    _record("estimate_cost", result)
    return json.dumps(result)


@tool("recommend_technician")
def recommend_technician_tool(
    service_category: str,
    area_zone: str,
    urgency: str = "medium",
) -> str:
    """Recommend the best-matched technicians for a job, scored on skill
    match (40%), current availability (40%) and area familiarity (20%).

    Returns the top 3 with scores and a plain-English explanation each.

    Args:
        service_category: One of electrical, refrigeration, emergency,
            maintenance, installation, general.
        area_zone: The suburb the job is in. Required.
        urgency: One of low, medium, high, emergency.
    """
    result = _post(
        f"{DISPATCH_SERVICE_URL}/dispatch/recommend",
        {
            "service_category": service_category,
            "area_zone": area_zone,
            "urgency": urgency,
        },
    )
    _record("recommend_technician", result)
    return json.dumps(result)


ALL_TOOLS = [classify_inquiry_tool, estimate_cost_tool, recommend_technician_tool]
