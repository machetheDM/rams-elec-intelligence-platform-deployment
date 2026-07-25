"""
Rams @Elec — RAG Chatbot Service

FastAPI microservice providing:
- POST /chatbot/query — RAG-powered customer support chatbot

Knowledge base: SANS 10142 summaries, service catalog, FAQ, load-shedding guide.
Uses FAISS + sentence-transformers for retrieval, Groq llama-3.3-70b for generation.

SECURITY HARDENING (Module 2 — July 2026):
  - CORS: Replaced allow_origins=["*"] with specific origins via security.setup
  - Auth: API key required for service-to-service calls
  - Input validation: chat message sanitised against prompt-injection payloads
    before it ever reaches the LLM (the highest-risk endpoint in this repo —
    user text is injected directly into an LLM prompt)
  - Audit logging: SecurityLogger emits structured JSON to stdout + DB
  - Security headers: CSP, X-Frame-Options, etc. via SecurityHeadersMiddleware
  - Rate limiting: 100 req/min per IP via RateLimiterMiddleware

  See: security/setup.py, security/input_validation/validators.py
"""

import os
import sys
import json
import logging
from datetime import datetime
from typing import Optional

import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator, ConfigDict
from sqlalchemy import create_engine, text

# Add project root to path for security imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))
from security.setup import apply_security_middleware
from security.input_validation.validators import sanitize_prompt_input, MAX_MESSAGE_LENGTH
from security.logging.security_logger import SecurityLogger

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("chatbot")

app = FastAPI(
    title="Rams @Elec RAG Chatbot",
    description="AI assistant trained on SANS 10142, service catalog, and FAQs",
    version="1.0.0",
)

# Security audit logger — constructed before apply_security_middleware so
# auth failures, rate-limit hits, API key usage, and validation failures
# from every middleware layer emit real audit events (see security/setup.py).
sec_log = SecurityLogger(engine=None, service_name="chatbot")

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
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/ramsatelec")
FAISS_INDEX_PATH = os.getenv("FAISS_INDEX_PATH", "./knowledge_base/faiss_index")
engine = create_engine(DATABASE_URL)

# ---------------------------------------------------------------------------
# FAISS + Embeddings (lazy load)
# ---------------------------------------------------------------------------
vectorstore = None
embeddings_model = None


def load_vectorstore():
    """Load FAISS index and embeddings model."""
    global vectorstore, embeddings_model
    try:
        from langchain_community.vectorstores import FAISS
        from langchain_community.embeddings import HuggingFaceEmbeddings

        embeddings_model = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={"device": "cpu"},
        )

        if os.path.exists(os.path.join(FAISS_INDEX_PATH, "index.faiss")):
            vectorstore = FAISS.load_local(
                FAISS_INDEX_PATH,
                embeddings_model,
                allow_dangerous_deserialization=True,
            )
            logger.info(f"FAISS index loaded from {FAISS_INDEX_PATH}")
            return True
        else:
            logger.warning(f"FAISS index not found at {FAISS_INDEX_PATH}. Run embed_knowledge_base.py first.")
            return False
    except Exception as e:
        logger.error(f"Failed to load vectorstore: {e}")
        return False


# Try loading at startup
load_vectorstore()


# ---------------------------------------------------------------------------
# Groq client (lazy)
# ---------------------------------------------------------------------------
groq_client = None


def get_groq_client():
    global groq_client
    if groq_client is None:
        try:
            from groq import Groq
            groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        except Exception as e:
            logger.warning(f"Groq init failed: {e}")
    return groq_client


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    message: str = Field(..., max_length=MAX_MESSAGE_LENGTH, description="User message")
    customer_id: Optional[str] = Field(None, max_length=100)
    conversation_history: list[dict] = Field(default_factory=list, max_length=20)

    @field_validator("message")
    @classmethod
    def sanitize_message(cls, v):
        return sanitize_prompt_input(v)


