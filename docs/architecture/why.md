# Why each target component is there

Companion to [target-state.md](target-state.md). For each component: why it is there, the
simpler alternative and the verdict on it, the failure it prevents, and a rough monthly
cost tier.

**Cost tiers** are estimates from published prices for this workload, not quotes:
**low** is under about 5 US dollars a month, **medium** 5 to 25, **high** above 25.

## Read this first: three honest caveats

1. **This platform is not deployed, so the cheapest secure option today is to deploy
   nothing.** The target is worth building only when the business is ready to move off its
   current website.
2. **The single-cloud rule costs something.** The code calls Groq and was configured for
   Vercel; both are cheaper or free at this size. Bedrock and Amplify replace them because
   the owner asked for one cloud, not because they are better for the client.
3. **The Practice tier is for learning.** It is defensible in an interview as "I built it,
   measured it, and switched it off because the client did not need it" — which is a
   stronger answer than leaving it running.

## Edge and frontend

| Component | Why it is there | Simpler alternative, and verdict | Failure it prevents | Cost |
|---|---|---|---|---|
| Route 53, CloudFront, ACM | One managed edge with certificates that renew themselves | Point DNS straight at the app: **rejected** — no caching, no place to put a firewall | Expired certificates; origin exposed directly | low |
| AWS WAF with a rate limit | A public form and a chatbot that costs money per call | No firewall: **rejected** — one script could run up the model bill overnight | Cost abuse; common web attacks | medium |
| Amplify Hosting | Runs the Next.js frontend without a server to patch | Vercel (already configured): **simpler and free — rejected only by the single-cloud rule** | — | low |
| Cognito with MFA for administrators | Sign-in, groups and MFA without storing password hashes in the app database | The current credentials sign-in: **rejected for administrators** — no MFA, and hashes sit beside customer data | A stolen admin password reaching every customer record | low |

## Compute and data

| Component | Why it is there | Simpler alternative, and verdict | Failure it prevents | Cost |
|---|---|---|---|---|
| Six services as Lambda functions | They are small and idle most of the day; the repository already packages one this way | Containers on Fargate: **rejected** — pays for six idle services around the clock | Paying for idle | low |
| API Gateway with signed calls | Each caller proves who it is with its own role | The shared API key (today): **rejected** — one leaked key opens all six services | Lateral movement from one leaked secret | low |
| RDS PostgreSQL in private subnets | Managed patching, backups and point-in-time recovery for the one store that matters | Postgres in a container: **rejected here** — nobody is on call for it, and this platform holds customer records | Data loss; an unpatched database | medium |
| pgvector in the same database | One store to secure, back up and pay for | A managed vector service: **rejected** — its minimum charge is many times this whole design | A second data store to protect | none |
| One NAT instance | Private functions still need to reach Bedrock and the load-shedding feed | NAT gateway: **rejected at this size** — costs more than the database; adopt it at scale | Public addresses on private workloads | low |
| SQS with a dead-letter queue | An enquiry is not lost when a downstream call fails | Call the next service directly: **rejected** | Silently dropped enquiries — this repository's recurring bug class | low |
| EventBridge Scheduler and Step Functions | Scheduled work with retries and a visible history, and no server | Airflow (in the repository): **rejected** — the managed version costs hundreds a month; a self-hosted one needs a server | A failed nightly job nobody sees | low |
| SES and SNS | Mail and alerts inside the same account | Twilio and n8n (in the repository): **rejected by the single-cloud rule**; check first which messaging channels are offered in the region | — | low |

## Identity, secrets and keys

| Component | Why it is there | Simpler alternative, and verdict | Failure it prevents | Cost |
|---|---|---|---|---|
| Organizations with guardrail policies | Rules that even an administrator in the workload account cannot remove | A single account: **rejected** — a second account is free, and guardrails need an organisation | Someone switching off the audit trail | none |
| Identity Center: Admin and ReadOnly | Looking is separated from changing | One powerful user: **rejected** | A slip altering production | none |
| One role per function | A compromised service reaches only its own data | One shared role: **rejected** | One bug exposing everything | none |
| Secrets Manager for the database credential | Rotation without a deploy | Parameter Store only: **accepted for everything except the database credential** | A credential that never changes | low |
| A KMS key per data class | Access to data is decided by key policy as well as by IAM | Provider-managed keys: **accepted for logs; rejected for customer data** | A misconfigured role reading every store | low |

