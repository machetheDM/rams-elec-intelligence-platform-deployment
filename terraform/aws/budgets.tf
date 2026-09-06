# =============================================================================
# Cost guardrails — apply this BEFORE any billable resource
# =============================================================================
# The ordering is the whole point. A budget created after a runaway resource
# tells you what you already owe; a budget created first tells you while you can
# still act. Terraform's graph does not know this is a guardrail, so the ordering
# is enforced two ways:
#
#   1. Procedurally — `terraform apply -target=aws_budgets_budget.monthly_cost`
#      as step 5 of the README, before the untargeted apply.
#   2. Structurally — every billable resource added to this module must carry
#      `depends_on = [aws_budgets_budget.monthly_cost]`. There are none yet;
#      that line is the price of adding the first one.
#
# Budgets themselves are free (the first two per account), so this file cannot
# be the thing that breaks the ceiling it enforces.
#
# What this does NOT do: stop spending. AWS Budgets notifies; it does not cap.
# A budget action (aws_budgets_budget_action) can attach a deny-all IAM policy
# at 100%, which is the only mechanism that actually halts charges — it is
# deliberately not used here, because an IAM policy that locks the account is a
# larger blast radius than a $5 overrun on a portfolio project. If this ever
# hosts something real, revisit that trade.
# =============================================================================

resource "aws_budgets_budget" "monthly_cost" {
  provider = aws.billing

  name = "rams-elec-monthly-ceiling"

  budget_type = "COST"
  # limit_amount is a string in the AWS provider; the variable is typed as a
  # number so the validation block can actually check it.
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Anchored to the first of the month the budget was introduced. AWS ignores the
  # day-of-month for MONTHLY budgets, but the argument is required.
  time_period_start = var.budget_start_date

  cost_types {
    # Credits and refunds are excluded so the alert reflects what the resources
    # actually cost. Free-tier credits expire; the architecture's real cost
    # should not be hidden behind them and then surface as a surprise later.
    include_credit             = false
    include_refund             = false
    include_discount           = true
    include_other_subscription = true
    include_recurring          = true
    include_subscription       = true
    include_support            = true
    include_tax                = true
    include_upfront            = true
    use_amortized              = false
    use_blended                = false
  }

  # Three actual-spend tripwires plus one forecast. The forecast alert is the
  # useful one: it fires on trajectory, days before the money is spent, which is
  # the only alert that arrives in time to change anything.
  dynamic "notification" {
    for_each = var.actual_alert_thresholds

    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = [var.alert_email]
    }
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}

# A second, much tighter budget on a single day's spend. The monthly budget is
# blind to the shape of the spend: $5 burned evenly over 30 days and $5 burned by
# a misconfigured loop in one afternoon both trip it at the same time, but only
# one of those is recoverable. AWS bills daily, so a daily ceiling catches the
# second case roughly a day after it starts instead of at month end.
resource "aws_budgets_budget" "daily_anomaly" {
  provider = aws.billing

  name              = "rams-elec-daily-tripwire"
  budget_type       = "COST"
  limit_amount      = tostring(var.daily_budget_usd)
  limit_unit        = "USD"
  time_unit         = "DAILY"
  time_period_start = var.budget_start_date

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }
}
