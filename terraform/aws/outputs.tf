# =============================================================================
# Outputs — AWS (Module 11)
# =============================================================================
# Outputs are stored in state and printed to the terminal. Nothing secret goes
# here: no API keys, no SSM SecureString values, no Function URL once one exists
# unless it is genuinely public.
# =============================================================================

output "account_id" {
  description = "AWS account these resources live in — check before applying."
  value       = data.aws_caller_identity.current.account_id
}

output "region" {
  description = "Region for non-global resources."
  value       = var.aws_region
}

output "monthly_budget" {
  description = "The cost ceiling now being enforced, and where alerts go."

  value = {
    name       = aws_budgets_budget.monthly_cost.name
    limit_usd  = var.monthly_budget_usd
    thresholds = var.actual_alert_thresholds
    notifies   = var.alert_email
  }
}

output "daily_tripwire_usd" {
  description = "Single-day spend that triggers an immediate alert."
  value       = var.daily_budget_usd
}

# Public by construction — authorization_type is NONE and authorisation is the
# application's API key gate. Printing it leaks nothing that a port scan of the
# lambda-url namespace would not find; the secret is the key, not the address.
output "sentiment_function_url" {
  description = "Public HTTPS endpoint for the sentiment service. Requires X-API-Key."
  value       = aws_lambda_function_url.sentiment.function_url
}

output "artifacts_bucket" {
  description = "Private bucket holding triage model artifacts."
  value       = aws_s3_bucket.artifacts.id
}

output "sentiment_log_group" {
  description = "CloudWatch log group for the sentiment function."
  value       = aws_cloudwatch_log_group.sentiment_lambda.name
}

# Names only — the values are SecureStrings and must never be output.
output "ssm_config_path" {
  description = "SSM Parameter Store prefix the function reads configuration from."
  value       = local.ssm_config_path
}

output "guardrail_warning" {
  description = "What the budgets do and do not do."
  value       = "AWS Budgets alerts on spend; it does not cap it. An alert is a signal to go and destroy something, not a limit that will stop the charge."
}
