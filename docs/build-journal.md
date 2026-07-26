# Build Journal

Maintained per `CONTRIBUTING.md` — updated after each module with what was built, key decisions, challenges, and lessons learned.

---

## Structural Foundation Fix — 2026-07-25

### What was built

`docker-compose.yml`, CI (`.github/workflows/ci.yml`), and the security scan pipeline (`.github/workflows/security.yml`) were fixed to match the repo's real layout and to actually run end-to-end, instead of silently failing:

- `docker-compose.yml`'s `web` and `streamlit` services pointed at empty scaffold directories (`apps/web`, `apps/dashboard`) left over from an earlier structure; real code lives in `frontend/` and `dashboard/`. Build contexts corrected.
- `services/triage` and `services/dispatch` import the repo-root `security/` package (Module 2 hardening — JWT auth, rate limiting, input validation, audit logging) via a relative `sys.path.insert`, but their Dockerfiles built from a per-service context that didn't include `security/`. Both Dockerfiles now build from repo root, mirroring the on-disk layout inside the image so the existing relative-import logic in `main.py` keeps working unmodified. Added a root `.dockerignore` since this widens the build context.
- `security/auth/api_key_middleware.py` exempted the literal path `/health` from API-key checks, but every service mounts its health check under its own prefix (`/triage/health`, `/dispatch/health`, etc.) — so the API-key gate was silently blocking Docker's own `HEALTHCHECK` on every hardened service. Changed to a suffix match.
- `security/auth/jwt_middleware.py`'s dependency, PyJWT, was missing from `triage` and `dispatch`'s `requirements.txt` — `security.setup` imports it unconditionally, so both services would have failed to start regardless of the Docker fix above. Added.
- `ci.yml` and `security.yml` both referenced `apps/web` (empty) instead of `frontend`, and built two dead/orphaned Dockerfiles (`docker/Dockerfile.web`, `docker/Dockerfile.fastapi`) that hardcoded the same wrong paths. Deleted both files; CI and the Trivy container-security scan now build the seven real images (`frontend`, `triage`, `dispatch`, `loadshedding`, `chatbot`, `dashboard`, `airflow`) directly — so the container security scan that's part of the Module 3 DevSecOps story now actually scans what would be deployed, not two placeholder images.
- `pytest services/` was collecting zero tests (none existed) and failing non-zero by default. Added a `test_health.py` smoke test per service (FastAPI `TestClient` against each real health endpoint) — minimal, but for `triage`/`dispatch` it doubles as a regression guard that the app still imports and mounts `security/` correctly. Added a root `pytest.ini` (`--import-mode=importlib`) since all four services share the basename `test_health.py` and aren't Python packages.
- `test-python` in `ci.yml` only installed `triage`/`loadshedding` requirements; added `chatbot`/`dispatch` so the full `services/` tree can actually be collected and run.

### Key decisions

- Kept `loadshedding` and `chatbot` on their existing per-service Docker build context — they don't import `security/` yet, so widening their context wasn't needed for this pass. Wiring them into the Module 2 hardening is next.
- Chose explicit `docker build` commands over a single `docker compose build` in CI, matching how the pre-existing Trivy scan step needed individually tagged images anyway — one build definition per artifact, mirrored identically between `ci.yml` and `security.yml`.

### Lessons learned

The five graded coursework modules were internally consistent (audit → hardening code → CI → cloud docs → doc pass), but nobody had exercised the full pipeline end-to-end against the actual repo layout — the `apps/` vs `frontend/`/`dashboard/` split happened after the compose/CI files were written and was never propagated. "The security middleware exists and is imported" and "the container that ships actually starts up with it" turned out to be two different claims — worth a real `docker-compose up` + `scripts/integration_test.py` run as a standing check going forward, not just code review.

---

## Security Hardening — chatbot & loadshedding, and a real bug in the existing middleware — 2026-07-25

### What was built

Extended the Module 2 security pattern (already live on `triage`/`dispatch`) to the two remaining services, and fixed a defect in the shared middleware that testing this properly for the first time surfaced:

