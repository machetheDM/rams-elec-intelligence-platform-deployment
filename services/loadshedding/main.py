"""
Rams @Elec — Load-Shedding Intelligence Service

FastAPI microservice providing:
- GET  /loadshedding/status/{area_zone}   — Current stage + next outage
- GET  /loadshedding/schedule/{area_zone} — 7-day schedule
- POST /loadshedding/subscribe            — Register for alerts
- GET  /loadshedding/health               — Service health check

Uses EskomSePush API (https://eskomsepush.gumroad.com/l/api).
Results cached for 15 minutes to respect API rate limits.

SECURITY HARDENING (Module 2 — July 2026):
  - CORS: Replaced allow_origins=["*"] with specific origins via security.setup
  - Auth: API key required for service-to-service calls
  - Input validation: /subscribe hardened with extra='forbid', SA phone
    normalisation, and area-zone whitelist validation
  - Audit logging: SecurityLogger emits structured JSON to stdout + DB
  - Security headers: CSP, X-Frame-Options, etc. via SecurityHeadersMiddleware
  - Rate limiting: 100 req/min per IP via RateLimiterMiddleware

  See: security/setup.py, security/input_validation/validators.py
"""

import os
import sys
import logging
from datetime import datetime, timedelta
from typing import Optional
from functools import lru_cache

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field, field_validator, ConfigDict
from sqlalchemy import create_engine, text

# Add project root to path for security imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))
from security.setup import apply_security_middleware
from security.input_validation.validators import validate_phone_sa, validate_area_zone
from security.logging.security_logger import SecurityLogger

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("loadshedding")

app = FastAPI(
    title="Rams @Elec Load-Shedding Service",
    description="Real-time load-shedding monitoring via EskomSePush API",
    version="1.0.0",
)

# Security audit logger — constructed before apply_security_middleware so
# auth failures, rate-limit hits, API key usage, and validation failures
# from every middleware layer emit real audit events (see security/setup.py).
sec_log = SecurityLogger(engine=None, service_name="loadshedding")

# Apply security middleware (replaces CORS wildcard)
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

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
ESP_API_KEY = os.getenv("ESKOM_SE_PUSH_API_KEY", "")
ESP_BASE_URL = "https://developer.sepush.co.za/business/2.0"
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/ramsatelec"
)
engine = create_engine(DATABASE_URL)

# Cache: 15 minutes
CACHE_TTL = 900

# Area zone → EskomSePush area ID mapping
# These must be discovered via the /areas_search endpoint
AREA_ID_MAP = {
    "Sandton": "sandton",
    "Midrand": "midrand",
    "Centurion": "centurion",
    "Pretoria East": "pretoria-east",
    "Soweto": "soweto",
    "Polokwane": "polokwane",
    "Mokopane": "mokopane",
    "Bela-Bela": "bela-bela",
}

# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------


class LoadsheddingStatus(BaseModel):
    area_zone: str
    current_stage: Optional[int] = None
    next_outage_start: Optional[str] = None
    next_outage_end: Optional[str] = None
    status: str = "unknown"  # active | scheduled | none
    last_updated: str


class ScheduleEvent(BaseModel):
    start: str
    end: str
    stage: int


class ScheduleResponse(BaseModel):
    area_zone: str
    events: list[ScheduleEvent]
    last_updated: str


class SubscribeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    area_zone: str = Field(..., max_length=100)
    customer_id: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(
        None, max_length=15, description="SA phone number (+27...)"
    )

    @field_validator("area_zone")
    @classmethod
    def zone_must_be_valid(cls, v):
        return validate_area_zone(v)

    @field_validator("phone")
    @classmethod
    def phone_must_be_sa(cls, v):
        return validate_phone_sa(v)


# ---------------------------------------------------------------------------
# EskomSePush API Client
# ---------------------------------------------------------------------------


