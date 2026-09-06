import Image from "next/image";
import Link from "next/link";
import LoadSheddingWidget from "@/components/loadshedding/LoadSheddingWidget";

/**
 * Landing hero — presentational only.
 *
 * Copy is preserved from the live ramsatelec.com site ("15 Years Mastery",
 * "Engineering Reliability"). The only dynamic child is LoadSheddingWidget,
 * which owns its own data fetching.
 */

const CREDENTIALS = [
  "SANS 10142 Certified",
  "Fully Insured",
  "24/7 Emergency Response",
];

export default function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden">
      {/* Layered background: photo, dark overlay, blueprint grid, amber ignition glows */}
      <div className="absolute inset-0 bg-industrial-950">
        <Image
          src="https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1920&q=80"
          alt=""
          fill
          priority
          className="object-cover opacity-20"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-industrial-950 via-industrial-950/95 to-industrial-950/70" />
        <div className="absolute inset-0 bg-grid mask-fade" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.10),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(245,158,11,0.05),transparent_50%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent" />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-4 py-32 sm:px-6 lg:px-8 lg:py-40">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-12">
          {/* ---- Left: headline ---- */}
          <div className="animate-fade-in lg:col-span-7">
            <div className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
              </span>
              <span className="mono-label">Engineering Since 2011 — 15 Years Mastery</span>
            </div>

            <h1 className="text-5xl font-extrabold leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Engineering
              <br />
              <span className="gradient-text">Reliability.</span>
            </h1>

            <div className="mt-8 max-w-xl border-l-2 border-brand-500/40 pl-5">
              <p className="text-lg leading-relaxed text-industrial-300">
                &ldquo;We don&apos;t just fix wires; we engineer safety and reliability for the
                next decade of your industrial and residential operation.&rdquo;
              </p>
            </div>

            <p className="mt-6 max-w-xl leading-relaxed text-industrial-400">
              Industrial electrical and refrigeration services across Gauteng and Limpopo — now
              with AI-assisted quoting, real-time load-shedding intelligence, and a 24/7
              emergency task force.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link href="/inquire" className="btn-primary text-lg">
                Get an Instant Quote
                <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <a href="tel:+27711018493" className="btn-outline text-lg">
                <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Emergency Line
              </a>
            </div>

            <div className="mt-12">
              <div className="rule-accent" />
              <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3">
                {CREDENTIALS.map((credential) => (
                  <span
                    key={credential}
                    className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-industrial-500"
                  >
                    <svg className="h-3.5 w-3.5 text-brand-500" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {credential}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ---- Right: live load-shedding telemetry ---- */}
          <div className="animate-slide-up lg:col-span-5">
            <LoadSheddingWidget />
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <svg className="h-6 w-6 text-industrial-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </section>
  );
}
