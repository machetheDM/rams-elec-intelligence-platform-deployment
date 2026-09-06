# =============================================================================
# SageMaker — Model Registry + (optional) Serverless Inference
# =============================================================================
# Training jobs themselves are NOT a Terraform resource here — they're
# submitted imperatively by services/triage/sagemaker/launch_training_job.py,
# the same way a CI pipeline would. Terraform manages the durable pieces: the
# IAM role the job assumes, and the Model Registry it registers into.
#
# The Serverless Inference endpoint IS defined here, but count-gated behind
# var.enable_sagemaker_endpoint (default false). Reason: aws_sagemaker_model
# requires an existing S3 model artifact (model_data_url), and there is no
# artifact until launch_training_job.py has run once. A `count = 0` resource
# costs nothing and fails no plan; flip the variable once a model package has
# been approved in the registry.
#
# Serverless Inference specifically (not a real-time endpoint) because it has
# no idle cost — billed per invocation + duration, exactly the "Azure
# Function-equivalent" cost shape the rest of this module already uses for
# the sentiment Lambda.
# =============================================================================

resource "aws_sagemaker_model_package_group" "quote_estimator" {
  model_package_group_name        = "rams-elec-quote-estimator"
  model_package_group_description = "XGBoost quote estimator, trained via launch_training_job.py. Mirrors services/triage/train_model.py's local model, on SageMaker."

  depends_on = [aws_budgets_budget.monthly_cost]
}

# ── IAM — training job + endpoint execution role ───────────────────────────
#
# One role for both training and hosting, scoped to exactly what each needs.
# No AmazonSageMakerFullAccess: that managed policy grants create/delete on
# every SageMaker resource type in the account, which this role has no
# business having.

data "aws_iam_policy_document" "sagemaker_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["sagemaker.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "sagemaker_execution" {
  name               = "${local.name_prefix}-sagemaker-execution"
  description        = "Execution role for quote estimator training jobs and (if enabled) the serverless endpoint."
  assume_role_policy = data.aws_iam_policy_document.sagemaker_assume_role.json
}

data "aws_iam_policy_document" "sagemaker_execution" {
  # Training reads Gold Parquet and the CSV channels launch_training_job.py
  # uploads; both live under the same artifacts bucket. Hosting reads the
  # model.tar.gz the training job wrote back to it.
  statement {
    sid    = "ReadWriteArtifactsBucket"
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:ListBucket",
    ]

    resources = [
      aws_s3_bucket.artifacts.arn,
      "${aws_s3_bucket.artifacts.arn}/*",
    ]
  }

  statement {
    sid    = "WriteOwnLogs"
    effect = "Allow"

    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]

    # SageMaker's own log group naming convention (/aws/sagemaker/*), not the
    # blanket "*" AmazonSageMakerFullAccess grants.
    resources = [
      "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/sagemaker/*",
    ]
  }

  # Training jobs run inside AWS's prebuilt XGBoost container image, pulled
  # from a public SageMaker ECR repository — this is read-only image pull,
  # not access to any account-owned repository.
  statement {
    sid    = "PullTrainingContainerImage"
    effect = "Allow"

    actions = [
      "ecr:GetAuthorizationToken",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]

    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "sagemaker_execution" {
  name   = "${local.name_prefix}-sagemaker-execution"
  role   = aws_iam_role.sagemaker_execution.id
  policy = data.aws_iam_policy_document.sagemaker_execution.json
}

# ── Serverless Inference — gated, off by default ────────────────────────────

resource "aws_sagemaker_model" "quote_estimator" {
  count = var.enable_sagemaker_endpoint ? 1 : 0

  name               = "${local.name_prefix}-quote-estimator"
  execution_role_arn = aws_iam_role.sagemaker_execution.arn

  primary_container {
    # Same framework image family the training job used (XGBoost 1.7-1) —
    # inference and training containers must be compatible versions, or the
    # model this loads was never actually produced by this configuration.
    image          = var.sagemaker_xgboost_image_uri
    model_data_url = var.sagemaker_model_data_url
  }

  depends_on = [aws_budgets_budget.monthly_cost]
}

resource "aws_sagemaker_endpoint_configuration" "quote_estimator" {
  count = var.enable_sagemaker_endpoint ? 1 : 0

  name = "${local.name_prefix}-quote-estimator-config"

  production_variants {
    variant_name = "AllTraffic"
    model_name   = aws_sagemaker_model.quote_estimator[0].name

    serverless_config {
      # Smallest serverless memory tier. XGBoost inference on a few hundred
      # KB model is not memory-bound; this is the cheap default, not a
      # tuned one.
      memory_size_in_mb = 2048
      max_concurrency   = 5
    }
  }

  depends_on = [aws_budgets_budget.monthly_cost]
}

resource "aws_sagemaker_endpoint" "quote_estimator" {
  count = var.enable_sagemaker_endpoint ? 1 : 0

  name                 = "${local.name_prefix}-quote-estimator"
  endpoint_config_name = aws_sagemaker_endpoint_configuration.quote_estimator[0].name

  depends_on = [aws_budgets_budget.monthly_cost]
}
