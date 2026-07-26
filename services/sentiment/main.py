"""
Rams @Elec — Sentiment Analysis Service (Module 10)

FastAPI microservice providing:
- POST /sentiment/analyze — extract sentiment score + themes from a free-text
  customer comment captured during a post-service follow-up
- GET  /sentiment/health  — service health check

Called by the n8n follow-up conversation workflow once a customer's optional
comment is captured; the result is written back onto the FollowUp record
(sentiment_score, sentiment_themes).

SECURITY HARDENING (Module 2 pattern, same as the other five services):
  - CORS: specific origins via security.setup, never a wildcard
  - Auth: API key required for service-to-service calls
  - Input validation: extra='forbid', max_length, and prompt-injection
    sanitisation — this endpoint takes arbitrary customer free text and puts
    it in an LLM prompt, so it is the highest-risk input surface in the module
  - Output validation: the LLM's themes are filtered against a fixed taxonomy
    and its score is clamped, rather than trusted (see _coerce_* below)
  - Audit logging: SecurityLogger emits structured JSON
  - Security headers + per-IP rate limiting

  See: security/setup.py, security/input_validation/validators.py
"""

import json
import logging
import os
import sys
from datetime import datetime
from typing import Optional

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
logger = logging.getLogger("sentiment")

app = FastAPI(
    title="Rams @Elec Sentiment Analysis",
    description="Sentiment scoring and theme extraction for post-service feedback",
    version="1.0.0",
)

# Security audit logger — constructed before apply_security_middleware so
# auth failures, rate-limit hits, API key usage, and validation failures
# from every middleware layer emit real audit events (see security/setup.py).
sec_log = SecurityLogger(engine=None, service_name="sentiment")

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
# Theme taxonomy
# ---------------------------------------------------------------------------
# Fixed and closed on purpose. The dashboard aggregates these into a theme
# breakdown, so a free-form label ("staff were lovely") would fragment the
# chart into single-count categories and make trends unreadable. Anything the
# model returns outside this set is discarded, not coerced to "other" — a
# hallucinated theme is not evidence of that theme.
VALID_THEMES = (
    "professionalism",
    "pricing",
    "timing",
    "equipment_quality",
    "communication",
    "cleanliness",
    "other",
)

# ---------------------------------------------------------------------------
# Groq client (lazy init) — mirrors services/triage/main.py's never-raise
# contract: a missing key or a failed call degrades to a neutral result
# rather than 500ing and breaking the follow-up conversation mid-flow.
# ---------------------------------------------------------------------------
groq_client = None


def get_groq_client():
    global groq_client
    if groq_client is None:
        try:
            from groq import Groq

            groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        except ImportError:
            logger.warning("groq package not installed — sentiment will return neutral")
        except Exception as e:
            logger.warning(f"Groq init failed: {e} — sentiment will return neutral")
    return groq_client


SENTIMENT_PROMPT = """You are analysing a customer's feedback comment about an electrical or refrigeration service job for Rams @Elec, a South African services company.

Customer comment: "{comment}"

Return ONLY valid JSON, no other text, with these fields:
- sentiment_score: a float from -1.0 (very negative) to 1.0 (very positive). 0.0 is neutral.
- sentiment_themes: an array of themes present in the comment. Use ONLY these exact values: {themes}. Return an empty array if none clearly apply. Do not invent new themes.

Judge only what the comment actually says. Do not infer themes that are not mentioned."""


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class SentimentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    comment_text: str = Field(
        ..., max_length=MAX_MESSAGE_LENGTH, description="Customer's free-text comment"
    )
    follow_up_id: Optional[str] = Field(
        None, max_length=100, description="FollowUp record this comment belongs to"
    )

    @field_validator("comment_text")
    @classmethod
    def sanitize_comment(cls, v):
        return sanitize_prompt_input(v)


class SentimentResult(BaseModel):
    sentiment_score: float = Field(ge=-1.0, le=1.0)
    sentiment_themes: list[str] = []
    follow_up_id: Optional[str] = None
    # False when Groq was unavailable or returned something unusable and we
    # fell back to a neutral result. The caller should not write a fabricated
    # 0.0 into the database as though it were a real measurement.
    analyzed: bool = True


# ---------------------------------------------------------------------------
# Output coercion — never trust the model's shape
# ---------------------------------------------------------------------------


def _coerce_score(raw) -> float:
    """Clamp to [-1.0, 1.0]. Non-numeric input becomes neutral."""
    try:
        return max(-1.0, min(1.0, float(raw)))
    except (TypeError, ValueError):
        return 0.0


def _coerce_themes(raw) -> list[str]:
    """Keep only known taxonomy values, de-duplicated, order preserved."""
    if not isinstance(raw, list):
        return []
    seen: list[str] = []
    for item in raw:
        if not isinstance(item, str):
            continue
        theme = item.strip().lower()
        if theme in VALID_THEMES and theme not in seen:
            seen.append(theme)
    return seen


def _extract_json(content: str) -> dict:
    """Strip markdown fences the model sometimes wraps JSON in."""
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0].strip()
    elif "```" in content:
        content = content.split("```")[1].split("```")[0].strip()
    return json.loads(content)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.post("/sentiment/analyze", response_model=SentimentResult)
async def analyze(request: SentimentRequest):
    """Score a customer comment and extract themes from the fixed taxonomy."""
    client = get_groq_client()

    if client is None:
        return SentimentResult(
            sentiment_score=0.0,
            sentiment_themes=[],
            follow_up_id=request.follow_up_id,
            analyzed=False,
        )

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "user",
                    "content": SENTIMENT_PROMPT.format(
                        comment=request.comment_text,
                        themes=", ".join(VALID_THEMES),
                    ),
                }
            ],
            temperature=0.1,
            max_tokens=200,
        )
        parsed = _extract_json(response.choices[0].message.content.strip())
    except Exception as e:  # noqa: BLE001 — degrade, never break the conversation
        logger.error(f"Sentiment analysis failed: {e} — returning neutral")
        return SentimentResult(
            sentiment_score=0.0,
            sentiment_themes=[],
            follow_up_id=request.follow_up_id,
            analyzed=False,
        )

    return SentimentResult(
        sentiment_score=_coerce_score(parsed.get("sentiment_score")),
        sentiment_themes=_coerce_themes(parsed.get("sentiment_themes")),
        follow_up_id=request.follow_up_id,
        analyzed=True,
    )


@app.get("/sentiment/health")
async def health():
    return {
        "status": "healthy",
        "groq_available": get_groq_client() is not None,
        "valid_themes": list(VALID_THEMES),
        "timestamp": datetime.now().isoformat(),
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("SENTIMENT_PORT", "8006"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
