"""
Rams @Elec — AI Inquiry & Triage Engine

FastAPI microservice providing:
- POST /triage/classify        — NLP classification of inquiry text via Groq LLM
- POST /triage/estimate-cost   — XGBoost cost prediction with SHAP explanations
- POST /triage/assign-technician — Skillset + area + workload scoring
- GET  /triage/health          — Service health check

SECURITY HARDENING (Module 2 — July 2026):
  - CORS: Replaced allow_origins=["*"] with specific origins via security.setup
  - Auth: API key required for service-to-service calls
  - Input validation: Pydantic models hardened with:
      - extra='forbid' (rejects unexpected fields)
      - str_strip_whitespace=True (auto-trims input)
      - max_length on all string fields
      - SA phone number validation (E.164 normalisation)
      - LLM prompt injection sanitisation (strips control chars, code fences)
      - Service category and urgency enum validation
  - Audit logging: SecurityLogger emits structured JSON to stdout + DB
  - Security headers: CSP, X-Frame-Options, etc. via SecurityHeadersMiddleware
  - Rate limiting: 100 req/min per IP via RateLimiterMiddleware

  See: security/setup.py, security/input_validation/validators.py
  Docs: docs/security/secure-coding-implementation.md
"""

import os
import sys
import json
import logging
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator, ConfigDict
from sqlalchemy import create_engine, text

# Add project root to path for security imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))
from security.setup import apply_security_middleware
from security.input_validation.validators import (
    validate_phone_sa, validate_area_zone,
    validate_service_category, validate_urgency,
    sanitize_prompt_input, MAX_MESSAGE_LENGTH,
)
from security.logging.security_logger import SecurityLogger
from feature_encoding import FEATURE_COLS, CATEGORY_MAP, ZONE_MAP, encode_urgency_flag

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("triage")

app = FastAPI(
    title="Rams @Elec Triage Engine",
    description="AI-powered inquiry classification, cost estimation, and technician assignment",
    version="1.0.0",
)

# Security audit logger — constructed before apply_security_middleware so
# auth failures, rate-limit hits, API key usage, and validation failures
# from every middleware layer emit real audit events (see security/setup.py).
sec_log = SecurityLogger(engine=None, service_name="triage")

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
# Database
# ---------------------------------------------------------------------------
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/ramsatelec")
engine = create_engine(DATABASE_URL)

# ---------------------------------------------------------------------------
# Groq LLM client (lazy init)
# ---------------------------------------------------------------------------
groq_client = None


def get_groq_client():
    global groq_client
    if groq_client is None:
        try:
            from groq import Groq
            groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        except ImportError:
            logger.warning("groq package not installed — classification will use fallback")
        except Exception as e:
            logger.warning(f"Groq init failed: {e} — using fallback classification")
    return groq_client


# ---------------------------------------------------------------------------
# XGBoost Model (lazy load)
# ---------------------------------------------------------------------------
xgb_model = None
shap_explainer = None
model_features = FEATURE_COLS


def load_model():
    """Load trained XGBoost model or return None if not trained yet."""
    global xgb_model, shap_explainer
    import pickle
    model_path = os.path.join(os.path.dirname(__file__), "model", "xgb_quote_estimator.pkl")
    if os.path.exists(model_path):
        import xgboost as xgb
        xgb_model = xgb.XGBRegressor()
        xgb_model.load_model(model_path)
        logger.info("XGBoost model loaded")
        try:
            import shap
            shap_explainer = shap.TreeExplainer(xgb_model)
            logger.info("SHAP explainer initialised")
        except Exception as e:
            logger.warning(f"SHAP init failed: {e}")
        return True
    logger.warning("No trained model found — cost estimation will use heuristics")
    return False


# Try loading model at startup
load_model()


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class InquiryInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    raw_message: str = Field(..., max_length=MAX_MESSAGE_LENGTH, description="Raw inquiry text from customer")
    source: str = Field(default="web_form", max_length=50, description="Source channel")
    customer_name: Optional[str] = Field(None, max_length=100)
    customer_phone: Optional[str] = Field(None, max_length=15, description="SA phone number (+27...)")

    @field_validator("customer_phone")
    @classmethod
    def phone_must_be_sa(cls, v):
        return validate_phone_sa(v)

    @field_validator("raw_message")
    @classmethod
    def sanitize_message(cls, v):
        return sanitize_prompt_input(v)


