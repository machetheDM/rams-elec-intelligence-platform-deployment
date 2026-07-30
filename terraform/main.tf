# =============================================================================
# Rams @Elec Intelligence Platform — Terraform Configuration
# =============================================================================
# Secure cloud deployment architecture on Microsoft Azure.
#
# IMPORTANT: These Terraform configurations document the intended secure
# deployment architecture. This is an academic project — it has never been
# applied, and no Azure resource described here has ever existed.
#
# CI type-checks this module (`terraform fmt -check`, `init -backend=false`,
# `validate`) so the HCL is known-correct against the azurerm provider schema.
# That is a statement about the code, NOT about deployment. Nothing is
# provisioned. See README.md.
#
# Prerequisites, if it were ever applied:
#   1. Azure CLI: az login
#   2. Terraform:  terraform init
#   3. Review variables in variables.tf
#   4. Plan:       terraform plan -out=tfplan
#   5. Apply:      terraform apply tfplan
#
# Reference: ECCU524 Designing and Implementing Cloud Security (CCSE)
# =============================================================================

terraform {
  required_version = ">= 1.6"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }

  # Store state in Azure Storage (uncomment for real deployment)
  # backend "azurerm" {
  #   resource_group_name  = "rams-elec-tfstate"
  #   storage_account_name = "ramselectfstate"
  #   container_name       = "tfstate"
  #   key                  = "prod.terraform.tfstate"
  # }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = false
      recover_soft_deleted_key_vaults = true
    }
    resource_group {
      prevent_deletion_if_contains_resources = true
    }
  }
}

# ── Resource Group ─────────────────────────────────────────────────────

resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location

  tags = {
    Project     = "Rams @Elec Intelligence Platform"
    Environment = var.environment
    ManagedBy   = "Terraform"
    Security    = "ECCU524-CCSE"
  }
}

# ── Virtual Network ────────────────────────────────────────────────────

resource "azurerm_virtual_network" "main" {
  name                = "rams-elec-vnet"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  address_space       = [var.vnet_address_space]

  tags = {
    Environment = var.environment
  }
}

# ── Subnets ────────────────────────────────────────────────────────────

resource "azurerm_subnet" "public" {
  name                 = "public-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [var.public_subnet_prefix]
}

resource "azurerm_subnet" "private" {
  name                 = "private-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [var.private_subnet_prefix]

  delegation {
    name = "app-service-delegation"
    service_delegation {
      name    = "Microsoft.Web/serverFarms"
      actions = ["Microsoft.Network/virtualNetworks/subnets/action"]
    }
  }
}

