# Gap list — one item a day

Every difference between [as-built.md](as-built.md) and
[target-state.md](target-state.md), ordered so that each item fits in one sitting of
1 to 2 hours. Larger pieces are split into parts.

**Effort:** small is up to 2 hours, medium 2 to 5, large more than 5. Hour figures are
estimates. **Priority:** P1 do now, P2 soon, P3 when convenient.

**Three phases, and why the order is what it is**

| Phase | What | Costs money? |
|---|---|---|
| 1 | Fix what is wrong in the code today. No cloud account needed | No |
| 2 | Stand the Core design up on AWS, safest pieces first | Yes — raise the budget deliberately first |
| 3 | Practice track: switch on, learn, write up, switch off | A few dollars each |

**A rule for working through it:** an item is done when its check passes. Paste the check's
output into your notes for the day — that note is also your interview answer.

**C|CSE** in the tables is the course module the item exercises (1 to 11).

## Phase 1 — fix the code first (free)

| # | Gap | Why it matters | Effort | The check that proves it is done | Skill | C\|CSE | Priority |
|---|---|---|---|---|---|---|---|
| 1 | 16 of 17 frontend API routes have no sign-in check | Online, anyone could read customer and revenue data | medium, 2 h | A request to each route without a session returns 401; a test lists every route file and fails if one lacks the check | Security | 3 | P1 |
| 2 | Customer routes do not scope to the caller's own records | One customer could read another's | medium, 2 h | A test signs in as customer A and gets 403 or an empty list for customer B's equipment | Security | 3 | P1 |
| 3 | Every container port is published on all interfaces | A public host would expose the database | small, 1 h | `docker compose config` shows only the frontend port published; the rest bound to loopback or not published | DevOps | 2 | P1 |
| 4 | The seed script creates an administrator with a development password | The repository is public | small, 1 h | The seed refuses to run when `APP_ENV` is not `development`; a test holds it | Security | 3 | P1 |
| 5 | The dashboard sign-in token has a fallback value in code | A default credential | small, 0.5 h | `git grep` finds no fallback; the dashboard refuses to start without the variable | Security | 3 | P1 |
| 6 | Terraform is type-checked but not scanned | A public bucket could be merged unnoticed | small, 1.5 h | Checkov runs in CI on both Terraform roots and a planted public bucket fails the build | DevSecOps | 5 | P1 |
| 7 | Some scanners report without blocking | A finding can be ignored | small, 1 h | Each of the seven scanners fails the build on a planted issue in a throwaway branch | DevSecOps | 5 | P1 |
| 8 | Actions and images are not pinned | An unreviewed change reaches the pipeline | small, 1.5 h | Every `uses:` is a commit hash; every base image has a digest | DevSecOps | 3 | P2 |
| 9 | No data map | Nobody can say where personal data is | small, 2 h | `docs/` has a table of every personal field, its table and its sensitivity; CI fails if the schema gains a field the map lacks | Data engineering | 4 | P1 |
| 10 | The model name in code may be retired | The LLM paths fall back silently | small, 1 h | A recorded run shows a real response from the configured model, with date and model id | AI engineering | — | P1 |
| 11 | No golden set for triage classification — part 1: build it | No way to tell whether a prompt change helps | medium, 2 h | 50 labelled enquiries, invented, in the repository with their expected category and urgency | AI engineering | — | P1 |
| 12 | Golden set — part 2: score it in CI | As above | medium, 2 h | CI prints accuracy and fails below the recorded baseline | AI engineering | — | P1 |
| 13 | Nothing tries to subvert the chatbot | Prompt injection is the first thing an attacker tries | medium, 2 h | 20 attack prompts in the repository, each with a pass rule; a report shows how many get through | AI security | 6 | P1 |
| 14 | Personal data goes to the model unmasked | Leakage to a third party | medium, 2 h | A test sends a message containing a phone number and an email, and asserts neither reaches the outgoing request | AI security | 4 | P1 |
| 15 | Retrieval is untested and its index is not reproducible | The chatbot may be answering from nothing | medium, 2 h | A script rebuilds the index from tracked sources; a test asks three questions and checks the cited passage | AI engineering | — | P2 |
| 16 | The chatbot answers even when retrieval finds nothing | A confident wrong answer about electrical safety | small, 1.5 h | A question with no matching passage returns a refusal; a test holds it | AI engineering | — | P1 |
| 17 | The estimator has no baseline beside it | A figure with no comparison means little | small, 1.5 h | `metrics.json` gains the error of "predict the mean"; the UI shows both | Data science | — | P2 |
| 18 | The estimator's split is random | Leaks the future into training | small, 1.5 h | The split is by date; the new figures replace the old in `metrics.json` | Data science | — | P2 |
| 19 | No model card | Intended use and limits are unstated | small, 1 h | `services/triage/MODEL_CARD.md` states data source, metrics, limits and failure cases | Data science | 10 | P2 |
| 20 | No tracing of model calls | Cost and latency are unknown | medium, 2 h | Each call logs latency, token counts and prompt version; a script totals a day's cost | AI engineering | 5 | P2 |
| 21 | One Airflow DAG is in a folder the image does not copy | It would never run | small, 0.5 h | The file is under `etl/dags/` and the image lists three DAGs | Data engineering | — | P3 |
| 22 | The documents disagree with the code (route count, test count, DAG location) | Misleads a reader | small, 1 h | The three figures in `CLAUDE.md` match a fresh count | DevOps | — | P3 |
| 23 | No written risk register or POPIA mapping | Compliance is asserted, not shown | medium, 2 h | `docs/` has ten risks with owner and treatment, and each POPIA condition mapped to a control | Governance | 10, 11 | P2 |
| 24 | No incident runbook for this platform | Nobody knows the first five steps | small, 2 h | `docs/` has a runbook for a leaked key, a data breach and a model-abuse spike, each with contain, preserve, recover | Security | 7 | P2 |

