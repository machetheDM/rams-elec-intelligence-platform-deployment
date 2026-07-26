# =============================================================================
# Sentiment service — Lambda + Function URL (Module 11)
# =============================================================================
# Billable. Note depends_on the budget on every resource here: it is not
# decoration, it is the ordering guarantee described in budgets.tf.
#
# Expected cost at the traffic this actually sees (an n8n follow-up workflow,
# a few invocations a day): effectively zero. Lambda's free tier is 1M requests
# and 400,000 GB-seconds per month. The realistic cost risk is not per-invoke
# pricing but a runaway loop, which is what reserved_concurrent_executions and
# the log retention below are for.
# =============================================================================

# Created explicitly rather than letting Lambda create it on first invocation.
# An implicitly-created log group has retention "Never expire", so it accrues
# storage charges forever and nothing ever tells you. This is the single most
# common way a "free tier" AWS project starts costing money.
resource "aws_cloudwatch_log_group" "sentiment_lambda" {
  name              = "/aws/lambda/${local.sentiment_function_name}"
  retention_in_days = var.log_retention_days

  depends_on = [aws_budgets_budget.monthly_cost]
}

resource "aws_lambda_function" "sentiment" {
  function_name = local.sentiment_function_name
  description   = "Follow-up comment sentiment scoring (Module 10) behind a Function URL"
  role          = aws_iam_role.sentiment_lambda.arn

  # Flat package: handler lives at the archive root. See scripts/build_lambda.py.
  filename = var.lambda_package_path
  handler  = "lambda_handler.handler"
  runtime  = "python3.12"

  # Must match PYTHON_VERSION/PLATFORM in scripts/build_lambda.py — the package
  # contains cp312 manylinux wheels and will fail to import under any other
  # runtime.
  architectures = ["x86_64"]

  # Redeploy when the package changes, and only then. The build is reproducible
  # (fixed zip timestamps, Windows launchers stripped), so an unchanged rebuild
  # produces an identical hash and no spurious diff on plan.
  source_code_hash = filebase64sha256(var.lambda_package_path)

  memory_size = var.lambda_memory_mb
  timeout     = var.lambda_timeout_seconds

  # A hard ceiling on blast radius. Without it, a caller stuck in a retry loop
  # can scale to the account concurrency limit and turn a bug into a bill before
  # any budget alert arrives — budgets are evaluated on a schedule, not in real
  # time, so the alert lands well after the spend.
  reserved_concurrent_executions = var.lambda_reserved_concurrency

  environment {
    variables = {
      # Not "development" — this is what arms the fail-closed API key gate in
      # security/auth/api_key_middleware.py. If API_KEY_HASHES is missing from
      # SSM, the function raises at import instead of accepting the API keys
      # committed to this repository.
      APP_ENV = "production"

      # Where lambda_handler.py reads configuration at cold start. Secrets are
      # NOT passed as environment variables: anything set here is visible in the
      # console and stored in Terraform state in plaintext.
      CONFIG_SSM_PATH = local.ssm_config_path
    }
  }

  depends_on = [
    aws_budgets_budget.monthly_cost,
    aws_iam_role_policy.sentiment_lambda,
    aws_cloudwatch_log_group.sentiment_lambda,
  ]
}

# authorization_type = "NONE" means AWS performs no authentication — the
# endpoint is open to the internet and authorisation is entirely the
# application's job, via the X-API-Key gate in security/.
#
# AWS_IAM was the alternative and was rejected: the caller is an n8n workflow,
# which would have to implement SigV4 request signing, and the practical outcome
# of that friction is usually a long-lived IAM access key pasted into an n8n
# credential — a worse secret to hold than an API key hash in SSM.
#
# This choice is only defensible because the API key middleware fails closed.
# It did not, until Module 11's first commit; see docs/build-journal.md.
resource "aws_lambda_function_url" "sentiment" {
  function_name      = aws_lambda_function.sentiment.function_name
  authorization_type = "NONE"

  cors {
    allow_origins = var.function_url_allowed_origins
    allow_methods = ["POST"]
    allow_headers = ["content-type", "x-api-key"]
    max_age       = 3600
  }
}