class EskomSePushClient:
    """Wrapper around EskomSePush API with caching."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client = httpx.Client(
            base_url=ESP_BASE_URL,
            headers={"Token": api_key},
            timeout=15.0,
        )

    def get_status(self) -> dict:
        """Get current national load-shedding status."""
        try:
            resp = self.client.get("/status")
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"EskomSePush status fetch failed: {e}")
            return {"status": {"eskom": {"stage": None}}}

    def get_area_info(self, area_id: str) -> dict:
        """Get full schedule for a specific area."""
        try:
            resp = self.client.get(f"/area?id={area_id}")
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"EskomSePush area fetch failed for {area_id}: {e}")
            return {"events": [], "info": {}}

    def search_areas(self, query: str) -> list:
        """Search for area IDs by text."""
        try:
            resp = self.client.get(f"/areas_search?text={query}")
            resp.raise_for_status()
            data = resp.json()
            return data.get("areas", [])
        except Exception as e:
            logger.error(f"EskomSePush area search failed: {e}")
            return []

    def close(self):
        self.client.close()


# ---------------------------------------------------------------------------
# Cached helpers
# ---------------------------------------------------------------------------

_cache_timestamp = None
_cached_status = None
_cached_schedules: dict[str, dict] = {}


def _get_client() -> EskomSePushClient:
    return EskomSePushClient(ESP_API_KEY)


def _get_cached_status() -> dict:
    global _cache_timestamp, _cached_status
    now = datetime.now()
    if (
        _cache_timestamp
        and (now - _cache_timestamp).seconds < CACHE_TTL
        and _cached_status
    ):
        return _cached_status
    client = _get_client()
    _cached_status = client.get_status()
    _cache_timestamp = now
    client.close()
    return _cached_status


def _get_cached_schedule(area_id: str) -> dict:
    now = datetime.now()
    if area_id in _cached_schedules:
        cached = _cached_schedules[area_id]
        if (now - cached["_fetched_at"]).seconds < CACHE_TTL:
            return cached
    client = _get_client()
    data = client.get_area_info(area_id)
    data["_fetched_at"] = now
    _cached_schedules[area_id] = data
    client.close()
    return data


def _find_next_outage(events: list[dict]) -> tuple[Optional[str], Optional[str]]:
    """Find the next upcoming outage from a list of events."""
    now = datetime.now()
    for event in events:
        try:
            start = datetime.fromisoformat(event.get("start", ""))
            end = datetime.fromisoformat(event.get("end", ""))
            if start > now:
                return start.isoformat(), end.isoformat()
            if start <= now <= end:
                return start.isoformat(), end.isoformat()
        except (ValueError, TypeError):
            continue
    return None, None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/loadshedding/status/{area_zone}", response_model=LoadsheddingStatus)
async def get_status(area_zone: str):
    """Get current load-shedding status for an area zone."""
    area_id = AREA_ID_MAP.get(area_zone)
    if not area_id:
        # Try fuzzy search via API
        client = _get_client()
        areas = client.search_areas(area_zone)
        client.close()
        if areas:
            area_id = areas[0]["id"]
        else:
            raise HTTPException(
                status_code=404, detail=f"Area zone '{area_zone}' not found"
            )

    # Get national status
    status_data = _get_cached_status()
    current_stage = None
    try:
        stage_str = status_data.get("status", {}).get("eskom", {}).get("stage")
        if stage_str:
            current_stage = int(stage_str)
    except (ValueError, TypeError):
        pass

    # Get area schedule
    schedule_data = _get_cached_schedule(area_id)
    events = schedule_data.get("events", [])
    next_start, next_end = _find_next_outage(events)

    # Determine status
    if next_start and next_end:
        now = datetime.now()
        try:
            start_dt = datetime.fromisoformat(next_start)
            end_dt = datetime.fromisoformat(next_end)
            if start_dt <= now <= end_dt:
                status = "active"
            else:
                status = "scheduled"
        except (ValueError, TypeError):
            status = "scheduled"
    else:
        status = "none"

    return LoadsheddingStatus(
        area_zone=area_zone,
        current_stage=current_stage,
        next_outage_start=next_start,
        next_outage_end=next_end,
        status=status,
        last_updated=datetime.now().isoformat(),
    )


@app.get("/loadshedding/schedule/{area_zone}", response_model=ScheduleResponse)
async def get_schedule(area_zone: str):
    """Get 7-day load-shedding schedule for an area zone."""
    area_id = AREA_ID_MAP.get(area_zone)
    if not area_id:
        raise HTTPException(
            status_code=404, detail=f"Area zone '{area_zone}' not found"
        )

    schedule_data = _get_cached_schedule(area_id)
    events = schedule_data.get("events", [])

    schedule_events = []
    for event in events:
        try:
            schedule_events.append(
                ScheduleEvent(
                    start=event.get("start", ""),
                    end=event.get("end", ""),
                    stage=event.get("stage", 0) or 0,
                )
            )
        except Exception:
            continue

    return ScheduleResponse(
        area_zone=area_zone,
        events=schedule_events,
        last_updated=datetime.now().isoformat(),
    )


@app.post("/loadshedding/subscribe")
async def subscribe(request: SubscribeRequest):
    """Register an existing customer for load-shedding alerts.

    Returns `matched` so the caller can tell a real subscription from a
    no-op. Previously this reported {"status": "subscribed"} unconditionally:
    an UPDATE against a phone number with no matching customer row affects
    zero rows and raises nothing, so a public sign-up form would show every
    new visitor a success message while recording nothing at all.

    This endpoint deliberately does NOT create customer records. Accepting
    names and phone numbers from an unauthenticated public form is personal-
    information collection under POPIA and needs its own consent capture,
    verification and retention decisions — not a silent INSERT here.
    """
    if not request.customer_id and not request.phone:
        raise HTTPException(status_code=400, detail="customer_id or phone required")

    try:
        with engine.begin() as conn:
            if request.customer_id:
                result = conn.execute(
                    text("UPDATE customers SET alert_subscribed = true WHERE id = :id"),
                    {"id": request.customer_id},
                )
            else:
                result = conn.execute(
                    text(
                        "UPDATE customers SET alert_subscribed = true WHERE phone = :phone"
                    ),
                    {"phone": request.phone},
                )
            matched = result.rowcount > 0

        if not matched:
            logger.info("Subscribe: no customer matched — nothing recorded")

        return {
            "status": "subscribed" if matched else "no_matching_customer",
            "matched": matched,
            "area_zone": request.area_zone,
        }
    except Exception as e:
        logger.error(f"Subscribe failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/loadshedding/health")
async def health():
    return {
        "status": "healthy",
        "esp_api_configured": bool(ESP_API_KEY),
        "area_zones": list(AREA_ID_MAP.keys()),
        "timestamp": datetime.now().isoformat(),
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("LOADSHEDDING_PORT", "8002"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
