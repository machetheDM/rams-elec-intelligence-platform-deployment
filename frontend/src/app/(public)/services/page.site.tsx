import Image from "next/image";
import Link from "next/link";

const SERVICES = [
  {
    category: "Electrical",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    items: [
      { name: "Distribution Board Upgrade", cost: "R3,500 – R15,000", response: "1–2 days", desc: "Replace outdated fuse boxes with modern circuit breaker panels. Includes labelling, earth leakage, and surge protection." },
      { name: "Electrical Compliance Audit", cost: "R1,800 – R6,500", response: "2–4 hours", desc: "Full SANS 10142 inspection with detailed report. Required for property sales, insurance, and licensing." },
      { name: "Industrial Wiring", cost: "R5,000 – R35,000", response: "2–5 days", desc: "Three-phase installations for factories, warehouses, and commercial buildings." },
      { name: "Surge Protection Installation", cost: "R1,800 – R8,500", response: "Same day", desc: "Whole-building surge protection against load-shedding spikes and lightning." },
    ],
  },
  {
    category: "Refrigeration & HVAC",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    items: [
      { name: "Cold Room Installation", cost: "R15,000 – R85,000", response: "3–10 days", desc: "Custom-engineered cold rooms for warehouses, supermarkets, and pharmaceutical storage." },
      { name: "Cold Room Repair", cost: "R2,500 – R18,000", response: "2–6 hours", desc: "Compressor replacement, refrigerant recharge, thermostat and door seal repair." },
      { name: "HVAC Installation", cost: "R8,000 – R45,000", response: "1–3 days", desc: "Split units, multi-split, and ducted air conditioning for offices and retail." },
      { name: "HVAC Maintenance", cost: "R1,200 – R4,500", response: "1–2 hours", desc: "Filter replacement, coil cleaning, gas recharge, and drainage check." },
    ],
  },
  {
    category: "Emergency & Backup Power",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    items: [
      { name: "Emergency Electrical Repair", cost: "R900 – R7,500", response: "1 hour", desc: "24/7 response for power failures, tripping breakers, sparking outlets, and faults." },
      { name: "Generator Installation", cost: "R12,000 – R95,000", response: "1–3 days", desc: "Full installation with changeover switch and automatic transfer switch options." },
      { name: "Generator Service", cost: "R1,500 – R5,000", response: "2–4 hours", desc: "Oil change, filter replacement, battery test, and load test every 6 months." },
      { name: "Preventative Maintenance", cost: "R900 – R3,000", response: "1–2 hours", desc: "Quarterly or bi-annual servicing for all electrical and refrigeration equipment." },
    ],
  },
];

const PROCESS_STEPS = [
  { num: "01", title: "Smart Inquiry", desc: "Submit via our AI-routed form. We classify, estimate, and assess urgency instantly." },
  { num: "02", title: "Rapid Deployment", desc: "Nearest regional team dispatched with the right equipment for your system." },
  { num: "03", title: "Precision Execution", desc: "Licensed contractors execute to strict SANS regulations. Every step documented." },
  { num: "04", title: "Ongoing Support", desc: "Follow-ups, maintenance scheduling, and real-time alerts keep systems running." },
];

