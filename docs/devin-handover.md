# Rams @Elec Intelligence Platform — Agent Handover Brief

**Prepared 2026-09-06.** Paste this whole file as the opening prompt for a new coding agent
session, or point the agent at it in-repo. It is written to be read cold.

---

## 0. Your role

You are taking over an in-flight project. It has a working manual already committed at
**`CLAUDE.md` in the repo root — read that file before touching anything.** It carries the
architecture, the conventions that get violated if you don't read them, a recurring bug class
specific to this codebase, and the verification commands. This brief covers what `CLAUDE.md`
does *not*: current branch/PR topology, work that is uncommitted, context that lives outside
the repo, and known inconsistencies waiting to bite.

`CLAUDE.md` is self-maintaining by instruction: **update it in the same commit as any change
that affects it**, without being asked. If it drifts, the next session starts blind.

---

## 1. What this is and why it exists

An AI platform for **Rams @Elec**, a real South African electrical & refrigeration company
(Gauteng + Limpopo). It replaces a static brochure site.

It is simultaneously **portfolio evidence** for Dingaan Mahlatse Machethe — dual MSc candidate
(Data Science, UEL; Cybersecurity/Cloud Security Architecture, EC-Council University) — targeting
Data Science / AI Engineering / ML Engineering / Cloud Security roles. It is linked publicly on
LinkedIn and shown to recruiters.

Two layers in one repo:

1. **The product** — Next.js frontend, 6 FastAPI microservices, Prisma/Postgres, Airflow ETL,
   Streamlit dashboard, n8n automations.
2. **A DevSecOps/coursework overlay** — ECCU510 (Secure Programming) and ECCU524 (Cloud Security).

> **"Module" is overloaded.** Product modules 1–11 are NOT SecureDevOps modules 1–5.
> Product Module 3 = AI Triage Engine; SecureDevOps Module 3 = CI/CD.

### The non-negotiable principle: honesty over impressiveness

The repo's actual differentiator is that **every claim is verifiable**. This is worth more than
any feature. Things that have been *deliberately refused* — do not helpfully undo them:

- **No fabricated statistics.** Four unsourced figures were removed from the risk section.
  Restore only with attribution.
- **No invented testimonials.** `REAL_TESTIMONIALS` is an empty array. Samples are hard-gated
  behind `NODE_ENV === "development"` so the bundler strips them from production. Fake
  testimonials on a commercial site breach the Consumer Protection Act.
- **No untrained models presented as trained.** `metrics.json` carries
  `data_source: "synthetic_etl_pipeline"` and the UI renders that disclosure. The
  failure-recurrence model refuses to train below 100 labelled follow-ups — there are zero.
- **Designed ≠ deployed.** `terraform/` (Azure) is labelled designed-not-provisioned.
  `terraform/aws/` is meant to run but **has never been applied**. Do not blur either.

If you are ever choosing between an impressive claim and a defensible one, choose defensible,
and say plainly what is not done.

---

## 2. Current state — read carefully, it is messier than it looks

`main` is at **`8087630`** and has not moved since **2026-07-26**. Everything below is either
unmerged or uncommitted.

### 2.1 Four open PRs, none merged

| PR | Branch | Ahead of main | Contains | Status |
|---|---|---|---|---|
| #14 | `feat/module-11-aws-prep` | 1 | fail-closed API key gate, budget guardrails | MERGEABLE / UNSTABLE |
| #15 | `feat/module-11-lambda` | 6 | #14 + sentiment on Lambda + Function URL + README/CI fixes | MERGEABLE / CLEAN |
| #16 | `claude/zen-sinoussi-3f9971` | 2 | Azure Terraform: 7 real type errors + `terraform-azure` CI job | MERGEABLE / UNSTABLE |
| #17 | `feat/module-11-lambda-followup` | 8 | #14 + part of #15 + follow-up trigger Lambda + EventBridge | MERGEABLE / CLEAN |