class ChatResponse(BaseModel):
    reply: str
    sources: list[dict] = Field(default_factory=list)
    escalate_to_human: bool = False
    escalation_reason: Optional[str] = None


# ---------------------------------------------------------------------------
# Customer Context
# ---------------------------------------------------------------------------

def get_customer_context(customer_id: str) -> str:
    """Fetch customer's equipment and recent jobs for context injection."""
    if not customer_id:
        return ""

    try:
        with engine.connect() as conn:
            equipment = conn.execute(
                text("""
                    SELECT type, brand, model, install_date, last_service_date
                    FROM equipment WHERE customer_id = :cid
                    ORDER BY install_date DESC LIMIT 10
                """),
                {"cid": customer_id},
            ).fetchall()

            jobs = conn.execute(
                text("""
                    SELECT j.status, j.urgency, j.scheduled_date, st.name as service_name
                    FROM jobs j
                    JOIN service_types st ON j.service_type_id = st.id
                    WHERE j.customer_id = :cid
                    ORDER BY j.created_at DESC LIMIT 5
                """),
                {"cid": customer_id},
            ).fetchall()

        context_parts = []
        if equipment:
            context_parts.append("Customer's equipment:")
            for eq in equipment:
                context_parts.append(
                    f"- {eq.type}: {eq.brand} {eq.model} "
                    f"(installed: {eq.install_date}, last serviced: {eq.last_service_date})"
                )

        if jobs:
            context_parts.append("\nRecent jobs:")
            for job in jobs:
                context_parts.append(
                    f"- {job.service_name} ({job.status}, {job.urgency} urgency, {job.scheduled_date})"
                )

        return "\n".join(context_parts)
    except Exception as e:
        logger.warning(f"Failed to fetch customer context: {e}")
        return ""


# ---------------------------------------------------------------------------
# Escalation Detection
# ---------------------------------------------------------------------------

ESCALATION_KEYWORDS = [
    "site visit", "come to my", "send someone", "need a technician",
    "certificate", "coc", "compliance certificate", "legal",
    "emergency", "fire", "sparks", "burning", "smoke", "shock",
    "install", "installation", "replace", "upgrade my",
    "quote for", "how much to", "price for",
]


def should_escalate(message: str) -> tuple[bool, Optional[str]]:
    """Determine if the query should be escalated to a human technician."""
    msg_lower = message.lower()

    if any(kw in msg_lower for kw in ["emergency", "fire", "sparks", "burning", "smoke", "shock"]):
        return True, "This appears to be an emergency situation. A technician should assess this immediately."

    if any(kw in msg_lower for kw in ["site visit", "come to", "send someone", "need a technician"]):
        return True, "This requires an on-site visit from a qualified technician."

    if any(kw in msg_lower for kw in ["certificate", "coc", "compliance certificate"]):
        return True, "Compliance certificates require a registered electrician's assessment and signature."

    if any(kw in msg_lower for kw in ["install", "installation", "replace", "upgrade"]):
        return True, "Installation and replacement work requires a site assessment for accurate quoting."

    if any(kw in msg_lower for kw in ["quote", "how much", "price", "cost to"]):
        return True, "For an accurate quote, a technician needs to assess your specific setup."

    return False, None


# ---------------------------------------------------------------------------
# RAG Chatbot Endpoint
# ---------------------------------------------------------------------------

RAG_SYSTEM_PROMPT = """You are the Rams @Elec AI Assistant, helping customers with electrical and refrigeration questions.

Your knowledge covers:
- South African electrical compliance (SANS 10142)
- Cold room and HVAC maintenance
- Load-shedding protection and backup power
- Rams @Elec services and pricing ranges
- General electrical safety advice

RULES:
1. Answer based on the provided context. If the context doesn't cover the question, say so honestly.
2. NEVER provide specific legal compliance rulings. Always add: "For official compliance certification, a registered electrician must assess your installation."
3. For pricing: give ranges only, never exact quotes. Say "A site assessment is needed for an exact quote."
4. For emergencies: tell the customer to call +27 71 101 8493 immediately.
5. Be friendly and professional. Use South African English.
6. Keep answers concise — 2-3 paragraphs maximum.

Context from knowledge base:
{context}

Customer context:
{customer_context}"""


