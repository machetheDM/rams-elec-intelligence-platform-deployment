# CLAUDE.md — Rams @Elec Intelligence Platform

Context for AI assistants and for future-me returning after a break. Read this before changing
anything.

## Maintaining this file — for the assistant

**Update this file in the same commit as the change, without being asked.** It is the only thing
that survives between sessions; if it drifts, the next session starts blind. Triggers:

- A new service, package, or top-level directory → update the architecture table
- A convention discovered the hard way (a silent failure, a footgun, a "why is it like this")
  → add it under Conventions or the silent-no-op section
- A module completed, deferred, or abandoned → update State
- An open thread closed (PR merged, migration applied) → remove it from Open
- A deliberate refusal (fabricated data, unverifiable claim) → record it under the honesty
  principle, so a later session doesn't helpfully undo it

Keep it scannable. This is an operating manual, not a changelog — chronology and reasoning belong
in `docs/build-journal.md`. If something here is stale, fix it rather than appending a correction.

---

## What this is

An AI-powered platform for **Rams @Elec**, a real South African electrical & refrigeration
services company (`ramsatelec.com`, Gauteng + Limpopo). It replaces a static brochure site.

**Why it exists:** portfolio evidence for Dingaan Mahlatse Machethe — dual MSc candidate
(Data Science, UEL; Cybersecurity/Cloud Security Architecture, EC-Council University) — targeting
Data Science / AI Engineering / ML Engineering / Data Engineering / Cloud Security roles. It is
referenced publicly on LinkedIn and shown to recruiters.

**Two layers in one repo:**
1. **The product** — Next.js frontend + 6 FastAPI microservices + Prisma/Postgres + Airflow ETL +
   Streamlit dashboard + n8n automations.
2. **A DevSecOps/coursework overlay** — ECCU510 (Secure Programming) and ECCU524 (Cloud Security):
   security audit, hardening middleware, CI security pipeline, Azure Terraform, runbooks.

**Careful — "Module" is overloaded.** Product modules 1–10 (README table) are NOT the same as
SecureDevOps modules 1–5. Product Module 3 = AI Triage Engine; SecureDevOps Module 3 = CI/CD.

---

## The non-negotiable principle: honesty over impressiveness

This repo's actual differentiator is that **every claim is verifiable**. Preserve that — it is
worth more than any feature.

