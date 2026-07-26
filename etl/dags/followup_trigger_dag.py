"""
Airflow DAG: Post-Service Follow-up Trigger (Module 10)

Schedule: daily.
Tasks: find_due_jobs → create_followup_records → trigger_n8n_webhook

Finds jobs that completed N days ago, creates a FollowUp record for each, and
asks n8n to open the WhatsApp check-in conversation. The customer's reply
eventually populates still_working / satisfaction_rating / comment_text, which
is what makes this table the training set for the failure-recurrence model.

Two things worth knowing before editing:

  1. This DAG lives in etl/dags/, NOT airflow/dags/. docker/Dockerfile.airflow
     builds with context ./etl and bakes `COPY dags/` into the image, with no
     volume mounts — anything in airflow/dags/ is never deployed.

  2. POPIA consent is enforced in the SQL below, not in application code. A
     customer without follow_up_consent is never selected, so no code path
     downstream can accidentally message them.

Usage:
    airflow dags trigger followup_trigger
"""

from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
import os

import httpx
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/ramsatelec"
)
N8N_WEBHOOK_URL = os.getenv("N8N_WEBHOOK_URL", "http://localhost:5678")
FOLLOWUP_WEBHOOK_PATH = "/webhook/followup-checkin"

# Days after completion before we check in. Emergency and high-urgency work
# gets a shorter window — if that repair failed, the customer is living with
# the consequences now, not in a week. Which urgency levels count as urgent is
# expressed in the SQL CASE below, so the threshold and its condition stay in
# one place rather than drifting apart.
URGENT_THRESHOLD_DAYS = 3
STANDARD_THRESHOLD_DAYS = 7

default_args = {
    "owner": "ramsatelec",
    "depends_on_past": False,
    "email_on_failure": True,
    "email_on_retry": False,
    "email": ["ops@ramsatelec.co.za"],
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
}

with DAG(
    dag_id="followup_trigger",
    default_args=default_args,
    description="Daily post-service satisfaction check-in trigger (Module 10)",
    schedule_interval="0 9 * * *",  # 09:00 daily — civil hour for a customer message
    start_date=datetime(2026, 7, 1),
    catchup=False,
    tags=["ramsatelec", "followup", "module10"],
) as dag:

    def find_due_jobs(**context):
        """Select completed jobs that have crossed their follow-up threshold.

        Note `status = 'complete'` — lowercase. The Job.status values are
        open | assigned | in_progress | complete | cancelled; querying for
        'Complete' silently matches zero rows.
        """
        engine = create_engine(DATABASE_URL)

        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT
                        j.id                AS job_id,
                        j.customer_id       AS customer_id,
                        j.equipment_id      AS equipment_id,
                        j.urgency           AS urgency,
                        j.completed_date    AS completed_date,
                        st.name             AS service_name,
                        c.name              AS customer_name,
                        c.whatsapp          AS customer_whatsapp,
                        EXTRACT(DAY FROM (NOW() - j.completed_date))::int
                                            AS days_since_completion
                    FROM jobs j
                    JOIN customers c      ON j.customer_id = c.id
                    JOIN service_types st ON j.service_type_id = st.id
                    WHERE j.status = 'complete'
                      AND j.completed_date IS NOT NULL
                      -- POPIA: per-purpose consent is a hard precondition.
                      AND c.follow_up_consent = true
                      AND c.whatsapp IS NOT NULL
                      -- Urgency-dependent threshold. make_interval() is used
                      -- rather than `INTERVAL '1 day' * :param` because the
                      -- latter relies on the driver adapting the bind
                      -- parameter to an integer; if it ever arrives as text,
                      -- Postgres fails with "operator does not exist:
                      -- interval * text". make_interval takes a typed int.
                      AND j.completed_date <= NOW() - (
                            CASE WHEN j.urgency IN ('emergency', 'high')
                                 THEN make_interval(days => :urgent_days)
                                 ELSE make_interval(days => :standard_days)
                            END
                          )
                      -- Never follow up on the same job twice
                      AND NOT EXISTS (
                            SELECT 1 FROM follow_ups f WHERE f.job_id = j.id
                          )
                """),
                {
                    "urgent_days": URGENT_THRESHOLD_DAYS,
                    "standard_days": STANDARD_THRESHOLD_DAYS,
                },
            ).fetchall()

        engine.dispose()

        due = [
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

        print(f"Found {len(due)} job(s) due for follow-up")
        context["task_instance"].xcom_push(key="due_jobs", value=due)

    def create_followup_records(**context):
        """Insert a FollowUp row per due job and attach its generated id."""
        ti = context["task_instance"]
        due_jobs = ti.xcom_pull(key="due_jobs", task_ids="find_due_jobs") or []

        if not due_jobs:
            print("No due jobs — nothing to create")
            ti.xcom_push(key="created_followups", value=[])
            return

        engine = create_engine(DATABASE_URL)
        created = []

        with engine.begin() as conn:
            for job in due_jobs:
                # gen_random_uuid() is available on PG13+ without pgcrypto.
                # Prisma writes cuid()s, but ids are opaque TEXT either way —
                # this row is created by the pipeline, not the ORM.
                row = conn.execute(
                    text("""
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
                    """),
                    {
                        "job_id": job["job_id"],
                        "customer_id": job["customer_id"],
                        "equipment_id": job["equipment_id"],
                        "days": job["days_since_completion"],
                    },
                ).fetchone()

                created.append({**job, "follow_up_id": row.id})

        engine.dispose()
        print(f"Created {len(created)} follow-up record(s)")
        ti.xcom_push(key="created_followups", value=created)

    def trigger_n8n_webhook(**context):
        """Hand each follow-up to n8n, which owns the WhatsApp conversation.

        A webhook failure is logged and counted rather than raised: the
        FollowUp rows already exist, so a later run or a manual replay can
        pick them up. Failing the whole DAG because one message didn't send
        would block every other customer's follow-up.
        """
        ti = context["task_instance"]
        created = (
            ti.xcom_pull(key="created_followups", task_ids="create_followup_records")
            or []
        )

        if not created:
            print("No follow-ups to dispatch")
            return

        url = f"{N8N_WEBHOOK_URL.rstrip('/')}{FOLLOWUP_WEBHOOK_PATH}"
        sent, failed = 0, 0

        for followup in created:
            try:
                response = httpx.post(url, json=followup, timeout=10.0)
                response.raise_for_status()
                sent += 1
            except Exception as exc:  # noqa: BLE001 — see docstring
                failed += 1
                print(f"n8n webhook failed for {followup['follow_up_id']}: {exc}")

        print(f"Dispatched {sent} follow-up(s), {failed} failed")
        ti.xcom_push(key="dispatched_count", value=sent)

    find_due = PythonOperator(
        task_id="find_due_jobs",
        python_callable=find_due_jobs,
    )
    create_records = PythonOperator(
        task_id="create_followup_records",
        python_callable=create_followup_records,
    )
    dispatch = PythonOperator(
        task_id="trigger_n8n_webhook",
        python_callable=trigger_n8n_webhook,
    )

    find_due >> create_records >> dispatch