## Phase 2 — stand up the Core on AWS

Do not start before the owner has raised the budget on purpose. Every item ends with the
resource created by Terraform and `terraform plan` showing no changes.

| # | Gap | Why it matters | Effort | The check that proves it is done | Skill | C\|CSE | Priority |
|---|---|---|---|---|---|---|---|
| 25 | No organisation, no guardrail policies | An administrator could switch off the audit trail | small, 2 h | An attempt to stop CloudTrail from the workload account is denied | Cloud security | 2 | P1 |
| 26 | No separated sign-ins | Looking and changing are the same act | small, 1.5 h | Two profiles give two roles; a write under ReadOnly is denied; root has hardware MFA | Cloud security | 2 | P1 |
| 27 | No account activity record | No answer to "what happened?" | small, 1.5 h | The trail is logging; the log bucket refuses a delete | Cloud security | 5, 8 | P1 |
| 28 | Terraform state is local | Lost with the laptop | small, 1 h | `terraform init` reports the remote backend with locking | DevOps | — | P1 |
| 29 | The budget does not fit the design | Nothing can be applied safely | small, 0.5 h | The budget is set to the agreed figure with three alert levels; a test alert arrives | Cloud | — | P1 |
| 30 | No keys per data class | Access is decided by IAM alone | small, 2 h | Three keys exist with rotation on; a role without key permission cannot read an encrypted object | Cloud security | 4 | P1 |
| 31 | No network — part 1: VPC, subnets, flow logs | Nowhere private to put the database | medium, 2 h | No route from a private subnet to the internet gateway; flow-log records are queryable | Cloud | 2 | P1 |
| 32 | Network — part 2: outbound path | Private functions cannot reach Bedrock | small, 2 h | A function in a private subnet reaches an outside address; nothing inbound is allowed | Cloud | 2 | P1 |
| 33 | No managed database | No backups, no recovery | medium, 3 h | The database is encrypted, not publicly accessible, with 7-day point-in-time recovery | Cloud | 4, 9 | P1 |
| 34 | Database credential never rotates | A leak lasts for ever | small, 1.5 h | A rotation runs; the services still connect | Cloud security | 4 | P1 |
| 35 | Services are not deployed — part 1: one service end to end | Prove the path before repeating it | medium, 3 h | The sentiment function answers its health route through API Gateway with a signed call, and refuses an unsigned one | Cloud | 3 | P1 |
| 36 | Services — part 2: the other five | As above | large, 6 h over three days | Each health route answers; each function has its own role | Cloud | 3 | P1 |
| 37 | Frontend is not hosted | No site | medium, 3 h | The site loads over HTTPS on the domain | Cloud | — | P1 |
| 38 | No sign-in service with MFA | Administrators have a password only | medium, 4 h over two days | An administrator cannot sign in without a second factor | Cloud security | 3 | P1 |
| 39 | No edge firewall | Cost abuse and common attacks | small, 2 h | 200 requests in a minute from one address get blocked; the block appears in the log | Cloud security | 3 | P1 |
| 40 | Language model is off-platform | Single-cloud rule; and no guardrails | medium, 3 h | The golden-set score on Bedrock is recorded beside the Groq score; a guardrail blocks a planted attack | AI engineering | — | P2 |
| 41 | Retrieval lives in a file | Not backed up, not shared between functions | medium, 3 h | The index is in the database; the retrieval test passes against it | AI engineering | 4 | P2 |
| 42 | No queue between enquiry and processing | A failed call loses the enquiry | small, 2 h | A forced failure lands the message in the dead-letter queue, and an alarm fires | Cloud | — | P2 |
| 43 | Scheduled jobs need Airflow | A server to run for two jobs | medium, 4 h over two days | The nightly load runs from a schedule, retries once, and its history is visible | Data engineering | — | P2 |
| 44 | No data lake layers with masking | Analysis would touch raw personal data | medium, 4 h over two days | A test finds no personal column in the Gold layer; Athena returns rows | Data engineering | 4 | P2 |
| 45 | No data quality gate | A bad load goes unnoticed | small, 2 h | A planted null-heavy file fails the run | Data engineering | — | P2 |
| 46 | Model training is local | Untraceable model | medium, 3 h | A training job runs from the workflow; the registry shows the version with its metrics, pending approval | ML engineering | — | P2 |
| 47 | No detection | A compromise runs unnoticed | small, 1.5 h | A sample finding reaches the phone within five minutes | Cloud security | 5, 7 | P1 |
| 48 | No single list of findings | Findings get lost | small, 1.5 h | Security Hub shows a benchmark score; the three worst findings are written down with a plan | Cloud security | 5, 10 | P2 |
| 49 | No locked backups, no restore drill | Backups unproven | medium, 3 h | A restore into a fresh database completes inside the 4-hour target; the time is recorded | Cloud | 9 | P1 |
| 50 | No keyless deploy | A stored key in a public repository | medium, 3 h | The deploy log shows an assumed role; the repository holds no cloud secret | DevSecOps | 3 | P1 |
| 51 | No automatic roll-back | A bad release stays up | medium, 2 h | A deliberately broken build is rolled back by itself | DevSecOps | — | P2 |
| 52 | No alarms on errors, latency or cost | Problems found by customers | small, 2 h | An induced error spike raises an alarm; a token-budget alarm fires in a test | Cloud | 5 | P2 |