- `chatbot` and `loadshedding` now call `security.setup.apply_security_middleware` instead of a wildcard-CORS `CORSMiddleware`. `chatbot`'s `ChatRequest.message` — the highest-risk field in the repo, since it's injected straight into an LLM prompt — is now routed through `sanitize_prompt_input`, and its `conversation_history` is filtered to `role in {"user","assistant"}` with sanitised content only (previously a client could inject a fake `"role": "system"` message to override the system prompt). `loadshedding`'s `/subscribe` body is now `extra="forbid"` with SA-phone and area-zone whitelist validation.
- Both services' Dockerfiles/build contexts widened to repo root, same reasoning as `triage`/`dispatch`'s fix above (they now import `security/` too). `pyjwt` added to both `requirements.txt` (same latent gap as before — `security.setup` imports it unconditionally).
- **`sec_log = SecurityLogger(...)` was dead code in `triage`/`dispatch`** — instantiated, never called anywhere, despite both services' docstrings claiming "Audit logging: SecurityLogger emits structured JSON to stdout + DB." Rather than copy that gap into two more services, `security/setup.py` now accepts a `security_logger` param and wires it into every middleware: `APIKeyMiddleware` and `JWTAuthMiddleware` now log `AUTH_FAILURE`/`AUTH_SUCCESS`/`API_KEY_USAGE`, `RateLimiterMiddleware` logs `RATE_LIMIT_HIT`, and a new `RequestValidationError` handler logs `VALIDATION_FAILURE` on every Pydantic rejection. All four services construct `sec_log` before calling `apply_security_middleware` and pass it through.
- **Found via testing, not review**: raising `HTTPException` from inside a `BaseHTTPMiddleware.dispatch()` (the pattern all three middleware classes used) does not get converted to a proper error response by Starlette — `ExceptionMiddleware`, which does that conversion, sits *inside* user-added middleware in the stack, so the exception propagates past it and would have surfaced as an unhandled 500 in production instead of 401/429. `api_key_middleware.py`, `rate_limiter.py`, and `jwt_middleware.py` now return `JSONResponse` directly. Caught by a new test (`test_recommend_rejects_requests_without_api_key`) that actually asserted on the status code instead of just checking the endpoint was "protected."
- A second bug in my own new validation-failure handler, caught the same way: `RequestValidationError.errors()` can contain a raw `ValueError` object (in `ctx.error`), which isn't JSON-serializable — `JSONResponse(content={"detail": exc.errors()})` crashed with a 500 the first time a validator actually rejected something. Fixed with `jsonable_encoder`, the same way FastAPI's own default handler does it.
- Also fixed: `RateLimiterMiddleware`'s exempt-path check had the identical `/health` vs `/triage/health` suffix bug as `api_key_middleware.py` (fixed in the prior entry) — Docker's `HEALTHCHECK` could eventually have been rate-limited.
- Real security-behavior tests added per service (not just health checks): API-key rejection on a real business endpoint for all four services, area-zone validator rejection for `loadshedding`, prompt-injection sanitisation for `chatbot`.

### Key decisions

- Centralised `security_logger` wiring in `security/setup.py` rather than duplicating call sites in each service — one place to get right, four services get it for free.
- Reused `log_auth_failure(source_ip, email, reason)` for API-key rejections (passing `email=""`) rather than adding a new `SecurityLogger` method — `SecurityLogger`'s method set was designed around user auth events; API keys don't have an email, but the shape (who/why) still fits well enough that a new near-duplicate method wasn't justified.

### Lessons learned

Every middleware bug in this entry was invisible from reading the code — `apply_security_middleware(app, enable_api_key=True, ...)` looks correct, the 401 `HTTPException` looks correct, the JSON response construction looks correct. All three only broke at the point a real HTTP request actually hit them. This is the same lesson as the previous entry, one layer deeper: passing code review and "the middleware is wired in" are not the same claim as "a request to this endpoint gets the response the code says it gets" — the only way to know the latter is to send the request.

---

## Flagship ML Feature — Quote Estimator, real metrics, published Result — 2026-07-25

### What was built

The AI Triage Engine's XGBoost quote estimator already existed (`services/triage/train_model.py`, `services/triage/main.py`'s `/triage/estimate-cost`) but its evaluation metrics only ever went to MLflow — nowhere a case study, dashboard, or recruiter could see them. This pass made the metrics real, traceable, and published:

