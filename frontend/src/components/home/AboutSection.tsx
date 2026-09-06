import Image from "next/image";
import Link from "next/link";

/**
 * Mastery Origin — company history and credentials.
 *
 * Copy sourced from the live ramsatelec.com "About" section.
 * No fabricated statistics — only verifiable claims.
 */

const PILLARS = [
  {
    label: "SANS Compliant",
    detail: "Exceeding national safety regulations on every installation",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  },
  {
    label: "Local Mastery",
    detail: "Regional teams across Gauteng and Limpopo on standby",
    icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z",
  },
  {
    label: "Rapid Response",
    detail: "Emergency task force available 24/7, 365 days a year",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    label: "Master Licensed",
    detail: "Fully insured engineering with documented results",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  },
];

export default function AboutSection() {
  return (
    <section id="about" className="relative py-24 lg:py-32">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-12 lg:gap-20">
          {/* Left — image + stats overlay */}
          <div className="lg:col-span-5">
            <div className="relative overflow-hidden rounded-2xl">
              <Image
                src="https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80"
                alt="Electrician working on industrial electrical installation"
                width={800}
                height={600}
                className="object-cover w-full h-auto"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-industrial-950 via-industrial-950/40 to-transparent" />

              {/* Stats overlay at bottom */}
              <div className="absolute bottom-0 inset-x-0 p-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-industrial-700/50 bg-industrial-950/80 backdrop-blur-sm p-3">
                    <p className="stat-figure text-2xl text-brand-500">15+</p>
                    <p className="mt-0.5 text-xs text-industrial-400">Years experience</p>
                  </div>
                  <div className="rounded-lg border border-industrial-700/50 bg-industrial-950/80 backdrop-blur-sm p-3">
                    <p className="stat-figure text-2xl">8</p>
                    <p className="mt-0.5 text-xs text-industrial-400">Service zones</p>
                  </div>
                  <div className="rounded-lg border border-industrial-700/50 bg-industrial-950/80 backdrop-blur-sm p-3">
                    <p className="stat-figure text-2xl">24/7</p>
                    <p className="mt-0.5 text-xs text-industrial-400">Emergency</p>
                  </div>
                  <div className="rounded-lg border border-industrial-700/50 bg-industrial-950/80 backdrop-blur-sm p-3">
                    <p className="stat-figure text-2xl text-brand-500">AI</p>
                    <p className="mt-0.5 text-xs text-industrial-400">Powered quoting</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right — narrative */}
          <div className="lg:col-span-7">
            <span className="mono-label">06 / Mastery Origin</span>
            <h2 className="section-heading mt-4">
              The standard of
              <br />
              <span className="gradient-text">reliability.</span>
            </h2>
            <p className="section-subheading mt-5">
              With over a decade and a half of hands-on industrial mastery, Rams @Elec has
              become the definitive authority in refrigeration and mission-critical electrical
              environments across Gauteng and Limpopo.
            </p>
            <p className="mt-4 text-industrial-400 leading-relaxed">
              From our base in Polokwane Mankweng, we deploy regional teams to Sandton, Midrand,
              Centurion, Pretoria East, Soweto, Mokopane, and Bela-Bela — with specialised equipment
              for every service category.
            </p>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {PILLARS.map((pillar) => (
                <div key={pillar.label} className="flex items-start gap-3 group">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500 ring-1 ring-inset ring-brand-500/20 transition-all group-hover:bg-brand-500 group-hover:text-industrial-950">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={pillar.icon} />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{pillar.label}</h3>
                    <p className="mt-0.5 text-xs text-industrial-400">{pillar.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link href="/gallery" className="btn-outline text-sm">
                View Our Work
                <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link href="/inquire" className="btn-primary text-sm">
                Start a Project
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
