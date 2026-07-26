# =============================================================================
# S3 — triage model artifacts
# =============================================================================
# Holds the XGBoost quote estimator's *.pkl and metrics.json, which are
# git-ignored (see the ML Artifacts section of /.gitignore) and therefore have
# no home that survives a machine rebuild.
#
# Storage cost is negligible — the artifacts are a few MB, and 5GB of Standard
# storage is roughly $0.12/month. The lifecycle rule below exists to stop
# versioning from turning "a few MB" into unbounded growth.
# =============================================================================

resource "aws_s3_bucket" "artifacts" {
  bucket = "${local.name_prefix}-artifacts-${data.aws_caller_identity.current.account_id}"

  depends_on = [aws_budgets_budget.monthly_cost]
}

# Private, and provably so. This is the default in current AWS accounts, but it
# is set explicitly because "the default protects me" is an assumption that
# stops being true the moment the bucket is recreated in an older account or the
# default changes.
resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      # SSE-S3, not SSE-KMS. A customer-managed KMS key would add $1/month —
      # 20% of the entire budget — to encrypt a model artifact that contains no
      # personal data and is already private. Revisit if the bucket ever holds
      # customer records.
      sse_algorithm = "AES256"
    }
  }
}

# Versioning is on so that overwriting a model with a worse one is recoverable —
# retraining writes to the same key, and the previous artifact is the only way
# back to a known MAE.
resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Versioning without expiry is an unbounded bill. Old versions are kept long
# enough to roll back a bad retrain and no longer.
resource "aws_s3_bucket_lifecycle_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    id     = "expire-old-model-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = var.artifact_version_retention_days
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  depends_on = [aws_s3_bucket_versioning.artifacts]
}
