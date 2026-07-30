# =============================================================================
# Terraform Variables — Rams @Elec Intelligence Platform
# =============================================================================
# All configurable values. No hardcoded secrets.
# Override in terraform.tfvars (git-ignored) or via environment variables.
# =============================================================================

variable "resource_group_name" {
  description = "Azure resource group name"
  type        = string
  default     = "rams-elec-intelligence"
}

variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "southafricanorth"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# ── Network ────────────────────────────────────────────────────────────

variable "vnet_address_space" {
  description = "VNet address space in CIDR notation"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_prefix" {
  description = "Public subnet (Application Gateway)"
  type        = string
  default     = "10.0.1.0/24"
}

variable "private_subnet_prefix" {
  description = "Private subnet (App Services)"
  type        = string
  default     = "10.0.2.0/24"
}

variable "data_subnet_prefix" {
  description = "Data subnet (PostgreSQL, Redis)"
  type        = string
  default     = "10.0.3.0/24"
}

variable "management_subnet_prefix" {
  description = "Management subnet (Airflow, n8n, Streamlit)"
  type        = string
  default     = "10.0.4.0/24"
}

# ── Database ───────────────────────────────────────────────────────────
# No db_admin_username / password variable by design. The PostgreSQL Flexible
# Server authenticates via Entra ID only (main.tf), and the provider refuses an
# `administrator_login` unless password auth is enabled. There is no password to
# name, generate, or store.

# ── Tags ───────────────────────────────────────────────────────────────

variable "tags" {
  description = "Additional tags for all resources"
  type        = map(string)
  default = {
    Project   = "Rams @Elec Intelligence Platform"
    Course    = "ECCU524 Cloud Security (CCSE)"
    Student   = "Dingaan Mahlatse Machethe"
    Institute = "EC-Council University"
  }
}