class ClassificationResult(BaseModel):
    service_category: str
    urgency: str
    equipment_mentioned: list[str] = []
    area_zone: Optional[str] = None
    estimated_scope: str
    confidence: float = Field(ge=0.0, le=1.0)


class CostEstimateInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    service_category: str = Field(..., max_length=50)
    urgency: str = Field(..., max_length=20)
    area_zone: Optional[str] = Field(None, max_length=100)
    equipment_type: Optional[str] = Field(None, max_length=100)
    estimated_scope: str = Field(..., max_length=500)

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


class CostEstimateResult(BaseModel):
    cost_min: float
    cost_max: float
    confidence: float
    explanation: str
    similar_jobs_count: int


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


class AssignmentResult(BaseModel):
    recommendations: list[TechnicianScore]
    inquiry_area: str
    service_category: str


# ---------------------------------------------------------------------------
# PART A: Classification Endpoint
# ---------------------------------------------------------------------------

CLASSIFICATION_PROMPT = """You are the AI triage system for Rams @Elec, a South African electrical and refrigeration services company.

Analyse this customer inquiry and extract structured information. Return ONLY valid JSON, no other text.

Customer inquiry: "{message}"

Return JSON with these fields:
- service_category: one of "electrical", "refrigeration", "emergency", "maintenance", "installation", "general"
- urgency: one of "low", "medium", "high", "emergency"
- equipment_mentioned: list of equipment detected (e.g. ["cold_room", "generator", "hvac", "distribution_board"])
- area_zone: the location/suburb mentioned, or null if not specified
- estimated_scope: brief 1-sentence summary of what the customer needs
- confidence: your confidence in this classification (0.0 to 1.0)

Rules:
- If the message mentions "no power", "sparks", "burning smell", "flooding", "not cooling and perishable goods" → urgency = "emergency"
- If the message mentions "cold room", "fridge", "freezer", "cooling" → service_category = "refrigeration"
- If the message mentions "lights", "plugs", "wiring", "db board", "tripping" → service_category = "electrical"
- If the message mentions "install", "new", "setup" → service_category = "installation"
- If the message mentions "service", "maintenance", "checkup" → service_category = "maintenance"
- South African suburbs to recognise: Sandton, Midrand, Centurion, Pretoria East, Soweto, Polokwane, Mokopane, Bela-Bela"""


@app.post("/triage/classify", response_model=ClassificationResult)
async def classify_inquiry(inquiry: InquiryInput):
    """Classify a raw customer inquiry using Groq LLM with keyword fallback."""
    client = get_groq_client()

    if client:
        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{
                    "role": "user",
                    "content": CLASSIFICATION_PROMPT.format(message=inquiry.raw_message),
                }],
                temperature=0.1,
                max_tokens=300,
            )
            content = response.choices[0].message.content.strip()
            # Extract JSON from response (handle markdown code blocks)
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            result = json.loads(content)
            logger.info(f"Groq classification: {result['service_category']} / {result['urgency']}")
            return ClassificationResult(**result)
        except Exception as e:
            logger.error(f"Groq classification failed: {e}, falling back to keyword classifier")

    # Fallback: keyword-based classification
    return _keyword_classify(inquiry.raw_message)


