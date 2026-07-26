# AWS — Module 11

Real deployment target, real account, real (small) charges. This is not the Azure
configuration one directory up, which is designed and deliberately never provisioned.

**What exists right now: the cost guardrails, and nothing else.** No Lambda, no S3 bucket,
no SSM parameters. That is the intended order, not an unfinished state — the budget is the
one resource that has to exist before the resources it protects you from.

## Apply order

```bash
cd terraform/aws
cp terraform.tfvars.example terraform.tfvars   # then set alert_email
terraform init
terraform apply -target=aws_budgets_budget.monthly_cost
terraform apply
```

Step 4 is not ceremony. `-target` forces the guardrail up in its own apply, so that if
step 5 half-fails partway through creating something billable, the alerting is already
live. Every billable resource added later must also carry
`depends_on = [aws_budgets_budget.monthly_cost]`, so a fresh `terraform apply` in a clean
account gets the same ordering without the `-target`.

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

## Next

- Package `services/sentiment` for Lambda (Mangum adapter over the existing FastAPI app)
- Function URL with `AWS_IAM` or the API key gate above
- Triage model artifacts (`*.pkl`, `metrics.json`) to a private, versioned S3 bucket
- `GROQ_API_KEY` and `API_KEY_HASHES` into SSM Parameter Store
