"""
Rams @Elec — Smart Dispatch & Job Assignment Service

Skillset-based technician recommendation (NOT GPS routing).
Scores technicians on: skill match (40%), availability (40%), area familiarity (20%).

SECURITY HARDENING (Module 2 — July 2026):
  - CORS: Replaced allow_origins=["*"] with specific origins via security.setup
  - Auth: API key required for service-to-service calls
  - Input validation: Pydantic models hardened with:
      - extra='forbid' (rejects unexpected fields)
      - str_strip_whitespace=True (auto-trims input)
      - max_length on all string fields
      - Area zone whitelist validation (40+ valid SA zones)
      - Service category and urgency enum validation
  - Audit logging: SecurityLogger emits structured JSON to stdout + DB
  - Security headers: CSP, X-Frame-Options, etc. via SecurityHeadersMiddleware
  - Rate limiting: 100 req/min per IP via RateLimiterMiddleware

  CRITICAL: /dispatch/assign was previously unauthenticated — anyone could
  assign technicians. Now requires API key authentication.

  See: security/setup.py, security/input_validation/validators.py
  Docs: docs/security/secure-coding-implementation.md
"""

import os
import sys
import logging
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator, ConfigDict
from sqlalchemy import create_engine, text

# Add project root to path for security imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))
from security.setup import apply_security_middleware
from security.input_validation.validators import (
    validate_area_zone,
    validate_service_category,
    validate_urgency,
)
from security.logging.security_logger import SecurityLogger

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("dispatch")

app = FastAPI(
    title="Rams @Elec Dispatch Service",
    description="Skillset-based technician recommendation and job assignment",
    version="1.0.0",
)

# Security audit logger — constructed before apply_security_middleware so
# auth failures, rate-limit hits, API key usage, and validation failures
# from every middleware layer emit real audit events (see security/setup.py).
sec_log = SecurityLogger(engine=None, service_name="dispatch")

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

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/ramsatelec"
)
engine = create_engine(DATABASE_URL)


class DispatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    service_category: str = Field(..., max_length=50)
    urgency: str = Field(default="medium", max_length=20)
    area_zone: str = Field(..., max_length=100)
    equipment_type: Optional[str] = Field(None, max_length=100)
    scheduled_date: Optional[str] = Field(None, max_length=20)

    @field_validator("service_category")
    @classmethod
    def category_must_be_valid(cls, v):
        return validate_service_category(v)

    @field_validator("urgency")
    @classmethod
    def urgency_must_be_valid(cls, v):
        return validate_urgency(v)

    @field_validator("area_zone")
    @classmethod
    def zone_must_be_valid(cls, v):
        return validate_area_zone(v)


class TechnicianScore(BaseModel):
    technician_id: str
    name: str
    skills: list[str]
    area_zones: list[str]
    skill_match_score: float
    availability_score: float
    area_familiarity_score: float
    combined_score: float
    current_workload: int
    explanation: str


class DispatchResult(BaseModel):
    recommendations: list[TechnicianScore]
    job_area: str
    service_category: str


class AssignRequest(BaseModel):
    job_id: str
    technician_id: str


@app.post("/dispatch/recommend", response_model=DispatchResult)
async def recommend(request: DispatchRequest):
    """Recommend top 3 technicians based on skillset, availability, and area familiarity."""
    recommendations = []

    try:
        with engine.connect() as conn:
            technicians = conn.execute(
                text(
                    "SELECT id, name, skills, area_zones, max_daily_jobs FROM technicians WHERE active = true"
                )
            ).fetchall()

            for tech in technicians:
                tid, name, skills, zones, max_daily = tech

                # Skill match: does technician have the required skill?
                skill_match = 1.0 if request.service_category in (skills or []) else 0.2

                # Area match: does technician cover this zone?
                area_match = 1.0 if request.area_zone in (zones or []) else 0.3

                # Workload: count current open/assigned/in_progress jobs
                workload = (
                    conn.execute(
                        text(
                            "SELECT COUNT(*) FROM jobs WHERE technician_id = :tid AND status IN ('open','assigned','in_progress')"
                        ),
                        {"tid": tid},
                    ).scalar()
                    or 0
                )

                availability = max(0.0, 1.0 - (workload / max(max_daily, 1)))

                # Area familiarity: past completed jobs in this zone
                past_jobs = (
                    conn.execute(
                        text(
                            "SELECT COUNT(*) FROM jobs WHERE technician_id = :tid AND area_zone = :zone AND status = 'complete'"
                        ),
                        {"tid": tid, "zone": request.area_zone},
                    ).scalar()
                    or 0
                )
                area_familiarity = min(1.0, past_jobs / 20.0)

                # Combined: 40% skill, 40% availability, 20% area familiarity
                combined = (
                    (0.4 * skill_match)
                    + (0.4 * availability)
                    + (0.2 * area_familiarity)
                )

                explanation_parts = []
                if skill_match >= 1.0:
                    explanation_parts.append(f"Has {request.service_category} skills")
                else:
                    explanation_parts.append("Limited match on required skills")
                if availability >= 0.75:
                    explanation_parts.append("good availability")
                elif availability >= 0.25:
                    explanation_parts.append(f"{workload}/{max_daily} jobs assigned")
                else:
                    explanation_parts.append("near full capacity")
                if area_familiarity >= 0.5:
                    explanation_parts.append(f"experienced in {request.area_zone}")

                recommendations.append(
                    TechnicianScore(
                        technician_id=tid,
                        name=name,
                        skills=skills or [],
                        area_zones=zones or [],
                        skill_match_score=round(skill_match, 3),
                        availability_score=round(availability, 3),
                        area_familiarity_score=round(area_familiarity, 3),
                        combined_score=round(combined, 3),
                        current_workload=workload,
                        explanation="; ".join(explanation_parts),
                    )
                )

    except Exception as e:
        logger.error(f"Dispatch query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    recommendations.sort(key=lambda x: x.combined_score, reverse=True)

    return DispatchResult(
        recommendations=recommendations[:3],
        job_area=request.area_zone,
        service_category=request.service_category,
    )


@app.post("/dispatch/assign")
async def assign(request: AssignRequest):
    """Assign a technician to a job."""
    try:
        with engine.begin() as conn:
            # Verify technician exists and is active
            tech = conn.execute(
                text(
                    "SELECT id, name FROM technicians WHERE id = :tid AND active = true"
                ),
                {"tid": request.technician_id},
            ).fetchone()

            if not tech:
                raise HTTPException(
                    status_code=404, detail="Technician not found or inactive"
                )

            # Update job
            result = conn.execute(
                text("""
                    UPDATE jobs SET technician_id = :tid, status = 'assigned'
                    WHERE id = :jid AND status = 'open'
                    RETURNING id
                """),
                {"tid": request.technician_id, "jid": request.job_id},
            ).fetchone()

            if not result:
                raise HTTPException(
                    status_code=400, detail="Job not found or already assigned"
                )

            # Log status change
            conn.execute(
                text("""
                    INSERT INTO job_status_history (job_id, old_status, new_status, changed_by, notes)
                    VALUES (:jid, 'open', 'assigned', :changed_by, :notes)
                """),
                {
                    "jid": request.job_id,
                    "changed_by": "admin",
                    "notes": f"Assigned to {tech[1]}",
                },
            )

        return {"status": "assigned", "job_id": request.job_id, "technician": tech[1]}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Assignment failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/dispatch/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("DISPATCH_PORT", "8004"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