def _keyword_classify(message: str) -> ClassificationResult:
    """Keyword-based fallback classifier when LLM is unavailable."""
    msg = message.lower()

    # Urgency detection
    emergency_keywords = ["no power", "spark", "burning", "smoke", "fire", "flood",
                          "emergency", "urgent", "asap", "immediately", "not cooling",
                          "perishable", "alarm going off", "since 3am"]
    high_keywords = ["not working", "broken", "failed", "leaking", "tripping", "flickering"]

    if any(kw in msg for kw in emergency_keywords):
        urgency = "emergency"
    elif any(kw in msg for kw in high_keywords):
        urgency = "high"
    elif "maintenance" in msg or "service" in msg or "check" in msg:
        urgency = "low"
    else:
        urgency = "medium"

    # Service category
    if any(kw in msg for kw in ["cold room", "fridge", "freezer", "refrigeration", "cooling", "chiller"]):
        category = "refrigeration"
    elif any(kw in msg for kw in ["aircon", "air con", "hvac", "ventilation", "duct"]):
        category = "refrigeration"
    elif any(kw in msg for kw in ["install", "new", "setup", "fit", "build"]):
        category = "installation"
    elif any(kw in msg for kw in ["maintenance", "service", "servicing", "checkup", "inspect"]):
        category = "maintenance"
    elif any(kw in msg for kw in ["emergency", "urgent", "no power", "spark", "smoke"]):
        category = "emergency"
    else:
        category = "electrical"

    # Equipment detection
    equipment = []
    if any(kw in msg for kw in ["cold room", "coldroom", "fridge", "freezer"]):
        equipment.append("cold_room")
    if any(kw in msg for kw in ["aircon", "air con", "hvac", "air conditioner"]):
        equipment.append("hvac")
    if any(kw in msg for kw in ["generator", "genny"]):
        equipment.append("generator")
    if any(kw in msg for kw in ["db board", "distribution board", "panel"]):
        equipment.append("electrical_panel")

    # Area zone detection
    area_zones = ["sandton", "midrand", "centurion", "pretoria east", "soweto",
                  "polokwane", "mokopane", "bela-bela", "bela bela"]
    area_zone = None
    for zone in area_zones:
        if zone in msg:
            area_zone = zone.title()
            break

    return ClassificationResult(
        service_category=category,
        urgency=urgency,
        equipment_mentioned=equipment,
        area_zone=area_zone,
        estimated_scope=message[:150],
        confidence=0.65,  # Lower confidence for keyword fallback
    )


# ---------------------------------------------------------------------------
# PART B: Cost Estimation Endpoint
# ---------------------------------------------------------------------------

# Heuristic cost ranges per service category × urgency (fallback when no model)
HEURISTIC_COST_RANGES = {
    ("electrical", "emergency"): (900, 7500),
    ("electrical", "high"): (1500, 8000),
    ("electrical", "medium"): (1200, 6500),
    ("electrical", "low"): (900, 3500),
    ("refrigeration", "emergency"): (2500, 18000),
    ("refrigeration", "high"): (2000, 15000),
    ("refrigeration", "medium"): (1500, 10000),
    ("refrigeration", "low"): (1200, 5000),
    ("emergency", "emergency"): (900, 7500),
    ("emergency", "high"): (1500, 8000),
    ("maintenance", "medium"): (900, 4500),
    ("maintenance", "low"): (900, 3000),
    ("installation", "medium"): (3500, 45000),
    ("installation", "low"): (2000, 25000),
}


