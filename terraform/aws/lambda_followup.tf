# =============================================================================
# Module 11 Phase 1 — Post-service follow-up trigger on Lambda + EventBridge
# =============================================================================
# Replaces the daily Airflow DAG. See lambda/followup_trigger/handler.py for why
# this workload moved and what it fixes.
#
# Cost: within the perpetual Lambda free tier (1M requests + 400,000 GB-seconds
# per month). This runs 30 times a month for a couple of seconds. EventBridge
# Scheduler is $1.00 per million invocations after 14M free; 30 is free. The
# only line item that can actually accrue is CloudWatch Logs, which is why the
# log group below has an explicit retention period rather than the default of
# "never expire".
# =============================================================================

# ── Configuration in Parameter Store ───────────────────────────────────
# Created empty, on purpose. Terraform must never hold these values: anything
# passed as a variable ends up in terraform.tfstate in plaintext, and the state
# file is the thing most likely to be leaked. The operator writes the real
# values once, out of band:
#
#   aws ssm put-parameter --name /rams-elec/dev/database-url \
#     --type SecureString --value '...' --overwrite
#
# ignore_changes keeps Terraform from reverting them to the placeholder on the
# next apply. Standard-tier parameters are free; SecureString uses the AWS
# managed KMS key, which is also free.