resource "azurerm_subnet" "data" {
  name                 = "data-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [var.data_subnet_prefix]

  delegation {
    name = "postgresql-delegation"
    service_delegation {
      name    = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

resource "azurerm_subnet" "management" {
  name                 = "management-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [var.management_subnet_prefix]
}

# ── Network Security Groups ────────────────────────────────────────────

resource "azurerm_network_security_group" "public" {
  name                = "public-nsg"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  security_rule {
    name                       = "AllowHTTPSFromFrontDoor"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "AzureFrontDoor.Backend"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "DenyAllInbound"
    priority                   = 4096
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}

resource "azurerm_network_security_group" "private" {
  name                = "private-nsg"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  security_rule {
    name                       = "AllowFromPublicSubnet"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_ranges    = ["3000", "8001", "8002", "8003", "8004"]
    source_address_prefix      = var.public_subnet_prefix
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "DenyInternetInbound"
    priority                   = 4096
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "Internet"
    destination_address_prefix = "*"
  }
}

resource "azurerm_network_security_group" "data" {
  name                = "data-nsg"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  security_rule {
    name                       = "AllowPostgreSQLFromPrivate"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "5432"
    source_address_prefix      = var.private_subnet_prefix
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "AllowPostgreSQLFromManagement"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "5432"
    source_address_prefix      = var.management_subnet_prefix
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "DenyAllInbound"
    priority                   = 4096
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}

# Associate NSGs with subnets
resource "azurerm_subnet_network_security_group_association" "public" {
  subnet_id                 = azurerm_subnet.public.id
  network_security_group_id = azurerm_network_security_group.public.id
}

resource "azurerm_subnet_network_security_group_association" "private" {
  subnet_id                 = azurerm_subnet.private.id
  network_security_group_id = azurerm_network_security_group.private.id
}

resource "azurerm_subnet_network_security_group_association" "data" {
  subnet_id                 = azurerm_subnet.data.id
  network_security_group_id = azurerm_network_security_group.data.id
}

# ── Azure Key Vault ────────────────────────────────────────────────────

resource "azurerm_key_vault" "main" {
  name                       = "rams-elec-kv-${var.environment}"
  resource_group_name        = azurerm_resource_group.main.name
  location                   = azurerm_resource_group.main.location
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = 90
  purge_protection_enabled   = true
  rbac_authorization_enabled = true

  network_acls {
    default_action = "Deny"
    bypass         = "AzureServices"
  }

  tags = {
    Environment = var.environment
  }
}

# ── Log Analytics Workspace ────────────────────────────────────────────

resource "azurerm_log_analytics_workspace" "main" {
  name                = "rams-elec-law-${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "PerGB2018"

  # Retention lives here, not on the diagnostic settings in security.tf.
  # azurerm 4.0 removed the per-setting `retention_policy` block, so the
  # workspace retention is what backs the 90-day POPIA claim in README.md.
  retention_in_days = 90

  tags = {
    Environment = var.environment
  }
}

# ── Private DNS Zone (PostgreSQL) ──────────────────────────────────────
# azurerm rejects `delegated_subnet_id` without `private_dns_zone_id` — the two
# are a pair, not independent options. The zone name MUST end in
# `.postgres.database.azure.com` or the service refuses it.

resource "azurerm_private_dns_zone" "postgres" {
  name                = "rams-elec-${var.environment}.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.main.name

  tags = {
    Environment = var.environment
  }
}

resource "azurerm_private_dns_zone_virtual_network_link" "postgres" {
  name                  = "postgres-dns-link"
  private_dns_zone_name = azurerm_private_dns_zone.postgres.name
  resource_group_name   = azurerm_resource_group.main.name
  virtual_network_id    = azurerm_virtual_network.main.id
}

# ── PostgreSQL Flexible Server ─────────────────────────────────────────

resource "azurerm_postgresql_flexible_server" "main" {
  name                = "rams-elec-pg-${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  sku_name   = "B_Standard_B1ms"
  version    = "15"
  storage_mb = 32768

  # Entra ID only — deliberately no `administrator_login`/`administrator_password`.
  # The provider requires `password_auth_enabled = true` before it will accept an
  # administrator_login at all, so setting one here while disabling password auth
  # (as this file previously did) can never apply. `tenant_id` is required
  # whenever active_directory_auth_enabled is true.
  #
  # The AAD administrator is a real directory principal, so it is granted
  # out-of-band rather than hardcoded: this module invents no object IDs.
  authentication {
    active_directory_auth_enabled = true
    password_auth_enabled         = false
    tenant_id                     = data.azurerm_client_config.current.tenant_id
  }

  # Public access must be off once the server is on a delegated subnet.
  delegated_subnet_id           = azurerm_subnet.data.id
  private_dns_zone_id           = azurerm_private_dns_zone.postgres.id
  public_network_access_enabled = false

  # The zone link must exist before the server, or the service cannot register
  # the server's DNS record.
  depends_on = [azurerm_private_dns_zone_virtual_network_link.postgres]

  tags = {
    Environment = var.environment
  }
}

# ── Data Sources ───────────────────────────────────────────────────────

data "azurerm_client_config" "current" {}
