# =============================================================================
# Variables — AWS (Module 11)
# =============================================================================
# No secrets here and none in terraform.tfvars either. Runtime secrets belong in
# SSM Parameter Store (SecureString), read by the Lambda execution role at
# invocation. A value passed through Terraform is written to terraform.tfstate
# in plaintext, which is exactly what encrypting it was meant to prevent.
#
# Rationale lives in comments above each variable rather than in heredoc
# descriptions, so `terraform fmt` sees only single-line attributes.
# =============================================================================

# Default is eu-west-1 (Ireland), not af-south-1 (Cape Town), despite the
# business being South African. af-south-1 is an opt-in region that has to be
# enabled per-account, and it prices roughly 15-20% above eu-west-1. For a
# service invoked a few times a day by an n8n workflow, the extra ~180ms of
# latency is invisible and the cost difference is not. Override if that changes.
variable "aws_region" {
  description = "Region for all non-global resources."
  type        = string
  default     = "eu-west-1"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)."
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# ── Cost guardrails ────────────────────────────────────────────────────

# Required — there is no sensible default, and a budget nobody is notified
# about is decoration. This address lands in terraform.tfstate and in the AWS
# console. It is not secret, but it is personal data, which is one more reason
# terraform.tfvars is git-ignored.
variable "alert_email" {
  description = "Email address that receives budget alerts."
  type        = string

  validation {
    condition     = can(regex("^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$", var.alert_email))
    error_message = "alert_email must be a valid email address."
  }
}

variable "monthly_budget_usd" {
  description = "Monthly cost ceiling in USD. Alerts only — AWS Budgets does not cap spend."
  type        = number
  default     = 5

  validation {
    condition     = var.monthly_budget_usd > 0 && var.monthly_budget_usd <= 50
    error_message = "monthly_budget_usd must be between 0 and 50. This is a portfolio project; a larger ceiling is almost certainly a typo."
  }
}

# Set well above a normal day's spend (which should be near zero) and well
# below the monthly ceiling, so it fires on a runaway resource rather than on
# ordinary usage.
variable "daily_budget_usd" {
  description = "Daily cost tripwire in USD."
  type        = number
  default     = 1

  validation {
    condition     = var.daily_budget_usd > 0
    error_message = "daily_budget_usd must be greater than 0."
  }
}

variable "actual_alert_thresholds" {
  description = "Percentages of the monthly ceiling at which an actual-spend alert fires."
  type        = list(number)
  default     = [50, 80, 100]

  validation {
    condition     = alltrue([for t in var.actual_alert_thresholds : t > 0 && t <= 100])
    error_message = "Each threshold must be between 1 and 100."
  }
}

# ── Lambda ─────────────────────────────────────────────────────────────

# Built by scripts/build_lambda.py, which writes here. Relative to this root
# module, so `terraform apply` from terraform/aws/ resolves it without an
# absolute path. dist/ is git-ignored — the artifact is built, not committed.
variable "lambda_package_path" {
  description = "Path to the deployment zip built by scripts/build_lambda.py."
  type        = string
  default     = "../../dist/sentiment-lambda.zip"
}

# 512MB is not about memory. Lambda allocates CPU proportionally, and the cold
# start here is dominated by importing fastapi/pydantic/groq — at 128MB that is
# several seconds, at 512MB roughly a quarter of it. Since billing is
# GB-seconds, the faster tier often costs the same or less for an import-bound
# function.
variable "lambda_memory_mb" {
  description = "Lambda memory allocation in MB (also determines CPU share)."
  type        = number
  default     = 512

  validation {
    condition     = var.lambda_memory_mb >= 128 && var.lambda_memory_mb <= 1769
    error_message = "lambda_memory_mb must be between 128 and 1769 (1769MB is one full vCPU)."
  }
}

# The upstream Groq call is the only slow part. Long enough to absorb a slow
# completion, short enough that a hung request cannot bill for minutes.
variable "lambda_timeout_seconds" {
  description = "Lambda execution timeout in seconds."
  type        = number
  default     = 30

  validation {
    condition     = var.lambda_timeout_seconds > 0 && var.lambda_timeout_seconds <= 60
    error_message = "lambda_timeout_seconds must be between 1 and 60. This endpoint makes one LLM call; a longer ceiling only lets a hung request bill for longer."
  }
}

# Real traffic is a handful of invocations a day. This caps a retry loop or a
# scripted flood at a few concurrent executions instead of the account limit —
# budget alerts are evaluated on a schedule and would arrive long after the
# spend.
variable "lambda_reserved_concurrency" {
  description = "Maximum concurrent executions. A hard ceiling on runaway cost."
  type        = number
  default     = 5

  validation {
    condition     = var.lambda_reserved_concurrency >= 1 && var.lambda_reserved_concurrency <= 20
    error_message = "lambda_reserved_concurrency must be between 1 and 20."
  }
}

variable "log_retention_days" {
  description = "CloudWatch log retention. Never leave this unset — the default is to keep logs forever."
  type        = number
  default     = 14

  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90], var.log_retention_days)
    error_message = "log_retention_days must be one of the shorter CloudWatch retention values: 1, 3, 5, 7, 14, 30, 60, 90."
  }
}

# The browser never calls this endpoint — n8n does, server-side. An empty list
# means no origin is granted CORS access, which is the correct default for a
# service-to-service API. Add an origin only if something in a browser genuinely
# needs it, and never "*".
variable "function_url_allowed_origins" {
  description = "CORS origins permitted on the Function URL. Empty by design."
  type        = list(string)
  default     = []

  validation {
    condition     = !contains(var.function_url_allowed_origins, "*")
    error_message = "Refusing a wildcard CORS origin on a public Function URL."
  }
}

# ── S3 artifacts ───────────────────────────────────────────────────────

variable "artifact_version_retention_days" {
  description = "Days to keep superseded model artifact versions before expiry."
  type        = number
  default     = 30

  validation {
    condition     = var.artifact_version_retention_days >= 1
    error_message = "artifact_version_retention_days must be at least 1."
  }
}

# ── Budget anchor ──────────────────────────────────────────────────────

# AWS ignores the day for MONTHLY and DAILY budgets but requires the argument.
# Pin it rather than using timestamp(), which would mark the budget as changed
# on every plan.
variable "budget_start_date" {
  description = "Budget period anchor, format YYYY-MM-DD_HH:MM."
  type        = string
  default     = "2026-08-01_00:00"

  validation {
    condition     = can(regex("^[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{2}:[0-9]{2}$", var.budget_start_date))
    error_message = "budget_start_date must match YYYY-MM-DD_HH:MM."
  }
}