## Phase 3 — practice track

Each one: switch on, capture the evidence, write half a page on what you learned and what
it cost, switch off.

| # | Practice | What you learn | Effort | The evidence to keep | Skill | C\|CSE | Priority |
|---|---|---|---|---|---|---|---|
| 53 | Config with five chosen rules | Which rules earn their cost | small, 2 h | A rule turns non-compliant when a bucket is made public, and the bill for the week | Cloud security | 5 | P2 |
| 54 | Macie over the lake | What personal-data discovery finds and misses | small, 2 h | The findings list for a planted file, and the cost per gigabyte | Data security | 4 | P2 |
| 55 | Access Analyzer, external and unused access | How to prove least privilege | small, 1.5 h | Findings before and after tightening one role | Cloud security | 2 | P2 |
| 56 | A red-team run mapped to OWASP LLM and MITRE ATLAS | Naming an attack by its technique | medium, 3 h | A table of technique, test, result, fix | AI security | 6 | P1 |
| 57 | A forensics exercise | Preserving before fixing | medium, 3 h | A written timeline rebuilt from the trail and flow logs with Athena, for a staged key leak | Forensics | 8 | P2 |
| 58 | An incident drill with automated containment | What to automate and what needs a person | medium, 3 h | A staged finding triggers quarantine after approval; the timeline is recorded | Incident response | 7 | P2 |
| 59 | A cloud configuration review | Reading a benchmark report critically | small, 2 h | A Prowler report with ten findings triaged: fix, accept, or false positive | Penetration testing | 6 | P2 |
| 60 | A dynamic scan of a preview stack | What a scanner can and cannot see | medium, 3 h | The scan report, and the stack destroyed afterwards | DevSecOps | 6 | P2 |
| 61 | Policy as code on the Terraform plan | Turning a rule into a test | medium, 2 h | Three rules that fail a planted violation | DevSecOps | 10 | P2 |
| 62 | Signed images and a bill of materials | Supply-chain provenance | medium, 2 h | A deploy that refuses an unsigned image | DevSecOps | 3 | P3 |
| 63 | Column-level permissions on the lake | Fine-grained data access | medium, 3 h | An analyst role that cannot select a masked column | Data security | 4 | P3 |
| 64 | Drift monitoring on the estimator | When to retrain | medium, 3 h | A drift report on shifted synthetic data that crosses the threshold | Data science | — | P2 |
| 65 | A scheduled drift check on infrastructure | Catching manual changes | small, 1.5 h | An alert after a manual change in the console | DevSecOps | 5 | P3 |
| 66 | A cross-region backup copy, then removed | Recovery strategies and their cost | small, 2 h | A restore from the copy, and a note on the personal-data transfer question | Continuity | 9, 11 | P3 |

## Not gaps — decided against at this scale

| Not doing | Why |
|---|---|
| Kubernetes | Six small services that idle most of the day |
| A NAT gateway, Network Firewall, Detective, Audit Manager | Each costs more than the workload justifies; described under larger scale |
| A hosted inference endpoint | The model is small; the endpoint bills while idle |
| A managed vector database | Its minimum charge exceeds the whole design |
| A warm standby in a second region | Backup and restore meets the stated targets |

## Counting it up

- Phase 1: 24 items, about 37 hours, no cloud cost.
- Phase 2: 28 items, about 70 hours.
- Phase 3: 14 items, about 33 hours.
- At one item a day, Phase 1 takes about five working weeks.
