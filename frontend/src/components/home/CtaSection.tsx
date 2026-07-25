import Link from "next/link";

/** Closing call-to-action. Copy preserved from the live site. */
export default function CtaSection() {
  return (
    <section className="relative overflow-hidden py-24 lg:py-32">
      <div className="absolute inset-0 bg-gradient-to-b from-industrial-950 to-industrial-900" />
      <div className="pointer-events-none absolute inset-0 bg-grid mask-fade opacity-70" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.07),transparent_60%)]" />

      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <span className="mono-label">06 / Direct Mastery Link</span>
        <h2 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Ready to engineer safety?
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-industrial-400">
          Submit your technical scope. Our platform classifies the job, estimates cost, and
          matches you to the right technician — before anyone picks up a phone.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href="/inquire" className="btn-primary text-lg">
            Launch Inquiry Portal
            <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <a href="tel:+27711018493" className="btn-emergency text-lg">
            <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Call Task Force
          </a>
        </div>

        <div className="mx-auto mt-14 max-w-lg">
          <div className="rule-accent" />
          <div className="mt-6 grid grid-cols-3 gap-6">
            <CtaStat value="15+" label="Years" />
            <CtaStat value="8" label="Service zones" />
            <CtaStat value="24/7" label="Emergency" />
          </div>
        </div>
      </div>
    </section>
  );
}

function CtaStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="stat-figure text-2xl text-brand-500">{value}</p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-industrial-500">
        {label}
      </p>
    </div>
  );
}
