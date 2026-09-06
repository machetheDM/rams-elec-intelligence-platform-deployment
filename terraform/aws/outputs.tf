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

output "gold_glue_database" {
  description = "Glue Data Catalog database Athena queries against for the Gold feature tables."
  value       = aws_glue_catalog_database.gold.name
}

output "gold_glue_crawler" {
  description = "Crawler name — run with `aws glue start-crawler --name <this>` after a new S3 write, since it is on-demand only."
  value       = aws_glue_crawler.gold.name
}

output "sagemaker_execution_role_arn" {
  description = "Role ARN launch_training_job.py passes as --role-arn."
  value       = aws_iam_role.sagemaker_execution.arn
}

output "sagemaker_model_package_group" {
  description = "Model Registry group launch_training_job.py registers approved models into."
  value       = aws_sagemaker_model_package_group.quote_estimator.model_package_group_name
}

output "sagemaker_endpoint_name" {
  description = "Serverless Inference endpoint name, if enable_sagemaker_endpoint is true. Empty otherwise."
  value       = var.enable_sagemaker_endpoint ? aws_sagemaker_endpoint.quote_estimator[0].name : ""
}

output "guardrail_warning" {
  description = "What the budgets do and do not do."
  value       = "AWS Budgets alerts on spend; it does not cap it. An alert is a signal to go and destroy something, not a limit that will stop the charge."
}

# ── Module 11 Phase 1: follow-up Lambda ────────────────────────────────

output "followup_lambda_name" {
  description = "Follow-up trigger function name (for `aws lambda invoke` during verification)"
  value       = aws_lambda_function.followup_trigger.function_name
}

output "followup_schedule_name" {
  description = "EventBridge schedule name — disable with `aws scheduler update-schedule --state DISABLED`"
  value       = aws_scheduler_schedule.followup_trigger.name
}

output "followup_log_group" {
  description = "CloudWatch log group for the follow-up Lambda"
  value       = aws_cloudwatch_log_group.followup_lambda.name
}

output "followup_parameters_to_populate" {
  description = "SSM parameters created empty. Set real values out of band before the first scheduled run — Terraform deliberately never holds them."
  value = [
    aws_ssm_parameter.database_url.name,
    aws_ssm_parameter.n8n_webhook_url.name,
  ]
}
