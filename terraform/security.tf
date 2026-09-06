# =============================================================================
# Security Configuration — Rams @Elec Intelligence Platform
# =============================================================================
# WAF policy, Defender for Cloud, Sentinel connection
#
# Designed, never provisioned. CI type-checks this file; it does not deploy it.
# =============================================================================

# ── WAF Policy ─────────────────────────────────────────────────────────

resource "azurerm_web_application_firewall_policy" "main" {
  name                = "rams-elec-waf-policy"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  policy_settings {
    enabled                     = true
    mode                        = "Prevention"
    request_body_check          = true
    file_upload_limit_in_mb     = 10
    max_request_body_size_in_kb = 128
  }

  managed_rules {
    managed_rule_set {
      type    = "OWASP"
      version = "3.2"
    }
  }

  # `rate_limit_duration` is an enum ("OneMin" | "FiveMins"), not a number of
  # minutes — there is no `rate_limit_duration_in_min` argument.
  custom_rules {
    name                 = "RateLimitTriage"
    priority             = 10
    rule_type            = "RateLimitRule"
    rate_limit_duration  = "OneMin"
    rate_limit_threshold = 100

    match_conditions {
      match_variables {
        variable_name = "RequestUri"
      }

      operator           = "Contains"
      negation_condition = false
      match_values       = ["/triage/classify"]
    }

    action = "Block"
  }

  custom_rules {
    name      = "GeoFilterZA"
    priority  = 20
    rule_type = "MatchRule"

    match_conditions {
      match_variables {
        variable_name = "RemoteAddr"
      }

      operator           = "GeoMatch"
      negation_condition = false
      match_values       = ["ZA"]
    }

    action = "Allow"
  }

  tags = {
    Environment = var.environment
  }
}

# ── Defender for Cloud ─────────────────────────────────────────────────

resource "azurerm_security_center_subscription_pricing" "main" {
  tier          = "Standard"
  resource_type = "VirtualMachines"
}

resource "azurerm_security_center_subscription_pricing" "containers" {
  tier          = "Standard"
  resource_type = "Containers"
}

resource "azurerm_security_center_subscription_pricing" "app_services" {
  tier          = "Standard"
  resource_type = "AppServices"
}

resource "azurerm_security_center_subscription_pricing" "sql_servers" {
  tier          = "Standard"
  resource_type = "SqlServers"
}

# `setting_name` is case-sensitive: the provider's allowed values are
# MCAS | WDATP | WDATP_EXCLUDE_LINUX_PUBLIC_PREVIEW | WDATP_UNIFIED_SOLUTION |
# Sentinel. "SENTINEL" is rejected at validate time.
resource "azurerm_security_center_setting" "sentinel" {
  setting_name = "Sentinel"
  enabled      = true
}

# ── Diagnostic Settings ────────────────────────────────────────────────
# azurerm 4.0 removed the `log` and `metric` blocks (and the nested
# `retention_policy` block) from azurerm_monitor_diagnostic_setting. The
# replacements are `enabled_log` and `enabled_metric`, and neither takes a
# retention setting — retention is a property of the Log Analytics workspace,
# set to 90 days in main.tf.

resource "azurerm_monitor_diagnostic_setting" "key_vault" {
  name                       = "keyvault-diagnostics"
  target_resource_id         = azurerm_key_vault.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  enabled_log {
    category = "AuditEvent"
  }

  enabled_metric {
    category = "AllMetrics"
  }
}

resource "azurerm_monitor_diagnostic_setting" "postgresql" {
  name                       = "postgresql-diagnostics"
  target_resource_id         = azurerm_postgresql_flexible_server.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  enabled_log {
    category = "PostgreSQLLogs"
  }

  enabled_metric {
    category = "AllMetrics"
  }
}
