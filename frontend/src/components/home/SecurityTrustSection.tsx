"use client";

import { useSecurityStatus } from "@/hooks/useSecurityStatus";

/**
 * Security posture — driven by useSecurityStatus.
 *
 * The hook currently resolves from a static dataset (there's no live
 * security-status endpoint yet — see lib/api/security.ts), so its
 * `source` field is rendered verbatim rather than implying a live feed.
 */

export default function SecurityTrustSection() {
  const { status, loading } = useSecurityStatus();

  return (
    <section className="relative py-24 lg:py-32">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-14 max-w-2xl">
          <span className="mono-label">07 / Platform Security</span>
          <h2 className="section-heading mt-4">Built secure, not patched secure.</h2>
          <p className="section-subheading mt-5">
            Your job data, equipment registry and compliance documents sit behind a platform
            hardened to a documented standard — threat-modelled, scanned on every commit, and
            architected against NIST SP 800-207 Zero Trust principles.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* ---- Hardening modules ---- */}
          <div className="tile p-7 lg:col-span-7 lg:p-9">
            <span className="mono-label-muted">Hardening programme</span>

            <div className="mt-6 space-y-1">
              {loading &&
                [0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-4 py-3.5">
                    <div className="h-4 w-4 animate-pulse rounded-full bg-industrial-800" />
                    <div className="h-3 w-48 animate-pulse rounded bg-industrial-800" />
                  </div>
                ))}

              {!loading &&
                status?.modules.map((module) => (
                  <div
                    key={module.id}
                    className="flex items-start gap-4 border-b border-industrial-800/60 py-3.5 last:border-0"
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full ${
                        module.status === "complete"
                          ? "bg-green-500/15 text-green-400"
                          : "bg-industrial-800 text-industrial-500"
                      }`}
                    >
                      {module.status === "complete" ? (
                        <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="h-1 w-1 rounded-full bg-current" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{module.name}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-industrial-400">
                        {module.description}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* ---- Automated scanning ---- */}
          <div className="tile p-7 lg:col-span-5 lg:p-9">
            <span className="mono-label-muted">Automated on every commit</span>

            <div className="mt-6 flex flex-wrap gap-2">
              {loading &&
                [0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-7 w-24 animate-pulse rounded-md bg-industrial-800" />
                ))}

              {!loading &&
                status?.tools.map((tool) => (
                  <span
                    key={tool.name}
                    title={`${tool.type} — ${tool.purpose}`}
                    className="rounded-md border border-industrial-700 bg-industrial-800/60 px-2.5 py-1.5 font-mono text-[11px] text-industrial-300 transition-colors hover:border-brand-600/40 hover:text-brand-400"
                  >
                    {tool.name}
                  </span>
                ))}
            </div>

            <div className="mt-8 space-y-3 border-t border-industrial-800 pt-6">
              <TrustPoint text="API-key gated service-to-service calls" />
              <TrustPoint text="Per-IP rate limiting on every endpoint" />
              <TrustPoint text="Structured audit logging for SIEM ingestion" />
              <TrustPoint text="Prompt-injection sanitisation before any LLM call" />
            </div>

            {status?.source && (
              <p className="mt-7 border-t border-industrial-800 pt-5 text-[11px] leading-relaxed text-industrial-500">
                Source: {status.source}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustPoint({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <svg
        className="mt-1 h-3 w-3 flex-shrink-0 text-brand-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
      </svg>
      <span className="text-xs leading-relaxed text-industrial-300">{text}</span>
    </div>
  );
}
