"""AWS Lambda: Post-Service Follow-up Trigger (Module 11 / Module 10 Part H).

Replaces the daily Airflow DAG `etl/dags/followup_trigger_dag.py`. The selection
SQL is carried over verbatim, including the POPIA consent precondition — that
query is the security control and it must not drift between the two.

Why this moved off Airflow
--------------------------
The DAG did three things once a day: run one SELECT, insert a handful of rows,
and POST to a webhook. It held a Celery worker, a scheduler slot, and a Postgres
connection pool to do roughly two seconds of work. Airflow earns its keep on the
Bronze->Silver->Gold ETL, which has real dependencies, retries per task, and
backfill semantics; this has none of those. The division is by workload type:
Airflow for orchestration with a dependency graph, Lambda for a timer that pokes
one endpoint.

What this fixes relative to the DAG
-----------------------------------
The DAG committed every FollowUp row first and dispatched afterwards, catching
webhook errors so one failure could not fail the whole run. Its docstring said a
later run or manual replay could pick the failures up — but nothing does. The
selection query excludes any job that already has a follow_ups row, so a row
created for a customer whose webhook failed permanently removes that customer
from consideration. They are never messaged, and the row sits with
response_received = false forever, indistinguishable from someone who simply did
not reply.

That is the repo's recurring silent-no-op bug class: a comment describing a
recovery path that does not exist.

Here each job gets its own transaction, and the webhook call happens INSIDE it.
Dispatch fails -> rollback -> no row -> tomorrow's run tries again. The cost is
holding a transaction open across an HTTP call, which is normally worth avoiding;
it is acceptable here because the transaction inserts exactly one new row, takes
no lock any other writer contends for, and the call is capped at
WEBHOOK_TIMEOUT_SECONDS.

The residual failure mode is the inverse and is deliberate: if the webhook
succeeds but the commit then fails, the customer is messaged and no row records
it, so tomorrow they are messaged a second time. A duplicate check-in is a worse
customer experience than a missing one, but it is recoverable and visible.
Silently never contacting someone is neither.

Configuration
-------------
Read from SSM Parameter Store at cold start, NOT from Lambda environment
variables. Environment variables are returned in plaintext by lambda:GetFunction
and rendered in the console, so anyone with read-only Lambda access can see the
database URL. Parameter Store SecureString keeps the value behind a separate
kms:Decrypt grant, which the execution role has and a console reader does not.

    /rams-elec/<env>/database-url     SecureString  Postgres connection string
    /rams-elec/<env>/n8n-webhook-url  SecureString  n8n base URL

Only the parameter PATH comes from the environment, which is not sensitive.
"""

from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ── Thresholds ─────────────────────────────────────────────────────────
# Identical to the DAG. Emergency and high-urgency work gets a shorter window:
# if that repair failed, the customer is living with the consequences now, not
# in a week.
URGENT_THRESHOLD_DAYS = 3
STANDARD_THRESHOLD_DAYS = 7

FOLLOWUP_WEBHOOK_PATH = "/webhook/followup-checkin"
WEBHOOK_TIMEOUT_SECONDS = 10.0

PARAM_PREFIX = os.environ.get("SSM_PARAM_PREFIX", "/rams-elec/dev")

# Cold-start caches. Lambda reuses the execution context across invocations, so
# resolving these once per container rather than once per invocation saves both
# an SSM call and a connection handshake on warm runs.
_engine: Engine | None = None
_webhook_base: str | None = None
_ssm_client: Any = None


# ── Selection query ────────────────────────────────────────────────────
# Carried over from the DAG unchanged. Notes preserved because they encode
# failures already paid for:
#
#   * status = 'complete' is lowercase. Job.status is
#     open | assigned | in_progress | complete | cancelled; querying 'Complete'
#     silently matches zero rows and reports success.
#   * POPIA consent is a SQL precondition, not an application-code check. A
#     customer without follow_up_consent is never selected, so no downstream
#     code path can accidentally message them.
#   * make_interval(days => :param) rather than INTERVAL '1 day' * :param — the
#     latter depends on the driver adapting the bind parameter to an integer,
#     and fails with "operator does not exist: interval * text" if it arrives as
#     text. pg8000 is a different driver from psycopg2, so this matters more
#     here, not less.
DUE_JOBS_SQL = text("""
    SELECT
        j.id             AS job_id,
        j.customer_id    AS customer_id,
        j.equipment_id   AS equipment_id,
        j.urgency        AS urgency,
        j.completed_date AS completed_date,
        st.name          AS service_name,
        c.name           AS customer_name,
        c.whatsapp       AS customer_whatsapp,
        EXTRACT(DAY FROM (NOW() - j.completed_date))::int
                         AS days_since_completion
    FROM jobs j
    JOIN customers c      ON j.customer_id = c.id
    JOIN service_types st ON j.service_type_id = st.id
    WHERE j.status = 'complete'
      AND j.completed_date IS NOT NULL
      AND c.follow_up_consent = true
      AND c.whatsapp IS NOT NULL
      AND j.completed_date <= NOW() - (
            CASE WHEN j.urgency IN ('emergency', 'high')
                 THEN make_interval(days => :urgent_days)
                 ELSE make_interval(days => :standard_days)
            END
          )
      AND NOT EXISTS (
            SELECT 1 FROM follow_ups f WHERE f.job_id = j.id
          )
    """)

INSERT_FOLLOWUP_SQL = text("""
    INSERT INTO follow_ups (
        id, job_id, customer_id, equipment_id,
        days_since_completion, triggered_at,
        response_received, follow_up_issue_created,
        sentiment_themes, created_at
    )
    VALUES (
        gen_random_uuid()::text, :job_id, :customer_id, :equipment_id,
        :days, NOW(),
        false, false,
        ARRAY[]::text[], NOW()
    )
    RETURNING id
    """)