## Detection, response and recovery

| Component | Why it is there | Simpler alternative, and verdict | Failure it prevents | Cost |
|---|---|---|---|---|
| CloudTrail to a locked bucket | A record the actor cannot erase | Console history: **rejected** | No answer to "what happened?" | low |
| GuardDuty | Managed detection for the account, the functions and the database | Nothing: **rejected** | A compromise running unnoticed | low |
| Security Hub | One list of findings, scored against a known benchmark | Read each tool separately: **rejected** — findings get lost | Findings nobody reads | low |
| Config, a few rules only | Catches a bucket made public or encryption switched off | Every rule: **rejected** — Config is charged per recorded change and grows quietly | Drift from the baseline | low to medium |
| Inspector | Known vulnerabilities in functions and images, continuously | Scan only in CI (today): **accepted until deployed** | A library that became vulnerable after it shipped | low |
| Macie | Finds personal data where it should not be | Trust the pipeline: **accepted for Core**; Macie is Practice, run monthly | Personal data leaking into an analysis table | low |
| Written runbooks, alert to phone | A person knows what to do at 2 a.m. | Decide at the time: **rejected** | Evidence destroyed by a hasty fix | none |
| AWS Backup with a locked vault | Backups survive a compromised administrator | RDS snapshots alone: **accepted for a first release** | Ransom by deletion | low |
| A timed restore drill | Proof the recovery targets are real | Trust the backups: **rejected** | Learning during the emergency | none |

## Data, models and language models

| Component | Why it is there | Simpler alternative, and verdict | Failure it prevents | Cost |
|---|---|---|---|---|
| Three-layer data lake with masking in the middle | Analysis never touches raw personal data | Query the operational database: **accepted until there is real volume** | Personal data in a notebook | low |
| Data quality checks that fail the run | A bad load stops, loudly | Log and continue: **rejected** | A report built on a broken load | none |
| Athena with a scan limit | SQL over the lake with a ceiling on cost | A warehouse: **rejected** — nothing here needs one | A runaway query bill | low |
| SageMaker training and Model Registry | A model's data, code, metrics and approval are recorded in one place | Train on a laptop and copy a file (today): **rejected for anything a customer sees** | An untraceable model in production | low |
| Model loaded by the function, not a hosted endpoint | The model is small; an endpoint bills while idle | Serverless inference endpoint (written, gated): **keep gated** | Paying for an idle endpoint | none |
| Bedrock with Guardrails | One provider inside the account, with input and output filtering | Groq (today): **cheaper — rejected only by the single-cloud rule**. Confirm the model is offered in the region first | Prompt attacks; personal data in a prompt or an answer | low to medium |
| Golden set and red-team suite in the pipeline | A prompt change cannot quietly make answers worse or less safe | Try it by hand: **rejected** | A regression nobody measured | none |
| Tracing of every model call | Latency, cost and prompt version per call | Read the bill: **rejected** | A cost or quality change with no cause | low |
| Retrieval with citations and a refusal floor | An answer about wiring regulations must point at the regulation | Answer anyway: **rejected** — a confident wrong answer about electrical safety is the worst outcome this system has | Invented regulation | none |

## Delivery

| Component | Why it is there | Simpler alternative, and verdict | Failure it prevents | Cost |
|---|---|---|---|---|
| Terraform scanning added to the existing scanners | The one class of mistake the pipeline does not catch today | Type-check only (today): **rejected** | A public bucket merged unnoticed | none |
| Keyless deploy role | No stored cloud key in the repository's settings | A stored key: **rejected** — the repository is public | A leaked key | none |
| Short-lived preview stack | Dynamic and model tests run against something real, then it is destroyed | Test in production: **rejected** | Finding the flaw after release | low |
| Images by digest, with a bill of materials | What runs is what was scanned | `latest`: **rejected** | An unreviewed image | none |