- **`services/triage/feature_encoding.py`** (new): single source of truth for `FEATURE_COLS`, `CATEGORY_MAP`, `ZONE_MAP`. Before this, `train_model.py` and `main.py`'s `_build_features()` each hardcoded their own copy of the same maps — harmless only by coincidence, since a model's category/zone encoding at training time must exactly match inference-time encoding or predictions are silently wrong (the model never learns "3 means electrical", it just learns column-value-3 correlates with certain costs). The ETL Gold layer (`etl/transformers/gold.py`) encodes the same columns independently by sorting whatever categories appear in a given batch — that encoding is only self-consistent within one run, and is *not* used for this model; `encode_features()` maps through the fixed dict instead.
- **`train_model.py`**: `load_training_data()` now falls back to running the real synthetic-data generator (`etl/scripts/generate_seed_data.py`) through the actual Bronze→Silver→Gold ETL pipeline when no database is reachable or no completed jobs exist yet — reused, not duplicated. Added a synthetic `install_date` (the generator only produces job records, not an equipment registry) so `equipment_age_years` carries real variance instead of silently being an all-zero feature. Writes `services/triage/model/metrics.json` after every run — the one artifact in `model/` that *is* meant to be committed (`.gitignore` excludes `*.pkl`; the trained binary is a build artifact, the metrics are the published claim).
- **`GET /triage/model-metrics`** (new, `main.py`): read-only, serves `metrics.json` — never trains or recomputes. Behind the same API-key gate as every other triage endpoint.
- **Frontend logic layer** — deliberately zero markup, since v0.dev owns the UI layer separately: `frontend/src/lib/api/triage.ts` (typed fetch client), `frontend/src/hooks/useModelMetrics.ts` (headless state hook), `frontend/src/app/api/model-metrics/route.ts` (Next.js route handler holding the server-only `INTERNAL_API_KEY` — the triage service's API key must never reach the browser via a `NEXT_PUBLIC_*` var, so the browser calls this same-origin route, which calls triage server-side).

### Real result (synthetic data — see disclosure below)

Trained on 135 completed synthetic jobs (108 train / 27 test) via the offline ETL fallback:

| Metric | Value |
|---|---|
| MAE | R11,280.65 |
| RMSE | R17,949.38 |
| R² | 0.5121 |
| CV MAE (5-fold) | R10,393.38 |

Top feature by XGBoost gain: `service_category_encoded`, well ahead of `month`/`urgency_flag`. R² of ~0.51 is honest, not impressive — `generate_synthetic_jobs()` draws cost from a wide `np.random.uniform` range per service type with no other structure, so a large share of the variance is irreducible noise by construction. This will read very differently once real client job data lands in `gold_jobs`; the `data_source` field in `metrics.json` (`"synthetic_etl_pipeline"` vs `"postgres:gold_jobs"`) makes which regime produced a given number unambiguous, always.

### Challenges

- SHAP's `numba` dependency rejected the NumPy version pip resolved for an unpinned `numpy>=1.26.0` (`numba needs NumPy 2.4 or less`) — real, reproducible on a fresh install, not a one-off. Already non-fatal (SHAP init is in its own `try/except` in both `train_model.py` and `main.py`), but pinned `numpy<2.5` in `services/triage/requirements.txt` anyway rather than leave it to chance which numpy pip happens to resolve.
- `etl/extractors/__init__.py` eagerly imports `PDFExtractor`, which needs `pdfplumber`, even though the fallback path only needs `ExcelExtractor` — added `openpyxl`/`pdfplumber` to `services/triage/requirements.txt` (mirroring `etl/requirements.txt`) rather than restructure the ETL package's `__init__.py` for one caller.
- The `test_health.py` harness (importlib-loaded, not a normal package import) didn't put the service directory on `sys.path`, so `main.py`'s new `from feature_encoding import ...` — its first-ever sibling-module import — broke test collection even though the identical import works fine under a real `uvicorn main:app`. Fixed in the harness, not the app code, since the app code is correct for how it's actually deployed.

### Lessons learned

Same theme as both prior entries: the parts of this that were hardest to get right were never the ML — they were the seams between systems written independently (main.py vs train_model.py's duplicated encoding maps, ETL package boundaries, a test harness that didn't fully replicate a real process's import context). None of that shows up in a training log that says "R² = 0.51, done." Verification has to include *loading the artifact the way the running system actually loads it*, not just confirming the training script exits zero.

---

## CrewAI Multi-Agent Triage (`services/crew`) — 2026-07-25

### What was built

A fourth service running the same triage as three collaborating CrewAI agents rather than three
sequential function calls, **alongside** the existing endpoints rather than replacing them.

- `services/crew/` — `tools.py` (three `@tool`s wrapping `/triage/classify`,
  `/triage/estimate-cost`, `/dispatch/recommend` over HTTP with `X-API-Key`), `agents.py`,
  `tasks.py` (chained via CrewAI `context=[...]`), `crew.py`, `main.py` (FastAPI :8005).
- `benchmark.py` — runs identical inquiries down both paths, recording latency, LLM calls,
  tokens, and whether the crew's narrated cost matched the model's actual output.
- Isolated `test-crew` CI job, crew image added to `docker-build` and the Trivy scan matrix.
- `docs/crewai-integration.md`.

### Key decisions

**Separate service, not `services/triage/crew/`.** Two hard blockers made the in-place version
the wrong call. First, `services/triage/main.py` builds its app, applies middleware, connects the
DB and calls `load_model()` at *import* time — a `crew/` package importing its helpers is a
circular import, so it would have forced a `core/` refactor of a working service just to add a
feature. Second, `ci.yml`'s `test-python` job installs all services' requirements into **one**
interpreter, so CrewAI's litellm/instructor tree would have had to reconcile with triage's
`numpy<2.5` pin (required by `shap`'s numba) in CI even though the containers are isolated. The
separate service dodges both, at the cost of one network hop per tool call — which the benchmark
measures rather than hides.

**Alongside, not replacing.** Keeping the sequential path gives a baseline to benchmark against,
and means a Groq outage degrades one path instead of taking triage down. The crew is slower and
more expensive per inquiry; presenting it as a straight upgrade would have been dishonest.

**Delegation disabled.** With `allow_delegation=True` an agent that struggles can hand its task
to another — which would let the classifier produce cost estimates without ever calling the
XGBoost tool. The deterministic work has to stay deterministic.

**`def`, not `async def`, for `/crew/process`.** `crew.kickoff()` blocks; FastAPI runs plain
`def` handlers in a threadpool. Every existing triage endpoint is `async def` while doing
entirely synchronous I/O — already blocking the event loop. Worth not copying.

### Two things worth keeping

**Inter-agent sanitisation.** The existing services sanitise input once at the HTTP boundary.
That is insufficient for a crew: Task 1's *output* becomes Task 2's *prompt*, so a payload that
survives classification is injected into the next agent's context without ever crossing the
boundary again. A `task_callback` now re-runs `sanitize_prompt_input()` on every task output and
logs when it changed something. It mutates `TaskOutput.raw` **in place** — returning a cleaned
copy would leave the downstream agent reading the original, which is subtle enough to warrant its
own test.

**The determinism guard.** `/triage/estimate-cost` returns an exact XGBoost figure; an agent that
narrates it can round R11,280.65 to "about R11,000". Tools now stash their untouched responses in
thread-local storage (thread-local, not a module global, because kickoff runs in FastAPI's
threadpool and concurrent requests would read each other's results), and after kickoff the
service compares the crew's reported cost against ground truth. On disagreement the tool's value
wins, `cost_estimate_overridden` is set, and a `SecurityLogger` event fires — turning an
invisible hallucination into a counted metric.

### Challenges

**CrewAI 1.15.6 requires Python <3.14; the dev box runs 3.14.** `pip install crewai` there
silently resolves to **0.11.2** — a 2024-era API with a completely different surface. The
containers are `python:3.12-slim`, so this only bites local work. I wrote the integration against
the real 1.x API by extracting the wheel and reading `crewai/__init__.py`, `crew.py`, `task.py`
and `tools/base_tool.py` directly, rather than from memory. Local verification is genuinely
impossible; container/CI verification is the only honest check.

**The shared `security` package required sqlalchemy to emit a log line.**
`security/logging/security_logger.py` imported `create_engine` and `text` at module scope, but
every service constructs `SecurityLogger(engine=None)` and only ever logs to stdout — the
database path is unreachable without an engine. That made the shared package unusable by any
service without a database, which the crew is. Moved the import into `_persist_to_db()`;
`create_engine` turned out to be imported and never used at all. Regression-tested dispatch and
loadshedding afterwards.

### Lessons learned

The interesting failure mode with agents is not that they break — it is that they *succeed
plausibly*. A crew that returns "approximately R11,000" for a job the model priced at R11,280.65
looks entirely correct in a demo and is wrong in a way no exception surfaces. Wrapping
deterministic components in an LLM means the determinism is now a claim you have to actively
verify, not a property you still get for free. That is the whole reason the guard and the
benchmark exist rather than just the crew.

---

## Module 10 — Post-Service Follow-up Agent (Parts A, B, C, D, G) — 2026-07-26

### What was built

A pipeline that captures equipment-failure signal from customers instead of sensors:

- **`FollowUp` table** (`packages/db/prisma/schema.prisma`) + a hand-authored migration in the
  existing house style. Also `Equipment.riskScore`/`riskScoredAt` for the future model to write
  into, and `Customer.followUpConsent`/`followUpConsentAt`. **Migration written, not applied.**
- **`etl/dags/followup_trigger_dag.py`** — daily DAG selecting completed jobs past their
  threshold (3 days urgent / 7 standard), creating `follow_ups` rows and calling n8n. Added
  `httpx` to `etl/requirements.txt`, which it needed and did not have.
- **`services/sentiment`** (:8006) — scores free-text comments and tags them against a fixed,
  closed taxonomy.
- **`n8n/workflows/followup_conversation_workflow.json`** — the YES/NO conversation, explicitly
  labelled as designed-not-provisioned.
- **`docs/followup-agent.md`**, plus README rows and a roadmap cross-reference.

### Five bugs in the original spec, found by checking it against the schema

None of these would have surfaced until runtime:

1. `status = "Complete"` matches **zero rows** — `Job.status` values are lowercase
   (`open | assigned | in_progress | complete | cancelled`).
2. `Inquiry.assignedJobId` is `@unique`, i.e. 1:1. The spec's "create a new Inquiry linked to
   the original job" would violate that constraint — the original job already consumed it. The
   join path is `Job <- FollowUp -> Inquiry` via the spec's own `followUpInquiryId`, so no
   schema change to `Inquiry` was needed.
3. `Inquiry` has no string `urgency` column; it has `urgencyScore Float?`. `urgency: "high"`
   doesn't map — follow-up issues use `urgency_score = 0.8`.
4. The proposed `FollowUp` model carried no `@map`/`@@map`/`@@index`, so it would have created
   camelCase columns in a database where every other table is snake_case.
5. `Equipment` had no risk field at all, though Part E writes `risk_score` back to it.

### Key decisions

- **POPIA consent is a schema field and a SQL precondition, not documentation.** `alertSubscribed`
  already existed but is scoped to load-shedding alerts; reusing it to justify satisfaction
  surveys is the consent-creep POPIA prohibits. The new `follow_up_consent` is filtered in the
  DAG's selection query, so a customer without consent is never *selected* — no downstream bug,
  replay, or refactor can message them, because there is no code path that skips the check.
- **The sentiment service does not trust its own LLM.** Themes outside the fixed taxonomy are
  discarded rather than coerced to `other` (a hallucinated theme is not evidence of that theme),
  the score is clamped to [-1.0, 1.0], and an `analyzed: false` flag distinguishes a real neutral
  score from a fallback one — so a Groq outage can't quietly write fabricated 0.0s into the
  database as though they were measurements.
- **Reused rather than rebuilt**: `NotificationLog` for message logging, `MaintenanceSchedule` as
  the risk-flagging target. Neither needed a parallel table.
- **The n8n workflow sends `X-API-Key`**, which the three pre-existing workflows do not — those
  predate the Module 2 hardening and would 401 today. Left them alone: fixing them is a separate
  change with its own testing, and burying it inside an unrelated module would hide it.

### Lessons learned

The spec was thoughtful — it even anticipated the cold-start problem with a 100-record training
guard. It was still wrong in five places, every one of which came from writing against a
*remembered* schema rather than the actual one. `status = "Complete"` is the sharpest example: it
would have deployed cleanly, run daily, found nothing, and reported success forever. A silent
zero-row query is much worse than a crash, because nothing ever tells you.

The other recurring theme: this module's honest output is a *pipeline*, not a model. The roadmap
already refuses to train on fabricated sensor data; training a failure-recurrence model on zero
follow-ups would be the same error wearing a different hat. What's shippable today is the thing
that generates valid labels — and saying exactly that, in the README and the docs, is the part
that keeps the rest of the claims credible.

---

## Fix: every Docker healthcheck was broken — 2026-07-26

### What was found

First time the stack ran on a real Docker daemon, all four services returned
`{"status":"healthy"}` from their own endpoints while `docker compose ps` reported every one as
`unhealthy`. Cause: all seven healthchecks were `["CMD", "curl", "-f", ...]`, and neither
`python:3.12-slim` nor `node:20-alpine` ships curl.

```
$ docker compose exec -T triage sh -c "command -v curl || echo 'CURL NOT FOUND'"
CURL NOT FOUND
$ docker inspect rams-elec-triage --format '{{range .State.Health.Log}}{{.ExitCode}}{{end}}'
-1   # exec: "curl": executable file not found in $PATH
```

Fixed by probing with the interpreter already in each image — `python -c` for the six FastAPI
services, `node -e` for `web` — rather than adding an apt layer to six images for a liveness check.

### Why it mattered more than it looked

`depends_on: condition: service_healthy` can never be satisfied if the probe can't execute. So
`docker compose up -d postgres triage loadshedding chatbot dispatch` started nothing and sat there.
The workaround at the time was `--no-deps`, which skips dependency ordering entirely — i.e. the
broken probe disguised itself as a startup-ordering problem, and the workaround hid the real cause.

After the fix, exit codes are `0` and both `dispatch` and `loadshedding` report `(healthy)` —
a state that was previously unreachable.

### Lessons learned

This is the **third** instance of the same bug class in this project: an operation that fails or
does nothing while reporting success. The other two were `status = "Complete"` matching zero rows
against lowercase data, and `/loadshedding/subscribe` returning `{"status":"subscribed"}` without
checking `rowcount`. All three were invisible in code review and only appeared when something
actually ran. The pattern is now recorded at the top of `CLAUDE.md` so it gets looked for first.

Also worth noting: I introduced one of the seven broken healthchecks myself, by copying the
existing pattern when adding `services/sentiment`. A wrong convention propagates silently, which is
why the fix carries an explanatory comment above the first healthcheck rather than just working.

### Project context persisted

Added `CLAUDE.md` at the repo root — architecture, the conventions that get violated, the
silent-no-op bug class, verification commands, and current open threads. Claude Code loads it
automatically each session, so returning to this project after a long gap (or handing it to
someone else) no longer depends on reconstructing intent from the diff.

---

## Module 11 (AWS): the two things that had to happen before any deployment — 2026-07-26

Module 11 puts the sentiment service on a Lambda Function URL. A Function URL is a public
HTTPS endpoint on the open internet — the first genuinely public surface this project has had.
Two prerequisites were identified while scoping it, and both were addressed before writing a
single line of deployment code, because both stop being fixable the moment they are exercised.

### Prerequisite 1: the API key middleware fell open, not closed

`security/auth/api_key_middleware.py` read `API_KEY_HASHES` from the environment and, when it
was unset, fell back to the SHA-256 hashes of three keys hardcoded in the file:

```python
API_KEY_HASHES_RAW = os.getenv("API_KEY_HASHES", ",".join([
    _hash_key("rams-elec-frontend-2026"), ...
]))
```

On a laptop this is a convenience — `docker compose up` works with no setup. On a Function URL
it is an open endpoint, because those three strings are committed to a public repository: in
that file, in `.env.example`, in `docker-compose.yml`, in `ci.yml`, and in five service test
files. Anyone who has read the repo can authenticate.

The instinct is to delete the defaults. That breaks local development and every service test,
which is presumably why they were there. The actual problem is not the defaults — it is that
the *absence of configuration* selected the permissive branch. So the branch is now selected by
`APP_ENV` instead:

- `development` (the default): unchanged behaviour, plus a warning.
- anything else: `API_KEY_HASHES` is required, and the module raises `RuntimeError` **at import**
  without it. A service that refuses to boot is a visible failure. A service quietly accepting a
  published key is not — which is the same silent-success bug class this project keeps finding,
  just pointed at authentication.

Two details worth keeping:

**Only the literal string `development` is permissive.** `staging`, `production`, a typo like
`prodution`, and an empty string all fail closed. An unrecognised environment must never be the
open branch — that is precisely the case nobody tests.

**Supplying a committed key's hash explicitly also fails.** Hashing a public string does not make
it a secret; the hash is as computable as the key. Without this check the natural deployment
mistake — copying `.env.example` forward and setting `API_KEY_HASHES` to what was already there —
would satisfy the new requirement while changing nothing. The check exists because the fix would
otherwise have been theatre.

`tests/test_api_key_env_gate.py` covers all of it, including end-to-end through the middleware:
with `APP_ENV=production`, `rams-elec-frontend-2026` gets a 401 through both the header and the
query-parameter path. This is the first test in the repo that belongs to no single service, hence
the new root `tests/` directory — added to `pytest.ini`'s `testpaths` *and* to the `ci.yml`
invocation, which passes paths explicitly and would otherwise have ignored `testpaths` and never
run them. A test that silently never runs is the same bug class again.

### Prerequisite 2: Terraform state was committable

`.gitignore` had no `*.tfstate`, `.terraform/`, `*.tfvars`, or `*.tfplan` patterns — the repo
predates having any Terraform that gets applied. `terraform apply` writes every attribute of
every resource into `terraform.tfstate` in plaintext, including generated passwords and anything
passed through a variable. One routine `git add -A` after the first apply would have committed
them to a public repository. Fixed before the first apply rather than after, because the remedy
afterwards is key rotation and a history rewrite.

The related rule, written into `terraform/aws/README.md`: nothing secret goes into a `.tfvars`
file, a variable, or an output. Runtime secrets go to SSM Parameter Store as `SecureString`,
created out of band. A secret routed through Terraform to keep it out of the repo lands in state
in plaintext instead — which is the same exposure with more steps.

### What was actually built: the budget, and deliberately nothing else

`terraform/aws/` currently contains two `aws_budgets_budget` resources and no billable
infrastructure at all. That is the finished state of this step, not a stopping point. A budget
created after a runaway resource tells you what you already owe.

The ordering is enforced twice, because Terraform's dependency graph has no concept of a
guardrail: procedurally via `terraform apply -target=aws_budgets_budget.monthly_cost` as its own
step, and structurally by requiring every billable resource added later to carry
`depends_on = [aws_budgets_budget.monthly_cost]`.

Two budgets, not one. The `$5` monthly ceiling is blind to the *shape* of the spend — `$5` spread
evenly across a month and `$5` burned in one afternoon by a misconfigured loop trip it at exactly
the same moment, but only one of those is still recoverable. A `$1` daily tripwire catches the
second case about a day in. The monthly budget's forecast alert does similar work from the other
direction: it fires on trajectory, days before the money is gone, which is the only alert that
arrives while there is still something to do about it.

Stated plainly in the README, because it is the kind of thing a cost guardrail is assumed to do
and does not: **AWS Budgets alerts on spend, it does not cap it.** Nothing in that module will
stop a charge. `aws_budgets_budget_action` can attach a deny-all IAM policy at 100%, which is the
only mechanism that genuinely halts spending — deliberately not used, on the grounds that locking
oneself out of the account has a larger blast radius than a $5 overrun on a portfolio project.
Recorded as a trade-off rather than silently omitted.

### Note on the repository's two Terraform roots

`terraform/` is Azure, designed for ECCU524 and **never provisioned**. `terraform/aws/` is
intended to actually run. Keeping them as separate root modules is partly mechanical — one state
file cannot sensibly hold two providers — but mostly it is to keep the claim honest. The Azure
config is an architecture document written in HCL, the README says so, and adding a directory
next to it that *does* get applied is exactly the situation where that distinction quietly erodes.
Both READMEs now name the difference explicitly.

Nothing has been applied. No AWS account has been touched.

### Lessons learned

Both prerequisites share a shape with the silent no-op class already catalogued in `CLAUDE.md`,
inverted: not an operation that fails while reporting success, but a *missing* configuration that
succeeds while providing no protection. Unset `API_KEY_HASHES` authenticated everyone. Absent
gitignore patterns protected nothing. Neither would have produced an error, a failed test, or a
line in a log — and both would have been discovered from the outside.