**The topology is not a clean stack.** #15 and #17 have diverged:

- Both contain `1ed191c` (#14's commit), `369ea55` (#15's core), and `9c22113`.
- **#15 has 3 commits #17 does not:** `e4c5ff6` (README rewrite), `a6f4ccb`, `0082bf2` (CI fixes).
- **#17 has 5 commits #15 does not:** the follow-up trigger, a pg8000 CVE bump, docs.

So neither supersedes the other. `backup/pr17-prerebase` exists, indicating #17 was rebased.

**Suggested merge order (verify before acting):** #15 → rebase #17 onto main → #16.
#16 touches `ci.yml` and `CLAUDE.md`, which #17 also touches; expect conflicts there.
Merging #15 delivers #14's commit, which should leave #14 empty — confirm and close it rather
than merging it separately.

**Merge order is a security matter, not tidiness.** #15/#17 ship a public Lambda Function URL
with `authorization_type = "NONE"`. The fail-closed API key gate in `1ed191c` is what stops that
endpoint accepting `rams-elec-frontend-2026` — a key printed in this repository. Never land the
Function URL without that commit already in.

### 2.2 Large uncommitted working tree

Current branch is `feat/module-11-lambda`. On top of it sit **18 modified + 8 new files**,
uncommitted and unpushed — ~460 added lines plus several new modules:

```
NEW:  terraform/aws/sagemaker.tf            (161 lines)
      terraform/aws/glue.tf                 (127 lines)
      etl/loaders/s3_loader.py              (90 lines)
      etl/extractors/textract.py            (238 lines)
      services/crew/benchmark_bedrock.py    (290 lines)
      services/triage/sagemaker/            (train.py, launch_training_job.py, reqs)
      .github/workflows/sagemaker-train.yml (80 lines, workflow_dispatch only)

MOD:  services/triage/main.py   — MODEL_BACKEND=local|sagemaker switch
      services/crew/agents.py   — accepts bedrock/<model-id> as a second LLM backend
      etl/extractors/pdf.py, etl/dags/, terraform/aws/{variables,outputs,README}
      .env.example and several per-service .env.example / requirements files
```

**This work is green locally:** `py -3.14 -m pytest services/ tests/` →
**41 passed, 8 skipped** (2m23s). It has never been pushed, so CI has never seen it.

**First substantive task: get this committed and into a PR.** It is a lot of unbacked work
sitting on one laptop.

### 2.3 Context that lives OUTSIDE the repo — commit it

The uncommitted work implements a phased plan that **is not in the repository**:

```
C:\Users\lenovo\.windsurf\plans\ramsatelec-aws-vendor-1671c1.md
```

It is referenced from `.env.example` ("Phase 0 of ramsatelec-aws-vendor-1671c1.md") and from
`services/triage/sagemaker/launch_training_job.py` — so the repo points at a file nobody else
can see. **Copy it into `docs/` and commit it early**, then fix those references.

Summary of that plan — "AWS Vendor Upgrade", mapping an Azure ML/Data plan onto AWS-native
services, serverless-only, under a raised-but-tiny cost ceiling:

| Phase | Scope | Status |
|---|---|---|
| 0 | S3 Gold Parquet + Glue Crawler/Catalog + Athena | **built, uncommitted** (`glue.tf`, `s3_loader.py`) |
| 1 | SageMaker Training Job + Model Registry + Serverless Inference | **built, uncommitted** (`sagemaker.tf`, `services/triage/sagemaker/`, `MODEL_BACKEND` switch, `sagemaker-train.yml`) |
| 2 | Textract fallback for scanned job cards | **built, uncommitted** (`etl/extractors/textract.py`) |
| 3 | Bedrock as a second CrewAI backend + comparison doc | **partly built** — `agents.py` accepts `bedrock/<id>`, `benchmark_bedrock.py` exists; **the comparison doc has never been generated** |
| 4 | Streamlit page reading Athena instead of Postgres | **not started** (`dashboard/pages/aws_insights.py` does not exist) |
| 5 | Streaming (EventBridge/Kinesis) + champion-challenger rollout | **not started** |

The plan's naming drifted from what was built: it specifies `services/crew/llm_backend.py`
(built as `agents.py`) and `docs/groq-vs-bedrock-comparison.md` (referenced as
`docs/benchmarks/bedrock-vs-groq.md`). Reconcile the plan to reality when you commit it rather
than leaving both versions in play.

---

## 3. Known landmines — verify each before building on it

1. **Region split-brain.** PR #17 sets `aws_region` default to **`af-south-1`**. The working
   tree, `.env.example` (`AWS_REGION=eu-west-1`), and `services/triage/main.py`'s
   `boto3.client(..., region_name=os.getenv("AWS_REGION", "eu-west-1"))` all still say
   **`eu-west-1`**. Reconcile to one value before any apply — a Lambda in one region reading
   SSM in another fails at cold start. The standing preference for this project is
   **af-south-1**.

2. **Two coexisting SSM path schemes** in `terraform/aws/main.tf`: `local.ssm_config_path`
   (`/rams-elec/sentiment/`) and `local.param_prefix` (`/rams-elec/<env>`). Both are
   referenced, so neither can just be deleted. Target shape is `/rams-elec/<env>/<service>/`.
   **This is not a cosmetic rename** — `services/sentiment/lambda_handler.py` derives its
   environment-variable names from the path segment after the final `/`, so changing the path
   silently changes which variables it reads. Needs its own change and test run.

3. **`docs/benchmarks/bedrock-vs-groq.md` is referenced in 3 places and does not exist.**
   It is generated by running `benchmark_bedrock.py`, which needs real Bedrock credentials and
   spends real tokens. Until it is run those are dead links — generate it or mark the
   references as pending.

4. **CLAUDE.md's "State as of" section is dated 2026-07-26** and predates everything in §2.2.
   Update it as part of the first commit.

5. **Dependabot security updates are still disabled** on the repo. Dependency graph is on (so
   Dependency Review works), but Dependabot is what would have raised the pg8000 CVE as a PR
   rather than it being caught late. One toggle in Settings → Code security.

6. **Three untracked scratch files** — `create_project.graphql`, `proj_id.txt`,
   `project_columns.json` — are leftover GitHub Projects tooling. Safe to delete or gitignore.
   Do not commit them.

---

## 4. The recurring bug class in this codebase: the silent no-op

Four instances found so far. **Look for this pattern first in any review:** an operation that
fails, or does nothing, while reporting success.

1. `status = "Complete"` vs lowercase `complete` — query matched zero rows, reported success.
2. `POST /loadshedding/subscribe` returned `{"status":"subscribed"}` regardless of `rowcount`.
3. Docker healthchecks used `curl`, absent from every base image — probes exited −1, every
   service was permanently `unhealthy`, and it *looked* like a startup-ordering problem.
4. Dependency Review failing on every PR because a repo setting was off, not because of code.

The inverted form matters just as much: **a missing configuration that succeeds while providing
no protection.** Unset `API_KEY_HASHES` authenticated everyone; absent gitignore patterns
protected nothing. Neither produces an error, a failed test, or a log line.

A test that is silently never collected is the same class. `ci.yml` passes paths to pytest
**explicitly**, which overrides `pytest.ini`'s `testpaths` — add a new test directory in both
places or it will never run in CI while appearing to pass.

---

## 5. Hard constraints

- **Never handle credentials.** No AWS access keys, no Groq API key, no secrets — not in files,
  not in commands, not in Terraform variables. SSM SecureStrings are created out of band by the
  user with `aws ssm put-parameter`. A value passed through Terraform lands in
  `terraform.tfstate` in plaintext, which defeats the point of encrypting it.
- **Nothing has been applied to AWS.** No account has been touched. Do not run
  `terraform apply`. The first apply is the user's decision and follows the documented order in
  `terraform/aws/README.md`: build package → `apply -target` the budget alone → create SSM
  parameters by hand → `apply` the rest.
- **Every billable AWS resource must carry `depends_on = [aws_budgets_budget.monthly_cost]`.**
  The cost guardrail exists before the things it guards, deliberately.
- **Budget ceiling is $8/month + $1/day** (raised from $5 when Glue was added). AWS Budgets
  *alerts*; it does not cap. Keep additions inside that shape.
- **Do not run `npm run build` while `next dev` is running** — both write `.next/` and it corrupts.
- **Do not use `npm run db:migrate`** — it is hardcoded `--name init`. Use `npx prisma migrate deploy`.
- PR **creation**, pushing, and committing are fine. **Merging is the user's call.**

---

## 6. Outstanding work, roughly prioritised

**Immediate — unblocks everything else**

1. Commit and PR the §2.2 working tree. Copy the plan doc out of `~/.windsurf/plans/` into
   `docs/` first, so the references resolve.
2. Resolve the merge topology in §2.1 and get `main` moving again — it has been frozen for
   six weeks.
3. Reconcile the region split-brain (§3.1).

**Then**

4. Apply the Module 10 migration:
   `packages/db/prisma/migrations/20260726000000_followup_agent/` → `npx prisma migrate deploy`.
   Blocked locally because port 5432 is often held by another project's `community-ride-db`
   container; remap our host port rather than stopping theirs.
5. Unify the SSM path schemes (§3.2) — its own change, its own test run.
6. Module 10 Part F (follow-up dashboard page). Part E (failure-recurrence model) is
   **correctly blocked** — zero labelled follow-ups, and the model refuses to train below 100.
   Do not train it on synthetic data to unblock yourself.
7. Plan Phases 4 and 5 (Streamlit-on-Athena; streaming + champion-challenger).
8. Generate the Bedrock-vs-Groq comparison doc — needs real credentials, so the user runs it.

**Low priority**

9. `terraform/` (Azure) validation is addressed by PR #16 — 7 real errors found, including
   `delegated_zone_id` → `delegated_subnet_id`.
10. ~$4 of v0.dev credits unspent; `HeroSection` and `SecurityTrustSection` are the sections v0
    has not touched. Presentation-layer only — `src/lib/api` and `src/hooks` keep logic
    separate, so a v0 pass changes no behaviour.

---

## 7. Verification — run these before claiming anything works

```bash
# Python — use `py -3.14`, NOT bare `python` / `pytest`.
py -3.14 -m flake8 services/ etl/ --count --select=E9,F63,F7,F82
py -3.14 -m black --check services/ etl/
py -3.14 -m pytest services/ tests/ -v          # expect 41 passed, 8 skipped (~2.5 min)

# Frontend
cd frontend && npx tsc --noEmit && npx eslint . --max-warnings 0 && npm run build

# Schema
cd packages/db && npx prisma validate

# Stack
docker compose config && docker compose up -d
```

**Local environment gotcha:** the dev machine has two Pythons and the wrong one is on PATH.
`py -3.14` has the app dependencies; bare `pytest.exe` resolves to **3.13**, which has pytest
and nothing else, so every service test dies at `ModuleNotFoundError: No module named 'jwt'`
during collection. That is a PATH artifact, not a broken test.

`terraform` is **not installed locally** — `fmt -check` and `validate` run only in CI. Both
workflows trigger on PRs targeting `main`, so **open a PR to get verification.** Note that
`black --check` in CI covers `services/ etl/` only; `security/` has never been black-formatted
and 7 files there would be reformatted if the scope were widened.

CrewAI needs Python <3.14, so its tests skip locally and run in Docker / their own CI job.

---

## 8. If you are unsure

Ask rather than assume — especially about spending money on AWS, merging, anything touching
credentials, and anything that would weaken a claim in §1. The user is the sole operator, is
using this repo as public evidence of their work, and would rather ship less that is true than
more that is not.
