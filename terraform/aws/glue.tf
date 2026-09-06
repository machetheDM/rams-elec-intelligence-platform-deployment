# =============================================================================
# Glue — Data Catalog + Crawler for the Gold data lake
# =============================================================================
# etl/loaders/s3_loader.py writes Gold-layer Parquet to
# s3://<artifacts bucket>/gold/dt=YYYY-MM-DD/*.parquet. This file catalogs that
# prefix so Athena (queried directly, and by the Streamlit dashboard in a later
# phase) can read it as a table without a warehouse.
#
# The crawler has no schedule attribute set, which defaults to on-demand only —
# it runs when `aws glue start-crawler` (or a CI step) invokes it, never on a
# timer. A scheduled crawler is the standard way this line item quietly grows a
# bill; there is no scheduled ingestion here for it to keep up with yet.
# =============================================================================

resource "aws_glue_catalog_database" "gold" {
  name        = "${replace(local.name_prefix, "-", "_")}_gold"
  description = "Gold-layer feature tables for the triage quote estimator and Athena analytics."

  depends_on = [aws_budgets_budget.monthly_cost]
}

# Least-privilege crawler role: read the Gold prefix, write to its own Glue
# tables, log to its own group. No wildcard resources, no managed
# AWSGlueServiceRole (which grants broad S3 and Glue access this crawler never
# needs).
data "aws_iam_policy_document" "glue_crawler_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["glue.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "glue_crawler" {
  name               = "${local.name_prefix}-glue-crawler"
  description        = "Execution role for the Gold-layer Glue Crawler — read-only on the gold/ prefix."
  assume_role_policy = data.aws_iam_policy_document.glue_crawler_assume_role.json
}

data "aws_iam_policy_document" "glue_crawler" {
  statement {
    sid    = "ReadGoldPrefix"
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:ListBucket",
    ]

    resources = [
      aws_s3_bucket.artifacts.arn,
      "${aws_s3_bucket.artifacts.arn}/${var.gold_s3_prefix}/*",
    ]
  }

  statement {
    sid    = "WriteOwnCatalogTables"
    effect = "Allow"

    actions = [
      "glue:GetDatabase",
      "glue:GetTable",
      "glue:GetTables",
      "glue:CreateTable",
      "glue:UpdateTable",
      "glue:BatchCreatePartition",
      "glue:GetPartitions",
    ]

    resources = [
      "arn:aws:glue:${var.aws_region}:${data.aws_caller_identity.current.account_id}:catalog",
      aws_glue_catalog_database.gold.arn,
      "${aws_glue_catalog_database.gold.arn}/*",
    ]
  }

  statement {
    sid    = "WriteOwnLogs"
    effect = "Allow"

    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]

    # Glue crawler logs land in a fixed AWS-managed log group name; the
    # crawler name is embedded in the log stream, not the group, so this is
    # scoped as tightly as the service allows.
    resources = [
      "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws-glue/crawlers:*",
    ]
  }
}

resource "aws_iam_role_policy" "glue_crawler" {
  name   = "${local.name_prefix}-glue-crawler"
  role   = aws_iam_role.glue_crawler.id
  policy = data.aws_iam_policy_document.glue_crawler.json
}

resource "aws_glue_crawler" "gold" {
  name          = "${local.name_prefix}-gold-crawler"
  database_name = aws_glue_catalog_database.gold.name
  role          = aws_iam_role.glue_crawler.arn

  # No `schedule` block — on-demand only. See the file header for why.

  s3_target {
    path = "s3://${aws_s3_bucket.artifacts.id}/${var.gold_s3_prefix}/"
  }

  # Partitions by the dt=YYYY-MM-DD prefix s3_loader.py writes. Without this,
  # each new date creates a new table instead of a new partition of the same
  # table, and Athena queries can no longer prune by date.
  configuration = jsonencode({
    Version = 1.0
    Grouping = {
      TableGroupingPolicy = "CombineCompatibleSchemas"
    }
  })

  depends_on = [aws_budgets_budget.monthly_cost]
}
