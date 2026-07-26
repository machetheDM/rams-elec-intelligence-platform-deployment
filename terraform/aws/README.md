# AWS — Module 11

Real deployment target, real account, real (small) charges. This is not the Azure
configuration one directory up, which is designed and deliberately never provisioned.

## Apply order

The budget goes up in its own apply, before anything billable exists. Secrets are created
out of band, before the function that reads them.

```bash
# 1. Build the deployment package (writes dist/sentiment-lambda.zip)
py -3.14 scripts/build_lambda.py

# 2. Configure
cd terraform/aws
cp terraform.tfvars.example terraform.tfvars   # then set alert_email
terraform init

# 3. Cost guardrail FIRST, on its own
terraform apply -target=aws_budgets_budget.monthly_cost

# 4. Secrets, out of band — never through Terraform (see "Secrets" below)
aws ssm put-parameter --name /rams-elec/sentiment/groq_api_key \
    --type SecureString --value "<your Groq key>"
aws ssm put-parameter --name /rams-elec/sentiment/api_key_hashes \
    --type SecureString --value "<sha256 hash(es), comma-separated>"

# 5. Everything else
terraform apply
```

Step 3 is not ceremony. `-target` forces the guardrail up in its own apply, so that if a
later step half-fails partway through creating something billable, the alerting is already
live. Every billable resource also carries `depends_on = [aws_budgets_budget.monthly_cost]`,
so a fresh apply in a clean account gets the same ordering without the `-target`.

Step 4 must precede step 5. The function sets `APP_ENV=production`, so if
`api_key_hashes` is absent from SSM the middleware raises at import and every invocation
fails — deliberately. Generate a key and its hash with the command in `.env.example`.

## What gets created

| Resource | Purpose | Cost |
|---|---|---|
| 2 × `aws_budgets_budget` | $5/month ceiling, $1/day tripwire | free |
| `aws_lambda_function` + Function URL | sentiment service, public HTTPS | free tier |
| `aws_cloudwatch_log_group` | 14-day retention, set explicitly | pennies |
| `aws_s3_bucket` | triage model artifacts, private + versioned | ~$0.12/mo |
| `aws_iam_role` + inline policy | least-privilege execution role | free |

**Terraform does not create the SSM parameters.** See "Secrets".

## What the budgets do

| Budget | Limit | Fires on |
|---|---|---|
| `rams-elec-monthly-ceiling` | `$5`/month | actual spend at 50%, 80%, 100%; **forecast** at 100% |
| `rams-elec-daily-tripwire` | `$1`/day | actual spend in a single day |

The forecast alert is the one that matters — it fires on trajectory, days before the money
is gone. The daily tripwire covers the shape the monthly budget is blind to: $5 spread over
a month and $5 burned in an afternoon trip the monthly alert at the same moment, but only
one of them is still recoverable.

**Budgets alert; they do not cap.** Nothing here will stop a charge. An alert is a signal
to go and destroy something. `aws_budgets_budget_action` can attach a deny-all IAM policy at
100%, which is the only mechanism that genuinely halts spend — it is deliberately not used,
because locking the account has a bigger blast radius than a $5 overrun. Revisit if this
ever hosts something that matters.

Budgets are free for the first two per account, so this module cannot break the ceiling it
enforces.

## Secrets

Nothing secret goes in `terraform.tfvars`, in a variable, or in an output. Anything passed
through Terraform is written to `terraform.tfstate` in plaintext, which is exactly what
encrypting it was meant to prevent.

Runtime secrets (`GROQ_API_KEY`, `API_KEY_HASHES`) belong in SSM Parameter Store as
`SecureString`, created out of band and read by the Lambda execution role at invocation.

`API_KEY_HASHES` is not optional for the Lambda. `security/auth/api_key_middleware.py`
refuses to import when `APP_ENV` is anything other than `development` and the variable is
unset — and it also refuses if the value contains a hash of one of the three development
keys committed to this repository. A Function URL is public by definition; a published key
on a public endpoint is an open endpoint.

## State

Local, and git-ignored (`/.gitignore`, Terraform section). An S3 backend with DynamoDB
locking is correct for a team and is stubbed out in `main.tf`, but it adds a bucket and a
table to a $5 budget to solve a concurrency problem that a single operator does not have.
The real risk here is committing state, not losing it, and the ignore patterns address that.

## Cost controls, in one place

The $5 ceiling is enforced by design decisions, not only by the alerts:

| Control | Where | Stops |
|---|---|---|
| `reserved_concurrent_executions = 5` | `lambda.tf` | a retry loop scaling to the account limit |
| `timeout = 30s` | `lambda.tf` | a hung request billing for minutes |
| explicit log group, 14-day retention | `lambda.tf` | logs accruing forever, the usual free-tier leak |
| `noncurrent_version_expiration` | `s3.tf` | versioning turning a few MB into unbounded growth |
| SSE-S3 rather than a KMS CMK | `s3.tf` | $1/month — 20% of the budget — for no gain here |
| budget + daily tripwire | `budgets.tf` | nothing; it tells you, and only after the fact |

## Next

- Upload the triage artifacts (`*.pkl`, `metrics.json`) to the bucket and have the triage
  service read from S3 when running outside Docker
- Point the n8n follow-up workflow at the Function URL
- Nothing here has been applied yet — the first `terraform apply` is still pending
