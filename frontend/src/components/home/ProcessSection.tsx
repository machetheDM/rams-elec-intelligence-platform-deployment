import Link from "next/link";

/**
 * Service process — "Blueprint to Mastery" workflow.
 *
 * Preserves the 4-step model from the live ramsatelec.com site, updated
 * to reflect the AI-powered inquiry pipeline this platform actually runs.
 */

const STEPS = [
  {
    number: "01",
    title: "Smart Inquiry",
    description:
      "Submit your details through our AI-routed form. The platform immediately classifies the job type, estimates cost range, and assesses urgency — before a human even looks at it.",
    detail: "NLP classification + XGBoost cost estimation",
    icon: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    number: "02",
    title: "Rapid Deployment",
    description:
      "The nearest regional team is dispatched with the specialised equipment and parts required for your specific system. Load-shedding schedules are factored into scheduling.",
    detail: "Technician matching + EskomSePush integration",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
  },
  {
    number: "03",
    title: "Precision Execution",
    description:
      "Our licensed contractors execute the installation following strict national safety regulations and industrial best practices. Every step is documented.",
    detail: "SANS 10142 compliance + documented testing",
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
  },
  {
    number: "04",
    title: "Ongoing Support",
    description:
      "Post-service follow-ups, maintenance scheduling, and real-time load-shedding alerts keep your systems running at peak efficiency long after the job is done.",
    detail: "Follow-up tracking + predictive maintenance",
    icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  },
];

export default function ProcessSection() {
  return (
    <section className="relative overflow-hidden py-24 lg:py-32">
      <div className="pointer-events-none absolute inset-0 bg-grid-fine mask-fade opacity-40" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 text-center max-w-2xl mx-auto">
          <span className="mono-label">03 / The Process</span>
          <h2 className="section-heading mt-4">
            Blueprint to
            <br />
            <span className="gradient-text">mastery.</span>
          </h2>
          <p className="section-subheading mt-5 mx-auto">
            We have refined our deployment model to ensure that every inquiry receives
            immediate professional attention through our AI-powered platform.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((step, i) => (
            <div
              key={step.number}
              className="tile-interactive group relative p-7"
            >
              {/* Connecting line (hidden on last item, only visible on lg) */}
              {i < STEPS.length - 1 && (
                <div className="hidden lg:block absolute top-12 -right-3 w-6 h-px bg-gradient-to-r from-industrial-700 to-transparent z-10" />
              )}

              {/* Step number */}
              <div className="flex items-center gap-4 mb-5">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500 ring-1 ring-inset ring-brand-500/20 transition-all duration-300 group-hover:bg-brand-500 group-hover:text-industrial-950 group-hover:ring-brand-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={step.icon} />
                  </svg>
                </span>
                <span className="font-mono text-2xl font-bold text-industrial-700 group-hover:text-brand-500/40 transition-colors">
                  {step.number}
                </span>
              </div>

              {/* Content */}
              <h3 className="text-lg font-bold text-white group-hover:text-brand-400 transition-colors">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-industrial-400">
                {step.description}
              </p>

              {/* Technical detail */}
              <div className="mt-4 pt-4 border-t border-industrial-800">
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-brand-500/70">
                  {step.detail}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-14 flex flex-wrap justify-center gap-4">
          <Link href="/inquire" className="btn-primary">
            Start Your Project
            <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <Link href="/gallery" className="btn-outline">
            See Completed Work
          </Link>
        </div>
      </div>
    </section>
  );
}