Concretely, things that have been deliberately *refused*:
- **No fabricated statistics.** Four unsourced figures ("40% of electrical fires", "R2.4B surge
  damage"…) were removed from the risk section. Restore only with attribution.
- **No invented testimonials.** `frontend/src/lib/api/testimonials.ts` has an empty
  `REAL_TESTIMONIALS` array. Samples exist for design only and are **hard-gated behind
  `NODE_ENV === "development"`**, which Next.js statically replaces so the bundler strips them from
  production. Verified by grepping `.next/` for the sample strings. Fake testimonials on a
  commercial site breach the Consumer Protection Act.
- **No untrained models presented as trained.** `metrics.json` carries
  `data_source: "synthetic_etl_pipeline"` and the UI renders that disclosure. The
  failure-recurrence model (Module 10 Part E) refuses to train below 100 labelled follow-ups.
- **Designed ≠ deployed.** Azure Terraform and the n8n WhatsApp workflow are labelled
  designed-not-provisioned. Do not blur this.

---

## Architecture

| Component | Path | Port | Notes |
|---|---|---|---|
| Frontend | `frontend/` | 3000 | Next.js 15, App Router, NextAuth v5 |
| Triage | `services/triage/` | 8001 | Groq classify + XGBoost cost + SHAP |
| Loadshedding | `services/loadshedding/` | 8002 | EskomSePush |
| Chatbot | `services/chatbot/` | 8003 | FAISS RAG + Groq |
| Dispatch | `services/dispatch/` | 8004 | Technician scoring |
| **Crew** | `services/crew/` | 8005 | CrewAI 3-agent triage (Module 3 extension) |
| **Sentiment** | `services/sentiment/` | 8006 | Follow-up comment scoring (Module 10) |
| Dashboard | `dashboard/` | 8501 | Streamlit, 6 pages |
| DB | `packages/db/` | — | Prisma schema + migrations |
| ETL | `etl/` | — | Bronze→Silver→Gold + Airflow DAGs |

---

## Conventions that get violated if you don't read them

**Prisma schema** (`packages/db/prisma/schema.prisma`)
- `cuid()` ids. `@map("snake_case")` on every multi-word field, `@@map("plural_table")`,
  `@@index` on status/FK/date columns.
- **Zero enums.** Enumerated values are `String` + `@default()` + a `// a | b | c` comment.
- **`Job.status` is lowercase**: `open | assigned | in_progress | complete | cancelled`.
  Querying `"Complete"` matches zero rows silently — this has already happened once.
- `Inquiry.assignedJobId` is `@unique` (1:1). A job can have only one inquiry. Link follow-up
  issues via `FollowUp.followUpInquiryId`, not by reusing `assignedJobId`.
- `Inquiry` has `urgencyScore Float?` (0.0–1.0), **not** a string `urgency`.
- Migrations are **hand-authored** in the existing style. `npm run db:migrate` is hardcoded
  `--name init` — do not use it. Use `npx prisma migrate deploy`.

**FastAPI services** — clone `services/dispatch/` as the template.
- Every service: `sys.path.insert(0, "../..")` then imports from `security/`.
- `apply_security_middleware(app, enable_api_key=True, cors_origins=[...], security_logger=sec_log)`
  with `sec_log` constructed **before** that call.
- Health route MUST be `/<service>/health` (suffix-matched to stay unauthenticated).
- Pydantic inputs: `extra="forbid"`, `str_strip_whitespace=True`, `max_length`, and
  `sanitize_prompt_input` on anything reaching an LLM.
- Dockerfiles build from **repo root** context so `security/` can be copied in.
- Never raise `HTTPException` inside `BaseHTTPMiddleware.dispatch()` — Starlette's
  `ExceptionMiddleware` sits *inside* user middleware, so it surfaces as 500 not 401.
  Return `JSONResponse` directly.

**Frontend** — strict separation so UI can be redesigned (v0.dev) without touching logic.
- `src/lib/api/*.ts` = data fetching, no React. `src/hooks/*.ts` = headless state, zero markup.
  `src/components/**` = presentation only.
- **Never** put an API key in a `NEXT_PUBLIC_*` var. Services are API-key gated, so browser calls
  go through a same-origin proxy route in `src/app/api/*/route.ts` holding `INTERNAL_API_KEY`.
- Proxy routes must `try/catch` the `fetch` and return **503**, not let ECONNREFUSED become a 500.
- Tailwind tokens: `brand-*` (amber) and `industrial-*` (slate). Do not introduce a new palette.
- Fonts via `next/font` — **never** hand-write `<head>` in App Router (React 19 hoists `<link>`
  and breaks hydration).

**Airflow** — DAGs go in `etl/dags/`, NOT `airflow/dags/`. `docker/Dockerfile.airflow` builds
with context `./etl` and bakes `COPY dags/`; anything in `airflow/dags/` is never deployed.
Use `schedule_interval` (not `schedule`), `PythonOperator` (no TaskFlow anywhere), SQLAlchemy
`create_engine` + `text()`.

**Testing** — `pytest.ini` sets `--import-mode=importlib`, `testpaths = services`. Each service has
`test_health.py` loading `main.py` by explicit path (all share the basename). Standard tests:
health reachable unauthenticated (200), main endpoint 401 without API key.

**CI** — `ci.yml` installs *all* service requirements into ONE env, so a heavy dependency
collides across services. That is why CrewAI has its own isolated `test-crew` job (it conflicts
with triage's `numpy<2.5`, required by shap's numba). Both workflows trigger on push to `main`
**and** on PRs targeting `main` — so open a PR to get verification.

---

## Recurring bug class: the silent no-op

Three separate instances found. Look for this pattern:
1. `status = "Complete"` vs lowercase `complete` — query matched zero rows, reported success.
2. `POST /loadshedding/subscribe` ran `UPDATE ... WHERE phone = :phone` and returned
   `{"status":"subscribed"}` regardless of `rowcount`. Now returns `matched`.
3. Docker healthchecks used `curl`, absent from `python:3.12-slim` and `node:20-alpine`. Probes
   exited −1, every service was permanently `unhealthy`, and `depends_on: service_healthy` could
   never resolve — which *looked* like a startup-ordering problem. Now uses `python -c` / `node -e`.

Also fixed: `SecurityLogger` was instantiated but never called (dead audit logging);
CSP forbade `unsafe-eval`, killing React Fast Refresh and therefore all hydration in dev
(`next.config.ts` now branches on `NODE_ENV`; production stays strict).

---

## Verification commands

```bash
# Python
python -m flake8 services/ etl/ --count --select=E9,F63,F7,F82 && python -m black --check services/ etl/
pytest services/ -v

# Frontend  (NEVER run `npm run build` while `next dev` is running — both write .next/ and it corrupts)
cd frontend && npx tsc --noEmit && npx eslint . --max-warnings 0 && npm run build

# Schema
cd packages/db && npx prisma validate

# Stack
docker compose config && docker compose up -d
```

**Local env note:** dev machine runs Python 3.14; containers are 3.12. CrewAI needs <3.14, so
verify crew in Docker, not locally. Port 5432 is often taken by another project's
`community-ride-db` — our postgres then fails to bind.

---

## State as of 2026-07-26

**On `main` (`8087630`):** structural fixes, security hardening across all services, XGBoost quote
estimator (**MAE R11,280.65 · R² 0.5121 · CV MAE R10,393.38**, 108/27 split, synthetic data), the
landing page, CrewAI crew (PR #12), and Module 10 + testimonials + alert signup + the Docker
healthcheck fix (PR #13). CI green on both pipelines.

**Open:**
- **Module 10 migration written but NOT applied**:
  `packages/db/prisma/migrations/20260726000000_followup_agent/` → `npx prisma migrate deploy`.
- **Module 10 Parts E (ML) and F (dashboard page)** deferred until follow-up data exists.
- **Module 11 (AWS)** planned, not started: sentiment → Lambda + Function URL, triage artifacts
  → S3, secrets → SSM Parameter Store, budget alerts first. ~$5/mo ceiling. Critical prerequisites:
  `.gitignore` has **no** `*.tfstate` / `.terraform/` / `*.tfvars` patterns (local state would be
  committable), and `API_KEY_HASHES` **must** be set or the public Function URL accepts
  `rams-elec-frontend-2026`, which is committed in this repo.
- **GitHub Dependency Review fails** on every PR — repo setting, not code. Enable Dependency graph
  in Settings → Code security.
- **v0.dev credits (~$4)** unspent; `HeroSection` and `SecurityTrustSection` untouched by v0.
- Three untracked scratch files (`create_project.graphql`, `proj_id.txt`, `project_columns.json`)
  are leftover GitHub Projects tooling — safe to delete or gitignore.

**Assistant permissions:** PR *merging* is blocked by the safety classifier (the user runs it);
PR *creation*, pushing and committing are fine. Never handle AWS keys or any credential.

See `docs/build-journal.md` for the full chronological record and reasoning behind each decision.
