"""
Rams @Elec — CrewAI Multi-Agent Triage Service

FastAPI microservice providing:
- POST /crew/process  — full triage via a 3-agent CrewAI crew
- GET  /crew/health   — service health + downstream reachability

This runs ALONGSIDE the existing sequential endpoints
(/triage/classify -> /triage/estimate-cost -> /dispatch/recommend), which
remain the fast path. Keeping both is deliberate: it gives a baseline to
benchmark the agent architecture against, and it means a Groq outage or
rate limit degrades one path rather than taking triage down entirely.
See docs/crewai-integration.md and docs/benchmarks/crew-vs-sequential.md.

SECURITY HARDENING (Module 2 pattern, same as the other four services):
  - CORS: specific origins via security.setup, never a wildcard
  - Auth: API key required for service-to-service calls
  - Input validation: extra='forbid', max_length, prompt-injection
    sanitisation at the boundary AND between agent hops (see crew.py)
  - Audit logging: SecurityLogger emits structured JSON
  - Security headers + per-IP rate limiting

  See: security/setup.py, security/input_validation/validators.py
"""

import logging
import os
import sys
import time
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict, Field, field_validator

# Add project root to path for security imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))
from security.setup import apply_security_middleware
from security.input_validation.validators import (
    sanitize_prompt_input,
    MAX_MESSAGE_LENGTH,
)
from security.logging.security_logger import SecurityLogger

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("crew")

# ---------------------------------------------------------------------------
# Guarded CrewAI import
# ---------------------------------------------------------------------------
# pytest.ini sets testpaths = services, so the main test-python CI job
# collects this service's tests in an environment that deliberately does NOT
# have crewai installed (it would collide with triage's numpy<2.5 pin — see
# the separate test-crew job in ci.yml). The service must therefore import
# cleanly without crewai and report its absence at runtime instead.
try:
    from crew import build_triage_crew, reset_sanitisation_log, SANITISED_OUTPUTS
    from tools import get_tool_results, reset_tool_results
    from agents import CREW_MODEL, llm_backend_ready, llm_provider

    CREW_AVAILABLE = True
    CREW_IMPORT_ERROR: Optional[str] = None
except ImportError as exc:  # pragma: no cover - exercised in the slim CI env
    CREW_AVAILABLE = False
    CREW_IMPORT_ERROR = str(exc)
    logger.warning(f"CrewAI unavailable: {exc} — /crew/process will return 503")

app = FastAPI(
    title="Rams @Elec CrewAI Triage",
    description="Multi-agent triage: classification, cost estimation, technician matching",
    version="1.0.0",
)

# Security audit logger — constructed before apply_security_middleware so
# auth failures, rate-limit hits, API key usage, and validation failures
# from every middleware layer emit real audit events (see security/setup.py).
sec_log = SecurityLogger(engine=None, service_name="crew")

apply_security_middleware(
    app,
    enable_api_key=True,
    cors_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        os.getenv("FRONTEND_URL", ""),
    ],
    security_logger=sec_log,
)

TRIAGE_SERVICE_URL = os.getenv("TRIAGE_SERVICE_URL", "http://localhost:8001")
DISPATCH_SERVICE_URL = os.getenv("DISPATCH_SERVICE_URL", "http://localhost:8004")

# Built lazily so a missing GROQ_API_KEY doesn't fail at import time.
_crew = None
_crew_built = False


def get_crew():
    global _crew, _crew_built
    if not _crew_built:
        _crew_built = True
        if CREW_AVAILABLE:
            _crew = build_triage_crew()
    return _crew


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class CrewInquiryInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    raw_message: str = Field(
        ..., max_length=MAX_MESSAGE_LENGTH, description="Raw inquiry text from customer"
    )
    source: str = Field(default="web_form", max_length=50)

    @field_validator("raw_message")
    @classmethod
    def sanitize_message(cls, v):
        return sanitize_prompt_input(v)


class AgentStep(BaseModel):
    """One agent's contribution, surfaced for transparency."""

    agent: Optional[str] = None
    task: Optional[str] = None
    output: str


class CrewResult(BaseModel):
    summary: str
    classification: Optional[dict] = None
    cost_estimate: Optional[dict] = None
    technician_recommendations: Optional[dict] = None
    agent_steps: list[AgentStep] = []
    # Observability
    elapsed_seconds: float
    total_tokens: Optional[int] = None
    llm_calls: Optional[int] = None
    # Set when the crew's narrated cost disagreed with the model's actual
    # output and we substituted the authoritative value. See below.
    cost_estimate_overridden: bool = False
    inter_agent_sanitisations: int = 0


# ---------------------------------------------------------------------------
# Determinism guard
# ---------------------------------------------------------------------------


