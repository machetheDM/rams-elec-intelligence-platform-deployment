# Terraform — Rams @Elec Cloud Security Architecture

**Module 4 of SecureDevOps Pipeline**
**Applies**: ECCU524 Designing and Implementing Cloud Security (CCSE)

---

## Two root modules — do not confuse them

| Directory | Cloud | Status |
|---|---|---|
| `terraform/` (this one) | Azure | **Designed, never provisioned** — architecture written in HCL |
| `terraform/aws/` | AWS | **Intended to be applied** — Module 11, real account, ~$5/month ceiling |

`terraform` reads only the `.tf` files in the directory it is invoked from; it does not
recurse. So the two providers never load into the same state, and `terraform init` here
initialises Azure only. For the AWS work, `cd terraform/aws` first and read its README —
the budget goes up before anything billable.

The distinction is not cosmetic. Nothing in this directory has ever existed as a real
resource, and the README, the LinkedIn post, and `docs/cloud-security-architecture.md`
all say so. Keep it that way.

---

## ⚠️ Important Notice

These Terraform configurations document the **intended secure cloud deployment architecture** for the Rams @Elec Intelligence Platform on Microsoft Azure. They are designed as Infrastructure as Code (IaC) demonstrating cloud security engineering capabilities.

**These configurations have NOT been applied** — provisioning actual Azure resources incurs costs. They serve as:
1. Academic demonstration of IaC for cloud security (ECCU524 CCSE)
2. Portfolio evidence of Azure security architecture skills
3. Reference implementation for future production deployment

---

## Validated ≠ deployed

CI runs `terraform fmt -check -recursive`, `terraform init -backend=false`, and
`terraform validate` against this directory on every PR (the `terraform-azure` job in
`.github/workflows/ci.yml`).

Be precise about what that does and does not establish:

| Claim | True? |
|---|---|
| The HCL parses and type-checks against the azurerm 4.x provider schema | **Yes** — CI proves it |
| Every argument name and enum value exists in the provider | **Yes** — that is what `validate` checks |
| The architecture would apply cleanly against a real subscription | **No** — never attempted |
| Any resource described here has ever existed | **No** |

`validate` is offline and credential-free: `-backend=false` skips backend
initialisation, and validation type-checks against the downloaded provider schema
without contacting Azure. It cannot detect quota limits, name collisions on globally
unique resources, region SKU availability, or RBAC gaps — only `plan` against a real
subscription would, and that has not been run.

Before this job existed the module had never been checked by any tool, and it did not
type-check. Seven issues were found and fixed: four hard `validate` errors, one
deprecation, and two contradictions that `validate` cannot catch because the provider
enforces them at apply time. See `docs/build-journal.md` for the list. One of them —
`delegated_zone_id`, which is not an azurerm argument at all — would have failed
immediately on any `plan`.

---

## Architecture Summary

```
Internet → Azure Front Door (CDN + DDoS)
         → Application Gateway (WAF v2, OWASP 3.2)
         → Private Subnet (App Services)
         → Data Subnet (PostgreSQL + Redis via Private Endpoints)
         → Management Subnet (Airflow, n8n, Streamlit)

Security: Key Vault, Log Analytics, Sentinel, Defender for Cloud
Identity: Entra ID + Managed Identities (no hardcoded credentials)
```

---

## Files

| File | Purpose |
|------|---------|
| `main.tf` | Resource group, VNet, subnets, NSGs, Key Vault, Log Analytics, private DNS zone, PostgreSQL |
| `variables.tf` | All configurable values (no hardcoded secrets, and no DB credential vars at all) |
| `outputs.tf` | Key resource IDs and endpoints |
| `security.tf` | WAF policy, Defender for Cloud, Sentinel, diagnostic settings |

---

## How to Check It (no credentials, nothing provisioned)

This is what CI does, and the only part of this README that has actually been run:

```bash
cd terraform
terraform fmt -check -recursive
terraform init -backend=false
terraform validate
```

---

## How to Apply (Development Only)

**Never been run.** Everything below is the intended procedure, not a record of one.

```bash
# 1. Login to Azure
az login

# 2. Initialize Terraform
terraform init

# 3. Review the plan
terraform plan -out=tfplan

# 4. Apply (development environment only)
terraform apply tfplan

# 5. Destroy when done
terraform destroy
```

---

## Security Design Decisions

| Decision | Rationale | Reference |
|----------|-----------|-----------|
| Entra ID auth only, no DB password | Nothing to rotate or leak; `password_auth_enabled = false` and no `administrator_login` is set | NIST SP 800-53 IA-5 |
| Private Endpoints for all PaaS | Traffic never leaves Microsoft backbone | CIS Azure 3.1 |
| WAF Prevention mode (not Detection) | Block attacks, don't just log them | OWASP ASVS V1.1 |
| Key Vault with RBAC | Fine-grained access control; audit every access | NIST SP 800-53 AC-6 |
| 90-day log retention | Meets POPIA + compliance minimum | POPIA Section 19 |
| Sentinel SOAR playbooks | Automated incident response reduces MTTR | NIST SP 800-53 IR-4 |

---

## Cost Estimate (Dev Environment)

| Resource | SKU | Estimated Monthly Cost |
|----------|-----|----------------------|
| PostgreSQL Flexible Server | B_Standard_B1ms | ~$25 |
| Key Vault | Standard | ~$0.03/10k transactions |
| Log Analytics | Per GB | ~$2.30/GB |
| VNet + NSGs | Free | $0 |
| **Total (dev)** | | **~$30/month** |

Production would add App Service, Application Gateway, Front Door, Sentinel — approximately $300-500/month.

---

## References

- Azure Terraform Provider: https://registry.terraform.io/providers/hashicorp/azurerm/
- Azure Architecture Center: https://learn.microsoft.com/en-us/azure/architecture/
- CIS Azure Foundations: https://www.cisecurity.org/benchmark/azure
