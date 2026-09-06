# Rams@Elec AWS Vendor Upgrade — SageMaker, Glue/Athena, Bedrock, Textract

> **Provenance:** this plan originated outside the repo at
> `~/.windsurf/plans/ramsatelec-aws-vendor-1671c1.md` and was committed here
> so references from `.env.example` and `launch_training_job.py` resolve for
> anyone cloning the repo. Naming has been reconciled to match what was
> actually built (see "Naming reconciliation" at the end).

Extend Rams@Elec's already-real, budget-capped AWS module (`terraform/aws/`) with SageMaker, Glue/Athena, Bedrock, and Textract — the AWS-native equivalents of the Azure ML/Data Engineering/Data Science/Agentic AI plan drafted for EduPortal — while keeping every addition inside a raised but still tiny cost ceiling with the same guardrail discipline already in `budgets.tf`.

## Ground rules (carried over from the existing module)

- **Real, not designed-only.** Unlike `terraform/` (Azure, never applied), `terraform/aws/` is meant to actually run. Every new resource here follows that — genuinely deployable, genuinely cheap.
- **Serverless-only compute.** No always-on endpoints, clusters, or Studio domains. SageMaker Serverless Inference, Glue on-demand crawlers, Athena pay-per-query, Bedrock pay-per-token — nothing billed while idle.
- **Cost ceiling raised, not abandoned.** Current `$5`/month + `$1`/day tripwire in `budgets.tf` goes up to reflect the new resources, with the same `depends_on = [aws_budgets_budget.monthly_cost]` pattern on every billable resource.
- **No fabricated use cases.** Mirrors the project's existing honesty (see README's Phase 2 Roadmap declining IoT/CV without real data). The one CV addition here (Textract) is scoped to data that already exists (`etl/extractors/pdf.py` job cards) — nothing invented.

## Mapping: Azure plan (EduPortal) → AWS equivalent (Rams@Elec)