resource "aws_ssm_parameter" "database_url" {
  name        = "${local.param_prefix}/database-url"
  description = "Postgres connection string for the follow-up Lambda"
  type        = "SecureString"
  value       = "PLACEHOLDER — set with aws ssm put-parameter --overwrite"

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "n8n_webhook_url" {
  name        = "${local.param_prefix}/n8n-webhook-url"
  description = "n8n base URL that owns the WhatsApp check-in conversation"
  type        = "SecureString"
  value       = "PLACEHOLDER — set with aws ssm put-parameter --overwrite"

  lifecycle {
    ignore_changes = [value]
  }
}

# ── Execution role ─────────────────────────────────────────────────────
# Deliberately not AWSLambdaBasicExecutionRole. That managed policy grants
# logs:CreateLogGroup on "*", which lets the function create log groups
# anywhere in the account — including ones with no retention policy, outside
# the cost controls above. The inline policy below scopes writes to this
# function's own log group, and the group itself is created by Terraform.

# The `aws_iam_policy_document.lambda_assume_role` this role trusts is declared
# once in iam.tf and shared by both Lambdas. It was duplicated here on the
# branch this came from; the two copies were byte-identical, so the copy was
# removed rather than renamed.

resource "aws_iam_role" "followup_lambda" {
  name               = "rams-elec-${var.environment}-followup-trigger"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

data "aws_iam_policy_document" "followup_lambda" {
  # Write to this function's log stream only. No CreateLogGroup: Terraform owns
  # the group, so the function never needs permission to make one.
  statement {
    sid    = "WriteOwnLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["${aws_cloudwatch_log_group.followup_lambda.arn}:*"]
  }

  # Read exactly the two parameters this function needs, by full ARN. Not
  # ssm:GetParametersByPath on the prefix — that would widen automatically as
  # later phases add parameters under the same path.
  statement {
    sid    = "ReadOwnConfig"
    effect = "Allow"
    actions = [
      "ssm:GetParameter",
    ]
    resources = [
      aws_ssm_parameter.database_url.arn,
      aws_ssm_parameter.n8n_webhook_url.arn,
    ]
  }

  # SecureString decryption. Scoped to the SSM service via the ViaService
  # condition, so this grant cannot be reused to decrypt anything else that
  # happens to use the same AWS managed key.
  statement {
    sid       = "DecryptParameters"
    effect    = "Allow"
    actions   = ["kms:Decrypt"]
    resources = ["arn:aws:kms:${var.aws_region}:${data.aws_caller_identity.current.account_id}:alias/aws/ssm"]

    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${var.aws_region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "followup_lambda" {
  name   = "followup-trigger-least-privilege"
  role   = aws_iam_role.followup_lambda.id
  policy = data.aws_iam_policy_document.followup_lambda.json
}

# ── Logs ───────────────────────────────────────────────────────────────
# Explicit retention. A Lambda that creates its own log group gets "never
# expire", which is the only part of this phase that grows without bound and
# the easiest way to quietly breach a $5 ceiling over months.
resource "aws_cloudwatch_log_group" "followup_lambda" {
  name              = "/aws/lambda/rams-elec-${var.environment}-followup-trigger"
  retention_in_days = var.log_retention_days
}

# ── Function ───────────────────────────────────────────────────────────
# The zip is built by lambda/followup_trigger/build.sh, which pip-installs the
# two pure-Python dependencies into build/ alongside handler.py. Pure Python is
# what makes a plain zip viable — see the handler docstring.
data "archive_file" "followup_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda/followup_trigger/build"
  output_path = "${path.module}/.build/followup_trigger.zip"
}

resource "aws_lambda_function" "followup_trigger" {
  function_name = "rams-elec-${var.environment}-followup-trigger"
  role          = aws_iam_role.followup_lambda.arn
  handler       = "handler.lambda_handler"
  runtime       = "python3.12"

  filename         = data.archive_file.followup_lambda.output_path
  source_code_hash = data.archive_file.followup_lambda.output_base64sha256

  # One SELECT, a few inserts, one HTTP call each. 256 MB is above the point
  # where more memory stops buying proportionally more CPU for this workload;
  # 60s is well clear of the 10s webhook timeout plus connection setup.
  memory_size = 256
  timeout     = 60

  # A daily schedule needs exactly one concurrent execution. Capping it bounds
  # the blast radius of a misconfigured trigger or a manual invoke loop — the
  # difference between a surprise of cents and one of dollars.
  reserved_concurrent_executions = 1

  environment {
    variables = {
      # Path only. The secrets live in Parameter Store precisely so they are
      # not visible here — lambda:GetFunction returns this block in plaintext.
      SSM_PARAM_PREFIX = local.param_prefix
    }
  }

  depends_on = [
    aws_budgets_budget.monthly_cost,
    aws_iam_role_policy.followup_lambda,
    aws_cloudwatch_log_group.followup_lambda,
  ]
}

# ── Schedule ───────────────────────────────────────────────────────────
# EventBridge Scheduler, not an aws_cloudwatch_event_rule. A CloudWatch Events
# cron expression is UTC-only, so "09:00 for the customer" would have to be
# written as an offset and would be wrong whenever that offset changed.
# Scheduler takes an IANA timezone and keeps the civil hour correct on its own.
# SAST has no daylight saving today, so the two are currently equivalent — the
# point is that this one stays correct if that ever stops being true, without
# anyone remembering to edit a cron string.

data "aws_iam_policy_document" "scheduler_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }

    # Without this, any principal that can create a schedule in this account
    # could assume the role. Scoping to the account id closes the confused
    # deputy path.
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_iam_role" "followup_scheduler" {
  name               = "rams-elec-${var.environment}-followup-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume_role.json
}

data "aws_iam_policy_document" "followup_scheduler" {
  statement {
    sid       = "InvokeFollowupLambda"
    effect    = "Allow"
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.followup_trigger.arn]
  }
}

resource "aws_iam_role_policy" "followup_scheduler" {
  name   = "invoke-followup-lambda"
  role   = aws_iam_role.followup_scheduler.id
  policy = data.aws_iam_policy_document.followup_scheduler.json
}

resource "aws_scheduler_schedule" "followup_trigger" {
  name = "rams-elec-${var.environment}-followup-daily"

  schedule_expression          = "cron(0 9 * * ? *)"
  schedule_expression_timezone = var.schedule_timezone

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.followup_trigger.arn
    role_arn = aws_iam_role.followup_scheduler.arn

    # No retries. The handler already rolls back a failed dispatch so the job is
    # picked up tomorrow, and a retry would re-run the SELECT and re-message
    # every customer the first attempt had already succeeded for.
    retry_policy {
      maximum_retry_attempts = 0
    }
  }
}