@app.post("/triage/estimate-cost", response_model=CostEstimateResult)
async def estimate_cost(input_data: CostEstimateInput):
    """Estimate job cost using XGBoost model with heuristic fallback."""
    # Try querying Gold layer for similar historical jobs
    similar_count = 0
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text("""
                    SELECT COUNT(*) as cnt, AVG(actual_cost) as avg_cost,
                           MIN(actual_cost) as min_cost, MAX(actual_cost) as max_cost
                    FROM gold_jobs
                    WHERE service_category = :category
                      AND area_zone_group = (
                        SELECT CASE WHEN area_zone IN ('Sandton','Midrand','Centurion','Pretoria East','Soweto')
                                    THEN 'Gauteng' ELSE 'Limpopo' END
                      )
                """),
                {"category": input_data.service_category},
            ).fetchone()

            if result and result.cnt > 0:
                similar_count = result.cnt
                hist_min = float(result.min_cost or 0)
                hist_max = float(result.max_cost or 0)
                hist_avg = float(result.avg_cost or 0)
    except Exception as e:
        logger.warning(f"Gold layer query failed: {e}")
        hist_min, hist_max, hist_avg = 0, 0, 0

    # Use XGBoost model if available
    if xgb_model is not None and similar_count >= 5:
        try:
            features = _build_features(input_data)
            pred = float(xgb_model.predict(features)[0])

            # Get SHAP explanation
            explanation = ""
            if shap_explainer is not None:
                shap_values = shap_explainer.shap_values(features)
                feature_impacts = list(zip(model_features, shap_values[0]))
                feature_impacts.sort(key=lambda x: abs(x[1]), reverse=True)
                top_factors = [
                    f"{_explain_feature(f, v)}" for f, v in feature_impacts[:3]
                ]
                explanation = f"Estimate based on {similar_count} similar jobs. Key factors: {'; '.join(top_factors)}."
            else:
                explanation = f"Estimate based on {similar_count} similar historical jobs."

            variance = abs(pred * 0.2)
            return CostEstimateResult(
                cost_min=round(max(0, pred - variance), 2),
                cost_max=round(pred + variance, 2),
                confidence=min(0.9, similar_count / 50),
                explanation=explanation,
                similar_jobs_count=similar_count,
            )
        except Exception as e:
            logger.error(f"Model prediction failed: {e}")

    # Fallback: heuristic ranges
    key = (input_data.service_category, input_data.urgency)
    default_min, default_max = HEURISTIC_COST_RANGES.get(key, (900, 5000))

    # Blend with historical data if available
    if similar_count > 0:
        cost_min = (default_min + hist_min) / 2
        cost_max = (default_max + hist_max) / 2
    else:
        cost_min, cost_max = default_min, default_max

    urgency_multiplier = {"emergency": 1.5, "high": 1.2, "medium": 1.0, "low": 0.85}
    mult = urgency_multiplier.get(input_data.urgency, 1.0)

    return CostEstimateResult(
        cost_min=round(cost_min * mult, 2),
        cost_max=round(cost_max * mult, 2),
        confidence=0.5 if similar_count == 0 else min(0.7, similar_count / 30),
        explanation=(
            f"Estimate based on typical {input_data.service_category} jobs in {input_data.area_zone or 'your area'}. "
            f"({similar_count} similar historical jobs available)"
            if similar_count > 0
            else f"Estimated range for {input_data.service_category} ({input_data.urgency} urgency). "
                 "Estimates will improve as more job data is collected."
        ),
        similar_jobs_count=similar_count,
    )


def _build_features(input_data: CostEstimateInput) -> np.ndarray:
    """Build feature vector for XGBoost prediction.

    Uses the same CATEGORY_MAP/ZONE_MAP/encode_urgency_flag that
    train_model.py trains against (services/triage/feature_encoding.py) —
    training and inference must agree on what integer each category/zone
    encodes to, or predictions are silently wrong.
    """
    now = datetime.now()
    features = np.zeros((1, len(model_features)))
    features[0, 0] = CATEGORY_MAP.get(input_data.service_category, 5)
    features[0, 1] = encode_urgency_flag(input_data.urgency)
    features[0, 2] = ZONE_MAP.get(input_data.area_zone or "", 0)
    features[0, 3] = 0  # equipment_age_years (unknown for new inquiry)
    features[0, 4] = now.month
    features[0, 5] = now.weekday()
    features[0, 6] = 1 if now.weekday() >= 5 else 0
    return features


def _explain_feature(feature: str, shap_value: float) -> str:
    """Human-readable SHAP feature explanation."""
    direction = "increases" if shap_value > 0 else "decreases"
    labels = {
        "service_category_encoded": "service type",
        "urgency_flag": "urgency level",
        "area_zone_encoded": "location",
        "equipment_age_years": "equipment age",
        "month": "season",
        "day_of_week": "day of week",
        "is_weekend": "weekend scheduling",
    }
    return f"{labels.get(feature, feature)} {direction} cost by R{abs(shap_value):,.0f}"


# ---------------------------------------------------------------------------
# PART C: Technician Assignment Endpoint
# ---------------------------------------------------------------------------