def _get_ssm_client() -> Any:
    """Build the SSM client once per container.

    boto3 is imported here rather than at module scope for two reasons. It is
    provided by the Lambda runtime and deliberately not in requirements.txt, so
    a module-level import would make this file unimportable anywhere else —
    including in CI, where these tests run without it. And constructing a boto3
    client is not cheap; caching it keeps that cost on the cold path only.
    """
    global _ssm_client
    if _ssm_client is None:
        import boto3

        _ssm_client = boto3.client("ssm")
    return _ssm_client


def _get_parameter(name: str) -> str:
    """Read one SecureString from Parameter Store, decrypted."""
    response = _get_ssm_client().get_parameter(Name=name, WithDecryption=True)
    return response["Parameter"]["Value"]


def _get_engine() -> Engine:
    """Build (once per container) a SQLAlchemy engine over pg8000.

    pg8000 is a pure-Python driver, deliberately. psycopg2 ships a compiled
    extension, so a zip built on any developer machine that is not Amazon Linux
    fails at import inside Lambda with a manylinux mismatch — the classic reason
    people reach for a container image or a prebuilt layer. Neither is warranted
    for one query a day. Pure Python means `pip install -t` on any OS produces a
    working artifact.

    pool_pre_ping guards against a connection cached in a warm container that
    the database has since closed. NullPool would also work; pre_ping keeps the
    warm-path saving.
    """
    global _engine
    if _engine is None:
        url = _get_parameter(f"{PARAM_PREFIX}/database-url")
        # Force the pg8000 dialect regardless of how the stored URL is written,
        # so a value copied from .env (postgresql://) does not send SQLAlchemy
        # looking for psycopg2, which is not in the bundle.
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+pg8000://", 1)
        elif url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+pg8000://", 1)
        _engine = create_engine(url, pool_pre_ping=True, pool_size=1, max_overflow=0)
    return _engine


def _get_webhook_base() -> str:
    global _webhook_base
    if _webhook_base is None:
        _webhook_base = _get_parameter(f"{PARAM_PREFIX}/n8n-webhook-url").rstrip("/")
    return _webhook_base


def _post_webhook(url: str, payload: dict[str, Any]) -> None:
    """POST to n8n. Raises on any non-2xx or transport failure.

    stdlib urllib rather than httpx or requests: this is one POST with a JSON
    body and a timeout, and every dependency added here is bytes in the
    deployment zip and milliseconds on every cold start.
    """
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=WEBHOOK_TIMEOUT_SECONDS) as response:
        if not 200 <= response.status < 300:
            raise RuntimeError(f"webhook returned HTTP {response.status}")


def _find_due_jobs(engine: Engine) -> list[dict[str, Any]]:
    with engine.connect() as conn:
        rows = conn.execute(
            DUE_JOBS_SQL,
            {
                "urgent_days": URGENT_THRESHOLD_DAYS,
                "standard_days": STANDARD_THRESHOLD_DAYS,
            },
        ).fetchall()

    return [
        {
            "job_id": r.job_id,
            "customer_id": r.customer_id,
            "equipment_id": r.equipment_id,
            "urgency": r.urgency,
            "service_name": r.service_name,
            "customer_name": r.customer_name,
            "customer_whatsapp": r.customer_whatsapp,
            "days_since_completion": r.days_since_completion,
            "completed_date": (
                r.completed_date.isoformat() if r.completed_date else None
            ),
        }
        for r in rows
    ]


def _process_job(engine: Engine, job: dict[str, Any], webhook_url: str) -> bool:
    """Insert the FollowUp row and dispatch it atomically.

    Returns True on success. On webhook failure the transaction is rolled back,
    leaving no row, so the job is selected again on the next run.
    """
    try:
        with engine.begin() as conn:
            row = conn.execute(
                INSERT_FOLLOWUP_SQL,
                {
                    "job_id": job["job_id"],
                    "customer_id": job["customer_id"],
                    "equipment_id": job["equipment_id"],
                    "days": job["days_since_completion"],
                },
            ).fetchone()

            _post_webhook(webhook_url, {**job, "follow_up_id": row.id})
        return True
    except (urllib.error.URLError, OSError, RuntimeError) as exc:
        # Rolled back by the context manager — no row was written, so this
        # customer is retried tomorrow rather than silently dropped.
        logger.warning(
            json.dumps(
                {
                    "event": "dispatch_failed_rolled_back",
                    "job_id": job["job_id"],
                    "error": str(exc),
                }
            )
        )
        return False


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """EventBridge Scheduler entry point. Runs daily at 09:00 Africa/Johannesburg.

    The schedule's timezone lives in Terraform, not here — see
    aws_scheduler_schedule.followup_trigger.
    """
    engine = _get_engine()
    webhook_url = f"{_get_webhook_base()}{FOLLOWUP_WEBHOOK_PATH}"

    due_jobs = _find_due_jobs(engine)
    logger.info(json.dumps({"event": "due_jobs_found", "count": len(due_jobs)}))

    dispatched = 0
    failed = 0
    for job in due_jobs:
        if _process_job(engine, job, webhook_url):
            dispatched += 1
        else:
            failed += 1

    result = {
        "due": len(due_jobs),
        "dispatched": dispatched,
        "failed": failed,
    }
    logger.info(json.dumps({"event": "run_complete", **result}))

    # A partial failure is reported, not raised. Raising would mark the whole
    # invocation failed and trigger EventBridge's retry, re-running the SELECT
    # and re-messaging everyone who already succeeded. The rollback above is
    # what makes the failures recoverable; the retry would only duplicate.
    return result