@app.post("/chatbot/query", response_model=ChatResponse)
async def query(request: ChatRequest):
    """Answer a customer question using RAG over the knowledge base."""
    # Check for escalation
    escalate, reason = should_escalate(request.message)
    if escalate:
        return ChatResponse(
            reply=_escalation_response(request.message, reason or ""),
            sources=[],
            escalate_to_human=True,
            escalation_reason=reason,
        )

    # Get customer context
    customer_context = ""
    if request.customer_id:
        customer_context = get_customer_context(request.customer_id)

    # Retrieve relevant chunks
    retrieved_docs = []
    if vectorstore is not None:
        try:
            docs_with_scores = vectorstore.similarity_search_with_score(request.message, k=5)
            retrieved_docs = [
                {"content": doc.page_content, "score": float(score)}
                for doc, score in docs_with_scores
            ]
        except Exception as e:
            logger.error(f"FAISS retrieval failed: {e}")

    # Build context
    context = "\n\n---\n\n".join([d["content"] for d in retrieved_docs]) if retrieved_docs else "No relevant knowledge base articles found."

    # Generate response via Groq
    client = get_groq_client()
    if client:
        try:
            # Build conversation messages
            messages = [{"role": "system", "content": RAG_SYSTEM_PROMPT.format(
                context=context,
                customer_context=customer_context or "No customer-specific data available.",
            )}]

            # Add conversation history (last 6 messages). Only the "role"
            # and "content" keys are trusted, role is restricted to
            # user/assistant (a client-supplied "role": "system" message
            # here would otherwise let an attacker inject a fake system
            # prompt), and content is sanitised the same as a fresh message.
            for msg in request.conversation_history[-6:]:
                role = msg.get("role")
                content = msg.get("content")
                if role not in ("user", "assistant") or not isinstance(content, str):
                    continue
                messages.append({"role": role, "content": sanitize_prompt_input(content)})

            messages.append({"role": "user", "content": request.message})

            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                temperature=0.3,
                max_tokens=500,
            )
            reply = response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Groq generation failed: {e}")
            reply = _fallback_response(request.message, retrieved_docs)
    else:
        reply = _fallback_response(request.message, retrieved_docs)

    # Log conversation
    if request.customer_id:
        try:
            with engine.begin() as conn:
                conn.execute(
                    text("""
                        INSERT INTO chatbot_conversations (customer_id, role, message, sources)
                        VALUES (:cid, 'user', :msg, NULL)
                    """),
                    {"cid": request.customer_id, "msg": request.message},
                )
                conn.execute(
                    text("""
                        INSERT INTO chatbot_conversations (customer_id, role, message, sources)
                        VALUES (:cid, 'assistant', :msg, :sources)
                    """),
                    {
                        "cid": request.customer_id,
                        "msg": reply,
                        "sources": json.dumps(retrieved_docs[:3]) if retrieved_docs else None,
                    },
                )
        except Exception as e:
            logger.warning(f"Failed to log conversation: {e}")

    # Format sources
    sources = [
        {"excerpt": d["content"][:200] + "...", "relevance": round(d["score"], 3)}
        for d in retrieved_docs[:3]
    ]

    return ChatResponse(
        reply=reply,
        sources=sources,
        escalate_to_human=False,
    )


