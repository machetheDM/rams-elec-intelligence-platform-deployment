# =============================================================================
# IAM — least privilege for the sentiment Lambda
# =============================================================================
# Every statement here is scoped to a specific ARN. No wildcards on resources,
# and no managed policies: AWSLambdaBasicExecutionRole grants logs:* on "*",
# which is more than this function needs and is the usual way a role quietly
# accumulates reach.
# =============================================================================

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "sentiment_lambda" {
  name               = "rams-elec-sentiment-lambda"
  description        = "Execution role for the sentiment analysis Function URL"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

data "aws_iam_policy_document" "sentiment_lambda" {
  # Logging, scoped to this function's own log group rather than logs:* on "*".
  statement {
    sid    = "WriteOwnLogs"
    effect = "Allow"

    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]

    resources = ["${aws_cloudwatch_log_group.sentiment_lambda.arn}:*"]
  }

  # Configuration read at cold start — see services/sentiment/lambda_handler.py.
  # GetParametersByPath is what the handler calls; GetParameter is not granted
  # because nothing uses it.
  statement {
    sid    = "ReadOwnConfiguration"
    effect = "Allow"

    actions = ["ssm:GetParametersByPath"]

    resources = [
      "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${local.ssm_config_path}*",
    ]
  }

  # SecureString parameters are encrypted with the AWS-managed SSM key, so the
  # role needs Decrypt on it. Scoped by the ViaService condition, so this cannot
  # be used to decrypt anything that did not come through SSM in this region.
  statement {
    sid    = "DecryptConfigurationParameters"
    effect = "Allow"

    actions   = ["kms:Decrypt"]
    resources = [data.aws_kms_key.ssm.arn]

    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${var.aws_region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "sentiment_lambda" {
  name   = "rams-elec-sentiment-lambda"
  role   = aws_iam_role.sentiment_lambda.id
  policy = data.aws_iam_policy_document.sentiment_lambda.json
}

data "aws_kms_key" "ssm" {
  key_id = "alias/aws/ssm"
}
