"""
CrewAI Agents — the three triage specialists
============================================

Each agent maps to one step the sequential pipeline already performed, but
as an autonomous role with its own goal, backstory and tools rather than a
hardcoded function call. The value of modelling it this way is not speed —
the benchmark shows it is slower (docs/benchmarks/crew-vs-sequential.md) —
it is that adding a fourth specialist, or letting one agent request more
information from another, becomes a configuration change rather than a
rewrite of the endpoint.

LLM
  Groq llama-3.3-70b-versatile via CrewAI's litellm wrapper. Model name is
  `groq/<model>` because litellm routes on the provider prefix, unlike the
  bare `llama-3.3-70b-versatile` the triage and chatbot services pass to the
  Groq SDK directly.

DELEGATION IS OFF
  allow_delegation=False on all three. With it enabled, an agent that
  struggles can hand its task to another, which sounds appealing but means
  the classifier could end up writing cost estimates without ever calling
  the XGBoost tool. The whole point of this design is that the deterministic
  work stays deterministic, so each agent owns exactly its own step.
"""

import logging
import os

from crewai import LLM, Agent

from tools import classify_inquiry_tool, estimate_cost_tool, recommend_technician_tool

logger = logging.getLogger("crew.agents")

CREW_MODEL = os.getenv("CREW_MODEL", "groq/llama-3.3-70b-versatile")
CREW_TEMPERATURE = float(os.getenv("CREW_TEMPERATURE", "0.1"))
CREW_MAX_ITER = int(os.getenv("CREW_MAX_ITER", "5"))


def build_llm() -> LLM | None:
    """Construct the shared LLM, or None if no key is configured.

    Mirrors the never-raise contract of get_groq_client() in
    services/triage/main.py — a missing key degrades the service to a clean
    503 rather than raising at import time and taking the whole app down.
    """
    if not os.getenv("GROQ_API_KEY"):
        logger.warning("GROQ_API_KEY not set — crew will be unavailable")
        return None
    try:
        return LLM(model=CREW_MODEL, temperature=CREW_TEMPERATURE)
    except Exception as exc:  # noqa: BLE001 - never take the service down
        logger.warning(f"LLM init failed: {exc} — crew will be unavailable")
        return None


def build_agents(llm: LLM) -> tuple[Agent, Agent, Agent]:
    """Build the three triage agents sharing one LLM instance."""

    classifier = Agent(
        role="Customer Inquiry Classification Specialist",
        goal=(
            "Accurately classify the service type, urgency, equipment involved "
            "and location from a customer's raw inquiry text."
        ),
        backstory=(
            "You have spent fifteen years on the phones at a South African "
            "electrical and refrigeration firm. You can tell the difference "
            "between a customer who is mildly inconvenienced and one whose "
            "cold room is quietly destroying R80,000 of stock, and you know "
            "that 'the lights are doing a funny thing' can mean anything from "
            "a loose neutral to an arcing distribution board."
        ),
        llm=llm,
        tools=[classify_inquiry_tool],
        allow_delegation=False,
        max_iter=CREW_MAX_ITER,
        verbose=True,
    )

    cost_estimator = Agent(
        role="Service Cost Estimation Specialist",
        goal=(
            "Produce an accurate, data-driven cost range for the classified job "
            "using the trained estimation model, and explain the drivers behind it."
        ),
        backstory=(
            "You price jobs for a living and you have been burned by guesswork. "
            "You never estimate from intuition when a model trained on completed "
            "job history is available, and you report its figures exactly as "
            "returned — a quote that drifts from the model is a quote that "
            "cannot be defended to a customer or an auditor."
        ),
        llm=llm,
        tools=[estimate_cost_tool],
        allow_delegation=False,
        max_iter=CREW_MAX_ITER,
        verbose=True,
    )

    technician_matcher = Agent(
        role="Technician Assignment Specialist",
        goal=(
            "Match the job to the technicians best placed to complete it, "
            "balancing skill fit, current workload and familiarity with the area."
        ),
        backstory=(
            "You run dispatch across Gauteng and Limpopo. You know that the "
            "most skilled technician is the wrong answer when they already have "
            "four jobs open, and that someone who has worked a suburb for years "
            "finds the property faster than a stranger with a map."
        ),
        llm=llm,
        tools=[recommend_technician_tool],
        allow_delegation=False,
        max_iter=CREW_MAX_ITER,
        verbose=True,
    )

    return classifier, cost_estimator, technician_matcher
