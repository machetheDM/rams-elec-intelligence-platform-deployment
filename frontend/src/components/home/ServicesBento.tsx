import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Services — asymmetric Bento grid. Purely presentational.
 *
 * Service categories mirror the live ramsatelec.com catalog and the
 * service_category enum the backend validates against
 * (security/input_validation/validators.py): electrical, refrigeration,
 * emergency, maintenance, installation.
 */

interface ServiceTile {
  index: string;
  title: string;
  blurb: string;
  items: string[];
  href: string;
  icon: ReactNode;
  /** Tailwind col/row span classes for the lg 6-column bento grid */
  span: string;
  featured?: boolean;
}

const SERVICES: ServiceTile[] = [
  {
    index: "01",
    title: "Industrial Refrigeration",
    blurb:
      "Cold rooms, chillers and HVAC engineered for continuous duty — where a failure means spoiled stock, not just discomfort.",
    items: ["Cold Room Installation", "Cold Room Repair", "HVAC Systems", "Condenser Servicing"],
    href: "/services",
    span: "lg:col-span-4 lg:row-span-2",
    featured: true,
    icon: <CubeIcon className="h-7 w-7" />,
  },
  {
    index: "02",
    title: "24/7 Emergency",
    blurb: "Dedicated task force. One-hour response on critical failures.",
    items: ["Power Failures", "Cold Room Breakdowns"],
    href: "tel:+27711018493",
    span: "lg:col-span-2",
    icon: <ClockIcon className="h-6 w-6" />,
  },
  {
    index: "03",
    title: "Electrical",
    blurb: "Distribution boards, industrial wiring, and precision load balancing.",
    items: ["DB Upgrades", "Industrial Wiring"],
    href: "/services",
    span: "lg:col-span-2",
    icon: <BoltIcon className="h-6 w-6" />,
  },
  {
    index: "04",
    title: "SANS 10142 Compliance",
    blurb:
      "Certified compliance audits and Certificate of Compliance preparation — documented to survive an insurance claim.",
    items: ["Compliance Audits", "COC Preparation", "Documented Testing"],
    href: "/services",
    span: "lg:col-span-3",
    icon: <ShieldIcon className="h-6 w-6" />,
  },
  {
    index: "05",
    title: "Load-Shedding Resilience",
    blurb:
      "Surge protection, inverters and generator installs engineered for South African grid conditions.",
    items: ["Surge Protection", "Generator Install & Service", "Backup Power"],
    href: "/services",
    span: "lg:col-span-3",
    icon: <PowerIcon className="h-6 w-6" />,
  },
];

export default function ServicesBento() {
  return (
    <section id="solutions" className="relative overflow-hidden py-24 lg:py-36">
      <div className="pointer-events-none absolute inset-0 bg-grid-fine mask-fade opacity-60" />
      {/* Ambient amber wash anchored top-left, echoing the instrumentation panel below */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-brand-500/[0.06] blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header — split axis: narrative left, technical index right */}
        <div className="mb-14 flex flex-col gap-8 lg:mb-20 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="mono-label">02 / Expert Solutions</span>
            <h2 className="section-heading mt-4 text-balance">Professional Mastery</h2>
            <p className="section-subheading mt-5 text-pretty">
              Comprehensive electrical, refrigeration, and cooling services where reliability is
              non-negotiable.
            </p>
          </div>
          <div className="flex items-center gap-4 lg:pb-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-industrial-500">
              Capabilities
            </span>
            <span className="font-mono text-sm tabular-nums text-brand-500">
              {String(SERVICES.length).padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* Accent rule ignites the grid */}
        <div className="rule-accent mb-8" />

        <div className="grid auto-rows-[minmax(0,1fr)] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {SERVICES.map((service) => (
            <ServiceBentoTile key={service.index} service={service} />
          ))}
        </div>

        <div className="mt-12">
          <Link href="/services" className="btn-outline">
            View Full Catalog
            <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}

function ServiceBentoTile({ service }: { service: ServiceTile }) {
  const { index, title, blurb, items, href, icon, span, featured } = service;

  return (
    <Link
      href={href}
      className={`tile-interactive group relative flex flex-col overflow-hidden p-7 ${span} ${
        featured ? "lg:p-10" : ""
      }`}
    >
      {/* Blueprint texture — only the featured tile earns the full grid */}
      {featured && (
        <span className="pointer-events-none absolute inset-0 bg-grid opacity-[0.35] transition-opacity duration-500 group-hover:opacity-60" />
      )}

      {/* Amber edge that ignites on hover */}
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/0 to-transparent transition-all duration-500 group-hover:via-brand-500/70" />

      {/* Technical corner brackets — draw in on hover */}
      <span className="pointer-events-none absolute left-3 top-3 h-4 w-4 border-l border-t border-brand-500/0 transition-all duration-300 group-hover:border-brand-500/50" />
      <span className="pointer-events-none absolute bottom-3 right-3 h-4 w-4 border-b border-r border-brand-500/0 transition-all duration-300 group-hover:border-brand-500/50" />

      <div className="relative flex items-start justify-between gap-4">
        <span
          className={`flex items-center justify-center rounded-lg bg-brand-500/10 text-brand-500 ring-1 ring-inset ring-brand-500/20 transition-all duration-300 group-hover:bg-brand-500 group-hover:text-industrial-950 group-hover:ring-brand-400 ${
            featured ? "h-14 w-14" : "h-12 w-12"
          }`}
        >
          {icon}
        </span>
        <span className="mono-label-muted pt-1 transition-colors group-hover:text-brand-500/70">
          {index}
        </span>
      </div>

      <h3
        className={`relative mt-6 font-bold text-white transition-colors group-hover:text-brand-400 ${
          featured ? "text-2xl tracking-tight lg:text-3xl" : "text-lg"
        }`}
      >
        {title}
      </h3>

      <p
        className={`relative mt-3 leading-relaxed text-industrial-400 ${
          featured ? "max-w-md text-base" : "text-sm"
        }`}
      >
        {blurb}
      </p>

      <ul className={`relative mt-6 space-y-2.5 ${featured ? "lg:mt-8" : ""}`}>
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2.5 text-sm text-industrial-300">
            <svg
              className="h-3.5 w-3.5 flex-shrink-0 text-brand-600 transition-colors group-hover:text-brand-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            {item}
          </li>
        ))}
      </ul>

      <div className="relative mt-auto flex items-center pt-8 font-mono text-[11px] uppercase tracking-[0.15em] text-brand-500/70 transition-colors group-hover:text-brand-400">
        Explore
        <svg
          className="ml-1.5 h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

function CubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function PowerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"
      />
    </svg>
  );
}
