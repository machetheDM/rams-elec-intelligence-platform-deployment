"""
Crew vs. Sequential — measured comparison
=========================================

Runs the same inquiries down both paths and records what the agent
architecture actually costs:

  sequential : POST /triage/classify
               -> POST /triage/estimate-cost
               -> POST /dispatch/recommend
  crew       : POST /crew/process

Metrics captured per inquiry:
  - wall-clock latency for each path
  - LLM calls and total tokens (the crew reports these via
    CrewOutput.token_usage; the sequential path makes exactly one Groq call,
    in /triage/classify — cost estimation and dispatch are deterministic)
  - cost agreement: did the crew report the same cost_min/cost_max the
    XGBoost model produced, or did the LLM drift?

The point is not to show the crew winning. It almost certainly loses on
latency and cost. The point is to know by how much, so the architectural
choice is an informed one — see docs/crewai-integration.md.

USAGE
    docker compose up -d postgres triage dispatch crew
    export GROQ_API_KEY=...            # crew is 503 without it
    python services/crew/benchmark.py

Writes docs/benchmarks/crew-vs-sequential.md. Not run in CI — it needs a
real API key and would spend real tokens on every push.
"""

import json
import os
import statistics
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

TRIAGE_URL = os.getenv("TRIAGE_SERVICE_URL", "http://localhost:8001")
DISPATCH_URL = os.getenv("DISPATCH_SERVICE_URL", "http://localhost:8004")
CREW_URL = os.getenv("CREW_SERVICE_URL", "http://localhost:8005")
API_KEY = os.getenv("INTERNAL_API_KEY", "rams-elec-frontend-2026")

HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}
TIMEOUT = float(os.getenv("BENCHMARK_TIMEOUT", "180"))

REPORT_PATH = (
    Path(__file__).resolve().parents[2]
    / "docs"
    / "benchmarks"
    / "crew-vs-sequential.md"
)

# Three deliberately different shapes: an unambiguous emergency, a routine
# scheduled job, and a vague message where the classifier has to work.
SAMPLE_INQUIRIES = [
    {
        "label": "emergency",
        "text": (
            "URGENT our cold room in Sandton has been off since 3am, "
            "temperature is climbing and we have about R80 000 of stock in there. "
            "Please send someone now."
        ),
    },
    {
        "label": "routine",
        "text": (
            "Hi, we'd like to book the annual preventative maintenance check on "
            "our HVAC system at the Midrand branch. No rush, sometime next month is fine."
        ),
    },
    {
        "label": "ambiguous",
        "text": "the lights are doing a funny thing in the back office, can someone look",
    },
]


def _post(url: str, body: dict) -> tuple[dict, float]:
    started = time.perf_counter()
    response = httpx.post(url, json=body, headers=HEADERS, timeout=TIMEOUT)
    elapsed = time.perf_counter() - started
    response.raise_for_status()
    return response.json(), elapsed


def run_sequential(text: str) -> dict:
    """The existing path: one LLM call, then two deterministic services."""
    total = 0.0

    classification, t = _post(
        f"{TRIAGE_URL}/triage/classify", {"raw_message": text, "source": "benchmark"}
    )
    total += t

    cost_body = {
        "service_category": classification["service_category"],
        "urgency": classification["urgency"],
        "estimated_scope": classification["estimated_scope"],
    }
    if classification.get("area_zone"):
        cost_body["area_zone"] = classification["area_zone"]
    cost, t = _post(f"{TRIAGE_URL}/triage/estimate-cost", cost_body)
    total += t

    technicians = None
    if classification.get("area_zone"):
        technicians, t = _post(
            f"{DISPATCH_URL}/dispatch/recommend",
            {
                "service_category": classification["service_category"],
                "area_zone": classification["area_zone"],
                "urgency": classification["urgency"],
            },
        )
        total += t

    return {
        "elapsed_seconds": round(total, 3),
        "llm_calls": 1,  # only /triage/classify uses the LLM
        "classification": classification,
        "cost": cost,
        "technicians": technicians,
    }


def run_crew(text: str) -> dict:
    result, elapsed = _post(
        f"{CREW_URL}/crew/process", {"raw_message": text, "source": "benchmark"}
    )
    return {
        "elapsed_seconds": round(elapsed, 3),
        "reported_elapsed": result.get("elapsed_seconds"),
        "llm_calls": result.get("llm_calls"),
        "total_tokens": result.get("total_tokens"),
        "cost": result.get("cost_estimate"),
        "cost_overridden": result.get("cost_estimate_overridden", False),
        "sanitisations": result.get("inter_agent_sanitisations", 0),
        "agent_steps": len(result.get("agent_steps", [])),
    }


def _costs_agree(seq_cost: dict | None, crew_cost: dict | None) -> bool | None:
    if not seq_cost or not crew_cost:
        return None
    try:
        return (
            abs(float(seq_cost["cost_min"]) - float(crew_cost["cost_min"])) < 0.01
            and abs(float(seq_cost["cost_max"]) - float(crew_cost["cost_max"])) < 0.01
        )
    except (KeyError, TypeError, ValueError):
        return None


