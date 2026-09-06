"""
CrewAI Crew assembly — the triage crew
======================================

Assembles the three agents and three chained tasks into a sequential crew,
and installs the inter-agent sanitisation callback.

WHY THE CALLBACK MATTERS (the bit most CrewAI projects miss)
  The existing services sanitise user input at the HTTP boundary —
  sanitize_prompt_input() strips markdown fences, [SYSTEM] delimiters,
  "ignore previous instructions" and friends before the text reaches an LLM.

  In a crew that is no longer sufficient. Task 1's *output* becomes Task 2's
  *prompt*, so a payload that survives classification — or one the classifier
  itself is manipulated into emitting — is injected straight into the next
  agent's context. The boundary check never sees it, because it never
  crosses the boundary again.

  So every task output is re-sanitised before it is chained forward. This is
  the same defence applied at a second, internal trust boundary.

  Note the limitation honestly: this scrubs known injection markers from the
  text passed between agents. It does not make the agents immune to
  adversarial instructions phrased as ordinary English, which is an open
  research problem, not something a regex solves.
"""

import logging
import os
import sys

from crewai import Crew, Process
from crewai.tasks.task_output import TaskOutput

# Add project root to path for security imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))
from security.input_validation.validators import sanitize_prompt_input  # noqa: E402

from agents import build_agents, build_llm  # noqa: E402
from tasks import build_tasks  # noqa: E402

logger = logging.getLogger("crew.crew")

# Emitted when the sanitiser actually changed a task's output — worth
# surfacing as a security event rather than silently scrubbing.
SANITISED_OUTPUTS: list[dict] = []


def _sanitise_task_output(output: TaskOutput) -> None:
    """Re-sanitise a task's output before it is chained to the next agent.

    CrewAI calls this after every task. TaskOutput is mutable, so scrubbing
    `raw` in place is what actually protects the downstream prompt — the
    chained context is read from this object.
    """
    original = output.raw or ""
    cleaned = sanitize_prompt_input(original)

    if cleaned != original:
        logger.warning(
            f"Inter-agent sanitiser modified output of task "
            f"'{output.name or output.description[:40]}' — possible injection attempt"
        )
        SANITISED_OUTPUTS.append(
            {
                "task": output.name or output.description[:80],
                "agent": getattr(output, "agent", None),
            }
        )
        output.raw = cleaned


def reset_sanitisation_log() -> None:
    """Clear the sanitisation record. Call before each crew run."""
    SANITISED_OUTPUTS.clear()


def build_triage_crew(model: str | None = None) -> Crew | None:
    """Build the triage crew, or None if no LLM is available.

    Returns None rather than raising so main.py can answer with a clean 503
    when no credentials are configured, matching how triage and chatbot
    degrade. `model` overrides CREW_MODEL for this build only — see
    agents.build_llm()'s docstring; benchmark_bedrock.py is the caller that
    uses this.
    """
    llm = build_llm(model)
    if llm is None:
        return None

    classifier, cost_estimator, technician_matcher = build_agents(llm)
    classify_task, estimate_cost_task, match_technician_task = build_tasks(
        classifier, cost_estimator, technician_matcher
    )

    return Crew(
        agents=[classifier, cost_estimator, technician_matcher],
        tasks=[classify_task, estimate_cost_task, match_technician_task],
        process=Process.sequential,
        # Verbose so the agent reasoning appears in container logs — this is
        # the artefact that makes the crew's behaviour inspectable, and it is
        # what the test script captures.
        verbose=True,
        task_callback=_sanitise_task_output,
        # Memory off: it pulls in a vector store (lancedb) that this service
        # has no need for, and cross-request memory on a customer-facing
        # triage endpoint would leak one customer's inquiry into another's
        # context.
        memory=False,
        cache=False,
    )