| Capability | Azure (EduPortal plan) | AWS (this plan) |
|---|---|---|
| Data Engineering | ADF + Databricks | **Glue Crawler + Glue Data Catalog + Athena** over S3 |
| ML platform | Azure ML (workspace, registry, endpoint) | **SageMaker** (Training Jobs, Model Registry, Serverless Inference) |
| Model serving (cost-safe choice) | Azure Function | Already have — **Lambda** (extend, don't replace) |
| Model monitoring | Custom `PredictionLog` table | **SageMaker Model Monitor** (or lightweight CloudWatch metric if Monitor's cost isn't justified at this scale) |
| Agentic AI / GenAI | LangChain/Semantic Kernel + CrewAI | Already have **CrewAI** — add **Bedrock** as a second LLM backend (vs. Groq), documented as a comparison |
| Computer Vision | Azure Document Intelligence (OCR) | **AWS Textract** on existing PDF job cards |
| Data Science / EDA | Recharts dashboard on Gold table | Already have **Streamlit** — repoint one page at **Athena** instead of Postgres |

---

## Phase 0 — Data Engineering: S3 data lake + Glue + Athena

**What:** the existing local Bronze→Silver→Gold pipeline (`etl/transformers/`) already writes to Postgres; add a parallel Parquet write of the **Gold** layer to the existing `artifacts` S3 bucket (or a new prefix in it), catalog it with a **Glue Crawler**, and query it with **Athena**. This becomes the read source for SageMaker training (Phase 1) and the Streamlit analytics page (Phase 4) — decouples ML/analytics reads from production Postgres.

- `terraform/aws/glue.tf` — Glue Database + Crawler (on-demand, not scheduled continuously) pointed at `s3://.../gold/`.
- `etl/loaders/s3_loader.py` (new) — writes Gold DataFrame to Parquet in S3 alongside the existing Postgres upsert (both, not instead of).
- Athena queries used ad hoc from Streamlit (Phase 4) and as SageMaker's training data source (Phase 1).
- **Cost:** Glue Crawler ~$0.44/DPU-hour, run on-demand for a couple of minutes ≈ cents per run. Athena $5/TB scanned — this dataset is MB-scale, so functionally free. S3 storage negligible (already budgeted).

**Status:** built (`glue.tf`, `s3_loader.py`, ETL DAG updated).

---

## Phase 1 — SageMaker: Quote Estimator, done the AWS-native way

**What:** the existing XGBoost quote estimator (`services/triage/train_model.py`, MAE R11,280 / R² 0.512) currently trains locally and is tracked in MLflow. Add a SageMaker path alongside it — not a replacement, a second, AWS-native training/serving route reading from the Phase 0 Gold table.

- **Training:** SageMaker Training Job (XGBoost built-in container or bring-your-own script) reading Gold Parquet from S3, triggered manually or via GitHub Actions — a few minutes, ml.m5.large ≈ cents per run.
- **Model Registry:** register the trained model as a SageMaker Model Package (versioned), separate from the MLflow tracking already in place — MLflow keeps experiment history, SageMaker Registry is the deployable artifact.
- **Serving:** **SageMaker Serverless Inference** endpoint (not real-time — zero cost while idle, pay per invocation + duration). `services/triage/main.py` gets a `MODEL_BACKEND=sagemaker|local` switch so the existing Lambda/local path keeps working as the cost-safe default.
- **Monitoring:** log each SageMaker prediction + eventual actual job cost to a small table (new `sagemaker_predictions` or reuse `gold_jobs`), with a scheduled comparison (drift-check script) — the honest, cheap version of "model monitoring" before paying for SageMaker Model Monitor's own infrastructure.
- **CI/CD:** `.github/workflows/sagemaker-train.yml` — retrains on a schedule/data change, checks MAE/R² against the committed `metrics.json` baseline, fails the workflow (doesn't auto-promote) on regression.
- **Docker/K8s (checklist, zero running cost):** the training script already runs in a container for the SageMaker Training Job (SageMaker requires this) — export that same `Dockerfile` and add `k8s/deployment.yaml` for local `kind` testing, documented as portable to EKS, never run continuously in the cloud.

**Est. cost:** training ≈ a few cents per run (minutes on ml.m5.large); Serverless Inference ≈ fractions of a cent per portfolio-scale demo call; Model Registry itself has no separate charge.

**Status:** built (`sagemaker.tf`, `services/triage/sagemaker/`, `MODEL_BACKEND` switch in `main.py`, `sagemaker-train.yml`). Endpoint gated behind `enable_sagemaker_endpoint = false`.

---

## Phase 2 — Computer Vision: Textract on job cards

**What:** the ETL pipeline already extracts text from PDF job cards (`etl/extractors/pdf.py`, pdfplumber). Add **AWS Textract** as an alternative/upgrade path for scanned (non-native-text) job cards where pdfplumber returns nothing — real, existing data source, not a new invented use case.

- New extractor `etl/extractors/textract.py` — falls back to Textract only when `pdfplumber` extraction is empty (scanned image PDFs).
- **Cost:** Textract free tier — 1,000 pages/month for the first 3 months, then ~$1.50/1,000 pages; at Rams@Elec's real job-card volume this stays at cents/month.
- Output feeds the same Bronze layer as the existing extractor — no schema changes needed downstream.

**Status:** built (`etl/extractors/textract.py`, `pdf.py` updated with `use_textract_fallback` parameter).

---

## Phase 3 — Agentic AI: Bedrock alongside Groq

**What:** the existing `services/crew/` CrewAI 3-agent triage crew runs on Groq. Add **Amazon Bedrock** (e.g. Claude Haiku or Titan Text, cheapest per-token tier) as a second, swappable LLM backend for the same agents — a genuine "vendor GenAI" data point, and a natural comparison doc matching the project's existing FAISS-vs-Pinecone comparison style.

- `services/crew/agents.py` — `CREW_MODEL` accepts a `bedrock/<model-id>` prefix; `build_llm()` constructs the LLM, `llm_backend_ready()` does a best-effort readiness check. Same agent/tool definitions, different model client via litellm.
- `docs/benchmarks/bedrock-vs-groq.md` — generated by `services/crew/benchmark_bedrock.py`; latency, token usage, and cost-agreement comparison on the same fixed triage test cases.
- **Cost:** Bedrock is pay-per-token with no idle charge; at demo/test volume, cents.

**Status:** partly built — `agents.py` accepts `bedrock/<id>`, `benchmark_bedrock.py` exists and is ready to generate the comparison doc. **The comparison doc itself has not been generated** because running the benchmark requires real Bedrock credentials and spends real tokens.

---

## Phase 4 — Data Science: Streamlit on Athena

**What:** repoint one existing Streamlit dashboard page (business overview or revenue forecasting) to query the Phase 0 Athena table instead of Postgres directly — demonstrates a genuine AWS-native BI/analytics pattern (serverless query engine) without adding new infra, since Athena/Glue already exist from Phase 0.

- `dashboard/pages/aws_insights.py` (new) — same Prophet-based forecasting already used elsewhere, sourced via `boto3` Athena query instead of `psycopg2`.
- Adds one clear statistical/EDA deliverable on top of the existing charts: cohort profitability breakdown (by service category, area zone) with basic significance checks.
- **Cost:** $0 beyond the Athena query cost already covered in Phase 0.

**Status:** not started.

---

## Phase 5 — Streaming + champion-challenger (market-gap addition)

Added after cross-checking the plan against live LinkedIn/OfferZen/ExecutivePlacements postings for AWS Data/AI Engineer roles — two recurring requirements weren't covered by Phases 0–4.

**Streaming ingestion:** the n8n WhatsApp/SMS alerts and Airflow ETL currently run on request/response or fixed schedules (e.g. the 30-min load-shedding DAG). Add **Amazon Kinesis Data Streams** (or **EventBridge**, cheaper for this event volume) so new job inquiries can trigger the triage crew and Phase 1's SageMaker scoring incrementally instead of only on the next batch/poll — the "real-time inference architecture" line item senior AWS postings name explicitly (e.g. Kinesis alongside SageMaker/EKS in the Menlyn AI Engineer posting).

**Champion-challenger model rollout:** Phase 1's CI gate blocks a regressing model from promotion but doesn't run two model versions side-by-side on real inquiries first. Add: keep the current local/Lambda-served XGBoost model as the incumbent, log the SageMaker candidate's predictions against it for the same inquiries over an observation window, compare MAE/R² agreement, and only then flip `MODEL_BACKEND` to `sagemaker` by default — the specific pattern named in the Absa AI Engineer posting.

**Est. cost:** EventBridge ≈ $1/million events (cents at this volume); Kinesis Data Streams on-demand mode if used instead ≈ $0.014/hour + per-payload — still cents/month at Rams@Elec's real inquiry volume. Champion-challenger adds no new infra, just logging both predictions to the existing artifacts bucket or `gold_jobs`.

**Status:** not started.

---

## Terraform / budget changes

| File | Change |
|---|---|
| `terraform/aws/glue.tf` | New — Glue Database + Crawler |
| `terraform/aws/sagemaker.tf` | New — Model Package Group (Registry) + Serverless Inference endpoint config |
| `terraform/aws/variables.tf` | Add vars for Glue/SageMaker resource names, Bedrock model ID |
| `terraform/aws/budgets.tf` | Raise `monthly_budget_usd` (e.g. `$5` → `$8`) and `daily_budget_usd` proportionally; same guardrail pattern, no logic change |
| `terraform/aws/README.md` | Update "What gets created" table + cost table with the new resources |

## Sequencing

1. **Phase 0 (Glue/Athena data lake)** — everything else reads from here.
2. **Phase 1 (SageMaker)** — the main vendor-checklist item, depends on Phase 0.
3. **Phase 3 (Bedrock)** — cheapest, fastest, independent of the others.
4. **Phase 4 (Streamlit on Athena)** — trivial once Phase 0 exists.
5. **Phase 2 (Textract)** — smallest scope, can slot in anytime.
6. **Phase 5 (Streaming + champion-challenger)** — last; needs Phase 1 already live to have a "challenger" to test.

## Verification

- Phase 0: Athena query returns the same row count as the Postgres Gold table for a given run.
- Phase 1: SageMaker-trained model's MAE/R² compared against the current local baseline (R11,280 / 0.512) — should be in the same range on the same data; CI fails on regression beyond a set threshold.
- Phase 2: Textract output spot-checked against 3–5 real scanned job cards for field accuracy.
- Phase 3: fixed triage test-case set run through both backends, outputs and latency logged in the comparison doc.
- Phase 4: dashboard numbers cross-checked against the existing Postgres-sourced Streamlit page for the same period — should match.
- Phase 5: challenger model's predictions logged against the incumbent's on the same job inquiries for an observation window before promoting it to be the default `MODEL_BACKEND`.

## Parallel action item — certifications (not code)

Recurring across 4/6 scanned postings: **AWS Certified Machine Learning – Specialty**, **Microsoft Certified: Azure AI Engineer Associate**, and **Databricks Certified Data Engineer / ML Professional**. None of this is addressed by implementation work — track separately as a study/exam action item alongside the phases above.

---

## Naming reconciliation

The original plan named some files/paths that drifted during implementation:

| Plan said | Actually built as | Notes |
|---|---|---|
| `services/crew/llm_backend.py` | `services/crew/agents.py` | Backend switch logic lives in `build_llm()` and `llm_backend_ready()` alongside agent definitions |
| `docs/groq-vs-bedrock-comparison.md` | `docs/benchmarks/bedrock-vs-groq.md` | Generated by `benchmark_bedrock.py`; does not exist yet (needs real Bedrock credentials) |
| `budgets.tf` raise to `$12` | Raised to `$8` | Smaller ceiling found sufficient for the current resource set |