def _escalation_response(message: str, reason: str) -> str:
    """Generate escalation response."""
    if "emergency" in message.lower() or any(kw in message.lower() for kw in ["fire", "sparks", "burning", "smoke", "shock"]):
        return (
            "🚨 **This sounds like an emergency situation.**\n\n"
            "Please call our emergency line immediately: **+27 71 101 8493**\n\n"
            "For your safety:\n"
            "- Switch off the main power at the distribution board if safe to do so\n"
            "- Keep away from any sparking or smoking equipment\n"
            "- Do not touch any exposed wires\n\n"
            "Our emergency response team is available 24/7."
        )

    return (
        f"**{reason}**\n\n"
        "I've flagged your request for our team. A Rams @Elec technician will contact you shortly.\n\n"
        "In the meantime, you can:\n"
        "- 📞 Call us: +27 71 101 8493\n"
        "- 📱 WhatsApp: +27 71 101 8493\n"
        "- 📧 Email: ramsatelec@gmail.com\n\n"
        "Or submit an inquiry for an instant cost estimate: [Get a Quote](/inquire)"
    )


def _fallback_response(message: str, docs: list[dict]) -> str:
    """Fallback response when LLM is unavailable — uses retrieved docs directly."""
    msg_lower = message.lower()

    # FAQ pattern matching
    if any(kw in msg_lower for kw in ["load shedding", "loadshedding", "power cut", "outage"]):
        return (
            "**Load Shedding Protection**\n\n"
            "To protect your equipment during load shedding:\n"
            "- Install surge protection on your distribution board\n"
            "- Consider a backup battery/inverter system for essential circuits\n"
            "- For cold rooms: ensure door seals are tight and limit door openings during outages\n"
            "- Generators should be serviced every 6 months\n\n"
            "Rams @Elec offers surge protection installation from R1,800 and generator servicing from R1,500.\n"
            "[Get a free quote →](/inquire)"
        )

    if any(kw in msg_lower for kw in ["cold room", "temperature", "cooling", "fridge"]):
        return (
            "**Cold Room Maintenance Tips**\n\n"
            "- Check door seals monthly — damaged seals cause temperature loss\n"
            "- Clean condenser coils every 3 months\n"
            "- Monitor temperature logs daily\n"
            "- Schedule professional servicing every 6 months\n\n"
            "Common issues: ice buildup (defrost needed), compressor cycling (possible refrigerant leak), "
            "warm spots (airflow blockage).\n\n"
            "Rams @Elec cold room servicing starts from R1,500.\n"
            "[Book a service →](/inquire)"
        )

    if any(kw in msg_lower for kw in ["coc", "compliance", "certificate", "sans"]):
        return (
            "**SANS 10142 Compliance**\n\n"
            "A Certificate of Compliance (COC) is required by South African law for:\n"
            "- Property sales/transfers\n"
            "- New electrical installations\n"
            "- Insurance claims involving electrical systems\n\n"
            "⚠️ Only a registered electrician can issue a valid COC. Rams @Elec provides "
            "compliance audits and COC preparation from R1,800.\n\n"
            "**Disclaimer:** For official compliance certification, a registered electrician "
            "must assess your installation in person."
        )

    if docs:
        return docs[0]["content"][:500] + "\n\n---\n*This is an automated response. For specific advice, please contact our team.*"

    return (
        "Thank you for your question! I'm the Rams @Elec AI assistant.\n\n"
        "I can help with:\n"
        "- ⚡ Electrical safety and compliance questions\n"
        "- ❄️ Cold room and HVAC maintenance advice\n"
        "- 🔌 Load-shedding protection recommendations\n"
        "- 💰 Service pricing ranges\n"
        "- 📋 General inquiries\n\n"
        "For a personalised response, please contact our team:\n"
        "📞 +27 71 101 8493 | 📧 ramsatelec@gmail.com"
    )


@app.get("/chatbot/health")
async def health():
    return {
        "status": "healthy",
        "vectorstore_loaded": vectorstore is not None,
        "groq_available": get_groq_client() is not None,
        "timestamp": datetime.now().isoformat(),
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("CHATBOT_PORT", "8003"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