@app.post("/triage/assign-technician", response_model=AssignmentResult)
async def assign_technician(classification: ClassificationResult):
    """Recommend technicians based on skillset, area, and workload."""
    recommendations = []

    try:
        with engine.connect() as conn:
            technicians = conn.execute(
                text("""
                    SELECT id, name, skills, area_zones
                    FROM technicians
                    WHERE active = true
                """)
            ).fetchall()

            for tech in technicians:
                tech_id, name, skills, zones = tech

                # Skill match score
                skill_match = 1.0 if classification.service_category in skills else 0.3

                # Area match score
                area_match = 1.0 if classification.area_zone and classification.area_zone in zones else 0.5

                # Workload score (count open/assigned/in_progress jobs)
                workload = conn.execute(
                    text("""
                        SELECT COUNT(*) FROM jobs
                        WHERE technician_id = :tid
                          AND status IN ('open', 'assigned', 'in_progress')
                    """),
                    {"tid": tech_id},
                ).scalar() or 0

                max_daily = conn.execute(
                    text("SELECT max_daily_jobs FROM technicians WHERE id = :tid"),
                    {"tid": tech_id},
                ).scalar() or 4

                availability = max(0, 1 - (workload / max_daily))

                # Area familiarity (past completed jobs in this zone)
                area_familiarity = 0.5
                if classification.area_zone:
                    past_jobs = conn.execute(
                        text("""
                            SELECT COUNT(*) FROM jobs
                            WHERE technician_id = :tid
                              AND area_zone = :zone
                              AND status = 'complete'
                        """),
                        {"tid": tech_id, "zone": classification.area_zone},
                    ).scalar() or 0
                    area_familiarity = min(1.0, past_jobs / 20)

                # Combined score: 40% skill, 40% availability, 20% area familiarity
                combined = (0.4 * skill_match) + (0.4 * availability) + (0.2 * area_familiarity)

                recommendations.append(TechnicianScore(
                    technician_id=tech_id,
                    name=name,
                    skills=skills or [],
                    area_zones=zones or [],
                    skill_match_score=round(skill_match, 3),
                    availability_score=round(availability, 3),
                    area_familiarity_score=round(area_familiarity, 3),
                    combined_score=round(combined, 3),
                    current_workload=workload,
                ))

    except Exception as e:
        logger.error(f"Technician query failed: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    recommendations.sort(key=lambda x: x.combined_score, reverse=True)

    return AssignmentResult(
        recommendations=recommendations[:3],
        inquiry_area=classification.area_zone or "unknown",
        service_category=classification.service_category,
    )


# ---------------------------------------------------------------------------
# Model Metrics — read-only, served from the artifact train_model.py writes
# ---------------------------------------------------------------------------

class ModelMetrics(BaseModel):
    trained: bool
    trained_at: Optional[str] = None
    training_samples: Optional[int] = None
    test_samples: Optional[int] = None
    data_source: Optional[str] = None
    mae: Optional[float] = None
    rmse: Optional[float] = None
    r2: Optional[float] = None
    cv_mae: Optional[float] = None
    cv_folds: Optional[int] = None
    feature_importance: Optional[dict[str, float]] = None


@app.get("/triage/model-metrics", response_model=ModelMetrics)
async def model_metrics():
    """Serve the quote estimator's held-out evaluation metrics.

    Read-only: this endpoint never trains or recomputes anything, it just
    reads the metrics.json that train_model.py writes next to the model
    artifact after each training run. Kept separate from /triage/health
    (which reports whether a model is loaded) — this reports how good
    that model actually is.
    """
    metrics_path = os.path.join(os.path.dirname(__file__), "model", "metrics.json")
    if not os.path.exists(metrics_path):
        return ModelMetrics(trained=False)
    with open(metrics_path, "r") as f:
        data = json.load(f)
    return ModelMetrics(trained=True, **data)


# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------

@app.get("/triage/health")
async def health():
    model_loaded = xgb_model is not None
    groq_available = get_groq_client() is not None
    return {
        "status": "healthy",
        "model_loaded": model_loaded,
        "groq_available": groq_available,
        "timestamp": datetime.now().isoformat(),
    }


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("TRIAGE_PORT", "8001"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