def _authoritative_cost(tool_results: dict[str, Any]) -> Optional[dict]:
    """The cost estimate exactly as the XGBoost service returned it."""
    raw = tool_results.get("estimate_cost")
    if isinstance(raw, dict) and "cost_min" in raw and "cost_max" in raw:
        return raw
    return None


def _crew_reported_cost(crew_output) -> Optional[dict]:
    """Best-effort parse of what the cost agent actually said."""
    for task_output in getattr(crew_output, "tasks_output", []) or []:
        parsed = getattr(task_output, "json_dict", None)
        if isinstance(parsed, dict) and "cost_min" in parsed:
            return parsed
    return None


def _verify_cost(
    crew_output, tool_results: dict[str, Any]
) -> tuple[Optional[dict], bool]:
    """Return (cost_estimate, was_overridden).

    An LLM agent narrates tool output, so it can round R11,280.65 to
    "about R11,000" or recompute a range. The estimate is a customer-facing
    number produced by a trained model — it must survive the agent layer
    unchanged. Where the two disagree, the tool's value wins and we record
    that it happened, turning a silent hallucination into a logged metric.
    """
    authoritative = _authoritative_cost(tool_results)
    if authoritative is None:
        return _crew_reported_cost(crew_output), False

    reported = _crew_reported_cost(crew_output)
    if reported is None:
        return authoritative, False

    drifted = any(
        _differs(reported.get(key), authoritative.get(key))
        for key in ("cost_min", "cost_max")
    )
    return authoritative, drifted


def _differs(a: Any, b: Any) -> bool:
    try:
        return abs(float(a) - float(b)) > 0.01
    except (TypeError, ValueError):
        return a != b


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.post("/crew/process")
def process_inquiry(inquiry: CrewInquiryInput):
    """Run the full triage crew over a raw customer inquiry.

    Declared as `def`, not `async def`, on purpose: crew.kickoff() is
    blocking, and FastAPI runs plain `def` handlers in its threadpool so a
    long agent run doesn't stall the event loop for every other request.
    """
    from fastapi.responses import JSONResponse

    if not CREW_AVAILABLE:
        return JSONResponse(
            status_code=503,
            content={
                "detail": "CrewAI is not installed in this environment.",
                "error": CREW_IMPORT_ERROR,
            },
        )

    crew = get_crew()
    if crew is None:
        return JSONResponse(
            status_code=503,
            content={"detail": "Crew unavailable — GROQ_API_KEY is not configured."},
        )

    reset_tool_results()
    reset_sanitisation_log()

    started = time.perf_counter()
    try:
        output = crew.kickoff(inputs={"inquiry": inquiry.raw_message})
    except Exception as exc:  # noqa: BLE001 - a crew failure is not a crash
        logger.error(f"Crew execution failed: {exc}")
        return JSONResponse(
            status_code=502,
            content={"detail": f"Crew execution failed: {exc.__class__.__name__}"},
        )
    elapsed = time.perf_counter() - started

    tool_results = get_tool_results()
    cost_estimate, overridden = _verify_cost(output, tool_results)

    if overridden:
        logger.warning("Crew cost estimate drifted from model output — overriding")
        sec_log.log_suspicious_pattern(
            source_ip="internal",
            pattern="crew_cost_estimate_drift",
            count=1,
            window_seconds=int(elapsed),
        )

    steps = [
        AgentStep(
            agent=str(getattr(t, "agent", "") or "") or None,
            task=getattr(t, "name", None),
            output=(t.raw or "")[:4000],
        )
        for t in (getattr(output, "tasks_output", []) or [])
    ]

    usage = getattr(output, "token_usage", None)

    return CrewResult(
        summary=(getattr(output, "raw", "") or "")[:4000],
        classification=tool_results.get("classify_inquiry"),
        cost_estimate=cost_estimate,
        technician_recommendations=tool_results.get("recommend_technician"),
        agent_steps=steps,
        elapsed_seconds=round(elapsed, 3),
        total_tokens=getattr(usage, "total_tokens", None) if usage else None,
        llm_calls=getattr(usage, "successful_requests", None) if usage else None,
        cost_estimate_overridden=overridden,
        inter_agent_sanitisations=len(SANITISED_OUTPUTS) if CREW_AVAILABLE else 0,
    )


@app.get("/crew/health")
def health():
    return {
        "status": "healthy",
        "crew_available": CREW_AVAILABLE,
        # Generic across providers — see agents.py's llm_backend_ready() for
        # why this is "credentials appear present", not "verified working",
        # when the backend is bedrock rather than groq.
        "llm_backend": llm_provider(CREW_MODEL) if CREW_AVAILABLE else None,
        "llm_configured": llm_backend_ready(CREW_MODEL) if CREW_AVAILABLE else False,
        "triage_service_url": TRIAGE_SERVICE_URL,
        "dispatch_service_url": DISPATCH_SERVICE_URL,
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("CREW_PORT", "8005"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
