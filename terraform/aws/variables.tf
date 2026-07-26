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