def main() -> int:
    print("Checking services are up...")
    try:
        httpx.get(f"{CREW_URL}/crew/health", timeout=10).raise_for_status()
        httpx.get(f"{TRIAGE_URL}/triage/health", timeout=10).raise_for_status()
        httpx.get(f"{DISPATCH_URL}/dispatch/health", timeout=10).raise_for_status()
    except httpx.HTTPError as exc:
        print(f"ERROR: services not reachable ({exc}).")
        print("Run: docker compose up -d postgres triage dispatch crew")
        return 1

    if not os.getenv("GROQ_API_KEY"):
        print(
            "WARNING: GROQ_API_KEY not set locally — the crew container needs it in .env"
        )

    rows = []
    for sample in SAMPLE_INQUIRIES:
        print(f"\n=== {sample['label']} ===")

        print("  sequential...", end="", flush=True)
        seq = run_sequential(sample["text"])
        print(f" {seq['elapsed_seconds']}s")

        print("  crew...", end="", flush=True)
        crew = run_crew(sample["text"])
        print(f" {crew['elapsed_seconds']}s")

        rows.append(
            {
                "label": sample["label"],
                "sequential": seq,
                "crew": crew,
                "costs_agree": _costs_agree(seq.get("cost"), crew.get("cost")),
            }
        )

    _write_report(rows)
    print(f"\nReport written to {REPORT_PATH}")
    return 0


def _write_report(rows: list[dict]) -> None:
    seq_times = [r["sequential"]["elapsed_seconds"] for r in rows]
    crew_times = [r["crew"]["elapsed_seconds"] for r in rows]
    tokens = [r["crew"]["total_tokens"] for r in rows if r["crew"].get("total_tokens")]

    seq_mean = statistics.mean(seq_times)
    crew_mean = statistics.mean(crew_times)

    lines = [
        "# Crew vs. Sequential — Benchmark",
        "",
        "Generated by `services/crew/benchmark.py`. Do not hand-edit.",
        "",
        f"- Run at: {datetime.now(timezone.utc).isoformat()}",
        f"- Model: `{os.getenv('CREW_MODEL', 'groq/llama-3.3-70b-versatile')}`",
        f"- Samples: {len(rows)}",
        "",
        "## Summary",
        "",
        "| Metric | Sequential | Crew |",
        "|---|---|---|",
        f"| Mean latency | {seq_mean:.2f}s | {crew_mean:.2f}s |",
        f"| Slowdown | — | {crew_mean / seq_mean:.1f}x |",
        f"| LLM calls per inquiry | 1 | {rows[0]['crew'].get('llm_calls') or 'n/a'} |",
        f"| Mean tokens per inquiry | ~0 (1 small call) | {int(statistics.mean(tokens)) if tokens else 'n/a'} |",
        "",
        "## Per-inquiry",
        "",
        "| Inquiry | Sequential | Crew | Tokens | Cost agreement | Cost overridden |",
        "|---|---|---|---|---|---|",
    ]

    for r in rows:
        agree = r["costs_agree"]
        agree_str = "n/a" if agree is None else ("match" if agree else "**DRIFTED**")
        lines.append(
            f"| {r['label']} | {r['sequential']['elapsed_seconds']}s | "
            f"{r['crew']['elapsed_seconds']}s | "
            f"{r['crew'].get('total_tokens') or 'n/a'} | {agree_str} | "
            f"{'yes' if r['crew'].get('cost_overridden') else 'no'} |"
        )

    lines += [
        "",
        "## Reading this honestly",
        "",
        "The sequential path is faster and cheaper, and that is expected — it makes",
        "one LLM call and then runs two deterministic services. The crew makes an",
        "LLM call per agent, plus tool-calling round trips, and adds a network hop",
        "per tool because the tools reach triage and dispatch over HTTP.",
        "",
        "What the crew buys is not throughput. It is that each step is an",
        "independently described role with its own tools, so adding a fourth",
        "specialist — or letting the cost agent ask the classifier to clarify a",
        "vague inquiry — is a configuration change rather than a rewrite of the",
        "endpoint. Whether that is worth several seconds and a few thousand tokens",
        "per inquiry depends entirely on how often the workflow changes.",
        "",
        "**Cost agreement** is the column that matters most for correctness. The",
        "cost estimate is produced by a trained XGBoost model and is exact; routing",
        "it through an LLM that narrates results introduces a chance the number is",
        "rounded or restated. Where `cost overridden` is `yes`, the crew's narrated",
        "figure disagreed with the model and the service substituted the",
        "authoritative value — see `_verify_cost` in `services/crew/main.py`.",
        "",
    ]

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")

    # Machine-readable alongside the prose, for later trend analysis.
    REPORT_PATH.with_suffix(".json").write_text(
        json.dumps(rows, indent=2, default=str), encoding="utf-8"
    )


if __name__ == "__main__":
    sys.exit(main())
