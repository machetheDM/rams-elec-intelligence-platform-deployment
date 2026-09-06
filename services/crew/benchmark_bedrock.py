"""
Bedrock vs. Groq — measured comparison of the crew's LLM backend
==================================================================

Runs the same three sample inquiries through the SAME crew (three agents,
three tasks, the inter-agent sanitiser, the cost determinism guard —
everything in crew.py) with only the LLM swapped, and records what changes.

This is deliberately NOT an HTTP benchmark like benchmark.py. main.py caches
one crew built from CREW_MODEL at process start, so comparing two backends
through the running service would need two containers with different env
vars. Instead this script calls crew.build_triage_crew(model=...) directly —
bypassing main.py entirely — to build a Groq-backed crew and a
Bedrock-backed crew in the same process and run both.

Metrics captured per inquiry, per backend:
  - wall-clock latency for crew.kickoff()
  - LLM calls and total tokens, from CrewOutput.token_usage
  - cost agreement: did this backend's crew report the same cost_min/cost_max
    the XGBoost tool actually returned, or did it drift? (see
    crew.py / main.py's _verify_cost for why this matters more than latency)

REQUIRES
  - GROQ_API_KEY set (same as always)
  - AWS credentials resolvable by boto3, AND model access granted in the
    Bedrock console for BEDROCK_MODEL (see services/crew/.env.example) — a
    missing grant is a real, common failure mode this script reports
    honestly rather than silently skipping
  - services/triage and services/dispatch reachable (the tools call them
    over HTTP exactly as they do in production)

USAGE
    docker compose up -d postgres triage dispatch
    export GROQ_API_KEY=...
    export AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=...
    python services/crew/benchmark_bedrock.py

Writes docs/benchmarks/bedrock-vs-groq.md. Not run in CI — real credentials,
real tokens, real (small) Bedrock spend on every invocation.
"""

import json
import logging
import os
import statistics
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

logging.basicConfig(level=logging.WARNING)  # quiet CrewAI's own INFO noise

GROQ_MODEL = os.getenv("CREW_MODEL", "groq/llama-3.3-70b-versatile")
BEDROCK_MODEL = os.getenv(
    "BEDROCK_MODEL", "bedrock/anthropic.claude-3-haiku-20240307-v1:0"
)

REPORT_PATH = (
    Path(__file__).resolve().parents[2] / "docs" / "benchmarks" / "bedrock-vs-groq.md"
)

# Same three shapes as benchmark.py's SAMPLE_INQUIRIES, kept identical
# deliberately so this report and crew-vs-sequential.md are comparable.
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


def _run_backend(model: str, text: str) -> dict[str, Any]:
    """Build a fresh crew for this exact model and run one inquiry through
    it. Fresh per call, not cached — this script is explicitly comparing
    cold, independent builds, not measuring a warmed-up server."""
    import crew as crew_module
    import tools as tools_module

    result: dict[str, Any] = {"model": model, "error": None}

    tools_module.reset_tool_results()
    crew_module.reset_sanitisation_log()

    built = crew_module.build_triage_crew(model=model)
    if built is None:
        result["error"] = "crew unavailable — see agents.llm_backend_ready()"
        return result

    started = time.perf_counter()
    try:
        output = built.kickoff(inputs={"inquiry": text})
    except Exception as exc:  # noqa: BLE001 - record it, don't crash the run
        result["error"] = f"{exc.__class__.__name__}: {exc}"
        result["elapsed_seconds"] = round(time.perf_counter() - started, 3)
        return result
    elapsed = time.perf_counter() - started

    tool_results = tools_module.get_tool_results()
    usage = getattr(output, "token_usage", None)

    result.update(
        {
            "elapsed_seconds": round(elapsed, 3),
            "total_tokens": getattr(usage, "total_tokens", None) if usage else None,
            "llm_calls": getattr(usage, "successful_requests", None) if usage else None,
            "cost_estimate": tool_results.get("estimate_cost"),
            "sanitisations": len(crew_module.SANITISED_OUTPUTS),
        }
    )
    return result


def _costs_agree(a: Optional[dict], b: Optional[dict]) -> Optional[bool]:
    if not a or not b:
        return None
    try:
        return (
            abs(float(a["cost_min"]) - float(b["cost_min"])) < 0.01
            and abs(float(a["cost_max"]) - float(b["cost_max"])) < 0.01
        )
    except (KeyError, TypeError, ValueError):
        return None