export default function ServicesPage() {
  return (
    <div className="min-h-screen">
      {/* Hero header with background image */}
      <div className="relative pt-24 pb-20 overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1920&q=80"
          alt=""
          fill
          priority
          className="object-cover opacity-15"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-industrial-950/60 via-industrial-950/80 to-industrial-950" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="mono-label">
            Expert Solutions
          </span>
          <h1 className="mt-3 text-4xl sm:text-5xl lg:text-6xl font-bold text-white">
            Engineering
            <br />
            <span className="gradient-text">Reliability.</span>
          </h1>
          <p className="mt-5 text-industrial-400 max-w-2xl mx-auto text-lg">
            Rams @Elec provides a comprehensive spectrum of electrical and refrigeration mastery
            for environments where failure is not an option. All pricing is indicative — get an
            exact quote via our AI-powered inquiry form.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/inquire" className="btn-primary">
              Request a Quote
              <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link href="/gallery" className="btn-outline">
              View Our Work
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">

        {/* Featured capabilities */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-20">
          <div className="tile-interactive p-6 text-center">
            <div className="w-12 h-12 mx-auto flex items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="mt-4 font-semibold text-white">Cold Room Specialists</h3>
            <p className="mt-2 text-sm text-industrial-400">
              Custom-engineered refrigeration for warehouses, kitchens, and industrial facilities.
            </p>
          </div>
          <div className="tile-interactive p-6 text-center">
            <div className="w-12 h-12 mx-auto flex items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="mt-4 font-semibold text-white">HVAC Solutions</h3>
            <p className="mt-2 text-sm text-industrial-400">
              Advanced climate control optimized for energy efficiency and total comfort.
            </p>
          </div>
          <div className="tile-interactive p-6 text-center">
            <div className="w-12 h-12 mx-auto flex items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="mt-4 font-semibold text-white">Licensed Electrical</h3>
            <p className="mt-2 text-sm text-industrial-400">
              Full-spectrum contracting from high-precision wiring to grid management and audits.
            </p>
          </div>
        </div>

        {/* Section label */}
        <div className="mb-10">
          <span className="mono-label">Service Catalog</span>
          <h2 className="mt-2 text-2xl font-bold text-white">Specific Mastery</h2>
          <p className="mt-2 text-industrial-400 text-sm">
            Browse our specialized offerings. Every service is delivered with focus on compliance and infrastructure health.
          </p>
          <div className="rule-accent mt-4" />
        </div>

        <div className="space-y-20">
          {SERVICES.map((section) => (
            <div key={section.category}>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                  {section.icon}
                </div>
                <h2 className="text-2xl font-bold text-white">{section.category}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.items.map((item) => (
                  <div
                    key={item.name}
                    className="card-glow group"
                  >
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-white group-hover:text-brand-400 transition-colors">
                        {item.name}
                      </h3>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-industrial-800 text-industrial-400 border border-industrial-700">
                        {item.response}
                      </span>
                    </div>
                    <p className="text-sm text-industrial-400 mt-2 leading-relaxed">{item.desc}</p>
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-industrial-800">
                      <span className="text-sm font-semibold text-brand-500">{item.cost}</span>
                      <Link
                        href="/inquire"
                        className="text-sm font-medium text-brand-500 hover:text-brand-400 transition-colors flex items-center gap-1"
                      >
                        Get Quote
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* The Process */}
        <div className="mt-24 mb-20">
          <div className="text-center mb-12">
            <span className="mono-label">The Process</span>
            <h2 className="mt-3 text-3xl font-bold text-white">
              Blueprint to <span className="gradient-text">Mastery</span>
            </h2>
            <p className="mt-3 text-industrial-400 max-w-lg mx-auto">
              We have refined our deployment model to ensure that every inquiry receives
              immediate professional attention through our dedicated portal.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PROCESS_STEPS.map((step) => (
              <div key={step.num} className="tile-interactive p-6 group">
                <span className="font-mono text-3xl font-bold text-industrial-800 group-hover:text-brand-500/30 transition-colors">
                  {step.num}
                </span>
                <h3 className="mt-3 font-semibold text-white group-hover:text-brand-400 transition-colors">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-industrial-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/inquire" className="btn-primary text-sm">
              Start a Project
            </Link>
            <Link href="/gallery" className="btn-outline text-sm">
              See Completed Work
            </Link>
          </div>
        </div>

        {/* Emergency CTA */}
        <div className="p-8 bg-red-950/30 rounded-2xl border border-red-900/50 text-center">
          <div className="w-14 h-14 mx-auto flex items-center justify-center rounded-2xl bg-red-500/10 text-red-400 mb-4">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-red-400">Emergency?</h2>
          <p className="text-red-300/70 mt-2 max-w-md mx-auto">
            For critical failures, power outages, or cold room breakdowns — call our 24/7 task force now.
          </p>
          <a
            href="tel:+27711018493"
            className="btn-emergency mt-6"
          >
            <svg className="mr-2 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            +27 71 101 8493
          </a>
        </div>
      </div>
    </div>
  );
}
