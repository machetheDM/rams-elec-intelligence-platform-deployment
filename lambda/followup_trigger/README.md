# Follow-up Trigger Lambda — Module 11 Phase 1

Daily post-service satisfaction check-in. Replaces `etl/dags/followup_trigger_dag.py`,
which now ships **paused**.

| | |
|---|---|
| Trigger | EventBridge Scheduler, `cron(0 9 * * ? *)` in `Africa/Johannesburg` |
| Runtime | Python 3.12, 256 MB, 60 s timeout, reserved concurrency 1 |
| Region | `af-south-1` |
| Cost | **$0** — inside the perpetual Lambda free tier (1M req / 400,000 GB-s per month) |
| Terraform | `terraform/aws/lambda_followup.tf` |

---

## Why this left Airflow

The DAG ran one SELECT, inserted a few rows, and POSTed to a webhook — about two
seconds of work — while holding a Celery worker, a scheduler slot, and a
connection pool. Airflow earns its keep on the Bronze→Silver→Gold ETL, which has
a real dependency graph, per-task retries, and backfill semantics. This has none
of those.

The split is by workload type: **Airflow for orchestration with dependencies,
Lambda for a timer that pokes one endpoint.**

## What it fixes

The DAG committed every `follow_ups` row first, then dispatched, catching webhook
errors so one bad send couldn't fail the run. Its docstring said a later run or a
manual replay would pick failures up. **Nothing did.**

Because the selection query excludes any job that already has a `follow_ups` row,
a committed row whose webhook failed permanently removed that customer from
selection. They were never messaged, and the row was indistinguishable from a
customer who simply hadn't replied — the repo's recurring silent-no-op pattern,
in its purest form: a comment describing a recovery path that does not exist.

Here the webhook call happens **inside** each job's transaction. Dispatch fails →
rollback → no row → retried tomorrow.

The residual failure mode is deliberate and inverted: if the webhook succeeds but
the commit then fails, the customer gets a duplicate check-in tomorrow. A
duplicate is worse UX but visible and recoverable; never contacting someone is
neither.

## Security decisions

| Decision | Why |
|---|---|
| Config in SSM Parameter Store, not Lambda env vars | `lambda:GetFunction` returns env vars in plaintext — read-only Lambda access would expose the database URL |
| Inline IAM policy, not `AWSLambdaBasicExecutionRole` | That managed policy grants `logs:CreateLogGroup` on `*`, letting the function create log groups outside the retention/cost controls |
| `ssm:GetParameter` scoped to two full ARNs | Not `GetParametersByPath` on the prefix, which would silently widen as later phases add parameters |
| `kms:Decrypt` bounded by `kms:ViaService` | The grant can't be reused to decrypt anything else under the same AWS-managed key |
| Scheduler role trust scoped to `aws:SourceAccount` | Closes the confused-deputy path |
| Explicit log retention | AWS defaults to never-expire — the only line item here that grows without bound |
| `reserved_concurrent_executions = 1` | A daily job needs exactly one; bounds the blast radius of a misconfigured trigger |
| Terraform never holds the secret values | Anything passed as a variable lands in `terraform.tfstate` in plaintext |

POPIA consent stays enforced **in SQL**, exactly as in the DAG — a customer
without `follow_up_consent` is never selected, so no downstream code path can
message them by accident.

## Deploy

```bash
./build.sh
```

```bash
cd terraform/aws && terraform apply -target=aws_budgets_budget.monthly_cost && terraform apply
```

Then populate the two parameters Terraform created empty (it deliberately never
holds these values):

```bash
aws ssm put-parameter --name /rams-elec/dev/database-url --type SecureString --overwrite --value 'postgresql://...'
```

```bash
aws ssm put-parameter --name /rams-elec/dev/n8n-webhook-url --type SecureString --overwrite --value 'https://...'
```

## Verify without waiting for 09:00

```bash
aws lambda invoke --function-name rams-elec-dev-followup-trigger --payload '{}' /dev/stdout
```

Expect `{"due": N, "dispatched": N, "failed": 0}`. A non-zero `failed` means the
webhook is unreachable — those jobs were rolled back and will retry tomorrow.

## Teardown

```bash
cd terraform/aws && terraform destroy
```

Nothing here accrues idle charges, so teardown is about hygiene rather than cost.
The one thing that survives `destroy` is CloudWatch log data inside its retention
window; delete the log group explicitly if that matters.

## Tests

`tests/test_followup_lambda.py` — 8 tests, no AWS and no database. The load-bearing
one is `test_webhook_failure_rolls_the_row_back`; if that ever goes red, the bug
described above is back.
