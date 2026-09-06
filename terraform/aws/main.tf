# =============================================================================
# Rams @Elec Intelligence Platform — AWS (Module 11)
# =============================================================================
# Unlike terraform/ (Azure, designed but never provisioned), this root module is
# meant to be applied against a real personal AWS account. Everything in it is
# sized to stay inside a ~$5/month ceiling.
#
# Apply order matters — see budgets.tf and README.md. The cost guardrail goes up
# before anything that can generate a bill.
#
# Prerequisites:
#   1. aws configure   (or AWS_PROFILE — never commit credentials; see .gitignore)
#   2. cd terraform/aws
#   3. cp terraform.tfvars.example terraform.tfvars && edit
#   4. terraform init
#   5. terraform apply -target=aws_budgets_budget.monthly_cost   ← budget FIRST
#   6. terraform apply
# =============================================================================

terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }

  # State is local by default. That is a deliberate choice for a single-operator
  # project: an S3 backend with DynamoDB locking is the correct answer for a team,
  # but it adds a bucket, a table, and their charges to a $5 budget in order to
  # solve a concurrency problem that does not exist here.
  #
  # The trade-off is that terraform.tfstate sits on one laptop in plaintext. It is
  # git-ignored (see the Terraform block in /.gitignore) — that is the control that
  # actually matters, because the failure mode is committing it, not losing it.
  #
  # backend "s3" {
  #   bucket         = "rams-elec-tfstate"
  #   key            = "aws/terraform.tfstate"
  #   region         = "eu-west-1"
  #   encrypt        = true
  #   dynamodb_table = "rams-elec-tfstate-lock"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# AWS Budgets is a global service fronted by a us-east-1 endpoint. Pinning an
# aliased provider makes that explicit rather than depending on whichever region
# the operator happened to configure.
#
# No default_tags here on purpose. Budgets are free and global, so there is no
# cost to allocate, and tagging them would require budgets:TagResource on the
# deploying principal — an extra IAM permission bought for nothing.
provider "aws" {
  alias  = "billing"
  region = "us-east-1"
}

locals {
  name_prefix             = "rams-elec"
  sentiment_function_name = "rams-elec-sentiment"

  # Trailing slash matters: lambda_handler.py derives environment variable names
  # from the segment after the final "/", and the IAM policy appends "*" to this
  # to scope GetParametersByPath.
  ssm_config_path = "/rams-elec/sentiment/"

  common_tags = {
    Project     = "Rams @Elec Intelligence Platform"
    Environment = var.environment
    ManagedBy   = "Terraform"
    Module      = "11-aws-deployment"
    CostCenter  = "personal-portfolio"
  }
}

data "aws_caller_identity" "current" {}
