# Security view

Written 9 October 2026 from the code at commit `e99de3f`. Field and file names only: no
values and no data rows.

**Context:** the platform is not deployed and holds only seed data
(`packages/db/prisma/seed.ts`). The gaps below are ranked by what would happen **if it
were put online as it stands** — which is the decision this document is meant to inform.

## 1. Data classification

| Data | Sensitivity | Where it would live | Who can read it as built | Evidence |
|---|---|---|---|---|
| Customers: name, email, phone, address | Personal (POPIA) | PostgreSQL | Anyone who can reach the analytics API routes or the database port | `packages/db/prisma/schema.prisma` (`Customer`) |
| Technicians: name, phone, WhatsApp number | Personal — employees | PostgreSQL | As above | `schema.prisma` (`Technician`) |
| Enquiries: free-text message | Personal, and untrusted input sent to a language model | PostgreSQL; the model provider | Services; the provider | `schema.prisma` (`Inquiry`); `services/triage/main.py` |
| Chatbot conversations | Personal; may contain anything a visitor types | PostgreSQL; the model provider | Services; the provider | `schema.prisma` (`ChatbotConversation`) |
| Follow-up comments and sentiment | Personal opinion | PostgreSQL; the model provider | Services; administrators | `schema.prisma` (`FollowUp`); `services/sentiment/main.py` |
| Users: email, password hash, sessions | Credentials | PostgreSQL | Anyone with database access | `schema.prisma` (`User`, `Account`, `Session`) |
| Equipment, jobs, quotes, maintenance | Business-confidential, tied to a customer | PostgreSQL | As for customers | `schema.prisma` |
| Trained model and retrieval index | Low; the model encodes synthetic data only | Local disk, untracked | The developer | `services/triage/model/metrics.json` |
| Service-to-service API keys | Credential — **three are public by design** | Committed for development | Everyone | `security/auth/api_key_middleware.py` |

**Sent to third parties as built:** enquiry text, chatbot messages and follow-up comments
go to the model provider. Inputs pass a prompt sanitiser first
(`security/input_validation/validators.py`); nothing masks
personal data before it leaves.

## 2. Identities and permissions — today and target

| Identity | Today | Target |
|---|---|---|
| Website administrator | A seeded account with a development password (`packages/db/prisma/seed.ts`); no MFA | Cognito group with MFA; no seeded account in any deployed environment |
| Website customer | Credentials sign-in; portal layouts check the session | Cognito; every API route checks the caller and scopes to their own records |
| Frontend calling the services | One shared key in a server-side variable | A signed call under the frontend's own role |
| Service calling the database | One connection string shared by all | One role per function; database authentication by role |
| Engineer | A local machine | Identity Center: Admin with MFA, ReadOnly by default |
| Pipeline | No cloud access | A keyless role limited to deploys |
| Emergency access | Not defined | Management-account root with hardware MFA, alarm on use |

## 3. Secrets inventory

Names and locations only.

| Secret (name) | Where it lives today | Used by |
|---|---|---|
| `AUTH_SECRET` | Local environment file | Frontend session signing |
| `INTERNAL_API_KEY` | Local environment file | Frontend proxy routes calling the services |
| `DATABASE_URL`, `DIRECT_URL` | Local environment file | Frontend, services, ETL |
| `GROQ_API_KEY` | Local environment file | Triage, chatbot, sentiment, crew |
| `ESKOM_SE_PUSH_API_KEY` | Local environment file | Load-shedding service |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Local environment file | n8n workflows |
| `N8N_BASIC_AUTH_USER`, `N8N_BASIC_AUTH_PASSWORD` | Local environment file | n8n |
| `AIRFLOW__CORE__FERNET_KEY` | Local environment file | Airflow |
| `ADMIN_TOKEN` | Local environment file, **with a fallback value written in code** (`dashboard/main.py:43`, `docker-compose.yml`) | Streamlit dashboard sign-in |
| Three development API keys | **Committed in source, on purpose** | Local development only; refused when `APP_ENV` is not `development` |
| Two SSM parameters | *CONFIGURED* in `terraform/aws/`, never created | Lambda configuration |

Names are from `.env.example` and `docker-compose.yml`.

## 4. Top five security gaps, ranked by risk

| # | Gap | Why it ranks here | Evidence |
|---|---|---|---|
| 1 | **Sixteen of the seventeen frontend API routes have no sign-in check**, and seven of them read the database directly for analytics | Online, anyone could read revenue, customers' enquiries and technician data, and call the dispatch and triage proxies, without an account | `frontend/src/app/api/`; no `middleware.ts` in `frontend/src/` |
| 2 | **Every container port is published on every interface, including the database, Redis, Airflow and n8n** | A host with a public address would expose all twelve directly | `docker-compose.yml` |
| 3 | **Visitor text goes to an external language model with no masking of personal data, no guardrail on the answer, and no test that tries to subvert it** | Prompt injection and leakage of personal data are the first things an attacker — or a regulator — will look at | `services/chatbot/main.py`, `services/triage/main.py`; no evaluation or red-team files |
| 4 | **An administrator account with a known development password is created by the seed script**, and administrators have no MFA | If the seed ran against a real database, the admin section would open to anyone who read the repository — and the repository is public | `packages/db/prisma/seed.ts`; `CLAUDE.md` |
| 5 | **One shared key and one database connection serve all six services**, and there are no backups, no monitoring and no audit trail | One leak reaches everything; a failure or a breach would go unnoticed and unrecoverable | `.env.example`; nothing under `terraform/aws/` creates a database, a backup or an alarm |

**Smaller findings**

- The JWT middleware is written and used by no service (`security/auth/jwt_middleware.py`).
- The Streamlit dashboard's sign-in token has a fallback value in code (`dashboard/main.py:43`).
- The model name in code may be retired; a dead model fails closed into the fallback path, which is safe but silent (`services/triage/main.py`).
- The quote estimator is trained on synthetic data and its figures are labelled as such — keep that label until it is retrained.
- One Airflow DAG sits in a folder the image does not copy (`airflow/dags/loadshedding_ingestion_dag.py`).
- Cloud scanning covers code, dependencies, secrets and images, but not Terraform.

## 5. What is already done well

- A security pipeline with seven scanners that runs weekly and has kept passing (`.github/workflows/security.yml`).
- An API-key gate that fails closed in any environment it does not recognise, with tests (`tests/test_api_key_env_gate.py`).
- Input models that forbid unknown fields and bound lengths, and a prompt sanitiser on text bound for a model.
- A budget that every billable resource depends on, written before anything was provisioned (`terraform/aws/budgets.tf`).
- An honesty rule in the repository itself: synthetic data is labelled, sample testimonials cannot reach a production build, and designed infrastructure is not called deployed.