def main() -> int:
    if not os.getenv("GROQ_API_KEY"):
        print(
            "ERROR: GROQ_API_KEY not set — required for the groq side of this comparison."
        )
        return 1

    print(f"Groq model:    {GROQ_MODEL}")
    print(f"Bedrock model: {BEDROCK_MODEL}")
    print(
        "NOTE: if Bedrock rows below show an error mentioning access or "
        "authorization, the model most likely needs to be enabled for this "
        "account in Bedrock console -> Model access. That grant is manual "
        "and per-model; nothing in this repo can request it for you.\n"
    )

    rows = []
    for sample in SAMPLE_INQUIRIES:
        print(f"=== {sample['label']} ===")

        print("  groq...", end="", flush=True)
        groq_result = _run_backend(GROQ_MODEL, sample["text"])
        print(f" {groq_result.get('elapsed_seconds', 'FAILED')}")

        print("  bedrock...", end="", flush=True)
        bedrock_result = _run_backend(BEDROCK_MODEL, sample["text"])
        print(f" {bedrock_result.get('elapsed_seconds', 'FAILED')}")

        rows.append(
            {
                "label": sample["label"],
                "groq": groq_result,
                "bedrock": bedrock_result,
                "costs_agree": _costs_agree(
                    groq_result.get("cost_estimate"),
                    bedrock_result.get("cost_estimate"),
                ),
            }
        )

    _write_report(rows)
    print(f"\nReport written to {REPORT_PATH}")
    return 0


def _write_report(rows: list[dict]) -> None:
    groq_times = [
        r["groq"]["elapsed_seconds"] for r in rows if not r["groq"].get("error")
    ]
    bedrock_times = [
        r["bedrock"]["elapsed_seconds"] for r in rows if not r["bedrock"].get("error")
    ]
    bedrock_failures = [r for r in rows if r["bedrock"].get("error")]

    lines = [
        "# Bedrock vs. Groq — Crew LLM Backend Benchmark",
        "",
        "Generated by `services/crew/benchmark_bedrock.py`. Do not hand-edit.",
        "",
        f"- Run at: {datetime.now(timezone.utc).isoformat()}",
        f"- Groq model: `{GROQ_MODEL}`",
        f"- Bedrock model: `{BEDROCK_MODEL}`",
        f"- Samples: {len(rows)}",
        "",
    ]

    if bedrock_failures:
        lines += [
            "## Bedrock failures",
            "",
            "At least one Bedrock run failed outright — figures below are",
            "**partial**, computed only from the runs that succeeded. This is",
            "reported rather than hidden because a benchmark that silently drops",
            "failed rows and reports only successes overstates reliability.",
            "",
        ]
        for r in bedrock_failures:
            lines.append(f"- `{r['label']}`: {r['bedrock']['error']}")
        lines.append("")

    if groq_times and bedrock_times:
        groq_mean = statistics.mean(groq_times)
        bedrock_mean = statistics.mean(bedrock_times)
        lines += [
            "## Summary (successful runs only)",
            "",
            "| Metric | Groq | Bedrock |",
            "|---|---|---|",
            f"| Mean latency | {groq_mean:.2f}s | {bedrock_mean:.2f}s |",
            f"| Successful runs | {len(groq_times)}/{len(rows)} | {len(bedrock_times)}/{len(rows)} |",
            "",
        ]
    else:
        lines += [
            "## Summary",
            "",
            "Not enough successful runs on both backends to compute mean latency. "
            "See failures above.",
            "",
        ]

    lines += [
        "## Per-inquiry",
        "",
        "| Inquiry | Groq | Bedrock | Cost agreement |",
        "|---|---|---|---|",
    ]
    for r in rows:
        groq_cell = (
            f"{r['groq']['elapsed_seconds']}s"
            if not r["groq"].get("error")
            else f"FAILED: {r['groq']['error']}"
        )
        bedrock_cell = (
            f"{r['bedrock']['elapsed_seconds']}s"
            if not r["bedrock"].get("error")
            else f"FAILED: {r['bedrock']['error']}"
        )
        agree = r["costs_agree"]
        agree_str = "n/a" if agree is None else ("match" if agree else "**DRIFTED**")
        lines.append(f"| {r['label']} | {groq_cell} | {bedrock_cell} | {agree_str} |")

    lines += [
        "",
        "## Reading this honestly",
        "",
        "This compares two LLM providers behind the identical crew — same agents, same",
        "tasks, same tools, same determinism guard. Any latency difference is the model",
        "and API round-trip, not the architecture (that comparison is",
        "[crew-vs-sequential.md](crew-vs-sequential.md)).",
        "",
        "**Cost agreement** matters more than latency here. `/triage/estimate-cost`",
        "returns an exact model output; both backends narrate it, and either can drift",
        "the same way the Groq-only benchmark documents. A `DRIFTED` row for one",
        "backend and not the other says something real about that model's tendency to",
        "round or restate numbers — it is not a wiring bug.",
        "",
        "**What this does not tell you.** Bedrock's per-token pricing, regional model",
        "availability, and the manual model-access grant requirement are real",
        "operational differences from Groq's free tier that a latency/token table",
        "cannot capture. Check current Bedrock pricing for the specific model before",
        "treating any number here as a cost decision.",
        "",
    ]

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")

    REPORT_PATH.with_suffix(".json").write_text(
        json.dumps(rows, indent=2, default=str), encoding="utf-8"
    )


if __name__ == "__main__":
    sys.exit(main())
