/**
 * Security posture data — pure data, no React and no markup.
 *
 * Unlike `@/lib/api/triage.ts` and `@/lib/api/chatbot.ts`, there is no
 * backend endpoint for this yet — no service in this repo currently
 * publishes a "security status" API. Rather than fabricate live-looking
 * numbers, this returns the real, documented SecureDevOps posture from
 * this repo's README (the 5 completed coursework modules + the actual
 * scanning tools wired into .github/workflows/security.yml) as a static
 * dataset. It is intentionally still async/Promise-based, matching the
 * shape of a real API client, so the day a real endpoint exists (e.g.
 * surfacing the latest GitHub Actions security.yml run), only this
 * function's body changes — every consumer (the hook, any UI) stays
 * exactly as it is.
 */

export interface SecurityModule {
  id: string;
  name: string;
  description: string;
  status: "complete" | "in_progress" | "planned";
}

export interface SecurityTool {
  name: string;
  type: string;
  purpose: string;
}

export interface SecurityStatus {
  modules: SecurityModule[];
  tools: SecurityTool[];
  /** Where this data is sourced from — surface this in the UI so it never reads as a live claim it isn't. */
  source: string;
}

const STATIC_SECURITY_STATUS: SecurityStatus = {
  source: "README.md — SecureDevOps Pipeline (static, not a live feed)",
  modules: [
    {
      id: "module-1",
      name: "Security Audit",
      description: "OWASP Top 10 + STRIDE threat model",
      status: "complete",
    },
    {
      id: "module-2",
      name: "Secure Coding",
      description: "Input validation, API-key + JWT auth, security headers, audit logging",
      status: "complete",
    },
    {
      id: "module-3",
      name: "CI/CD Pipeline",
      description: "6-job DevSecOps workflow — SAST, SCA, secret scanning, container scanning",
      status: "complete",
    },
    {
      id: "module-4",
      name: "Cloud Security Architecture",
      description: "Azure design, Terraform IaC, Zero Trust implementation guide",
      status: "complete",
    },
    {
      id: "module-5",
      name: "Documentation",
      description: "Security runbook, README, portfolio write-up",
      status: "complete",
    },
  ],
  tools: [
    { name: "Bandit", type: "SAST", purpose: "Python vulnerability scanning" },
    { name: "Safety", type: "SCA", purpose: "Python dependency CVE detection" },
    { name: "pip-audit", type: "SCA", purpose: "Python dependency CVE detection (PyPA advisory database)" },
    { name: "npm audit", type: "SCA", purpose: "Node.js dependency CVE detection" },
    { name: "ESLint Security", type: "SAST", purpose: "JavaScript security anti-patterns" },
    { name: "detect-secrets", type: "Secret scanning", purpose: "Credential detection in codebase" },
    { name: "truffleHog", type: "Secret scanning", purpose: "Git history secret detection" },
    { name: "Trivy", type: "Container scanning", purpose: "Docker image CVE detection (all 7 service images)" },
  ],
};

export async function fetchSecurityStatus(): Promise<SecurityStatus> {
  return STATIC_SECURITY_STATUS;
}
