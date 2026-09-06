"use client";

import { useTestimonials } from "@/hooks/useTestimonials";
import type { Testimonial } from "@/lib/api/testimonials";

/**
 * Client trust section.
 *
 * Renders real testimonials when they exist. When none do, it renders a panel
 * of *verifiable* credentials rather than an empty hole — certifications and
 * facts that are already true, which is a stronger trust signal than a
 * generic five-star quote and carries no misrepresentation risk.
 *
 * Placeholder samples only reach here in development (see
 * lib/api/testimonials.ts) and are labelled unmistakably when they do.
 */

const CREDENTIALS = [
  {
    label: "SANS 10142 Certified",
    detail: "Every installation documented and tested to the national standard",
  },
  {
    label: "15+ Years",
    detail: "Industrial refrigeration and electrical work since 2011",
  },
  {
    label: "Fully Insured",
    detail: "Master licensed, cover in place on every job",
  },
  {
    label: "24/7 Emergency",
    detail: "One-hour response target on critical failures",
  },
];

export default function TestimonialsSection() {
  const { testimonials, loading, isEmpty } = useTestimonials();

  return (
    <section className="relative py-24 lg:py-32">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-14 max-w-2xl">
          <span className="mono-label">08 / Client Trust</span>
          <h2 className="section-heading mt-4">
            {isEmpty ? "Verified, not just claimed." : "What clients say."}
          </h2>
          <p className="section-subheading mt-5">
            {isEmpty
              ? "Credentials you can check, on work that is documented and tested — not adjectives."
              : "Feedback from clients whose equipment we keep running."}
          </p>
        </div>

        {loading && <TrustGrid aria-busy />}

        {!loading && isEmpty && <TrustGrid />}

        {!loading && !isEmpty && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((testimonial, i) => (
              <TestimonialCard key={i} testimonial={testimonial} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  const { quote, name, location, service, isSample } = testimonial;

  return (
    <figure className="tile relative flex h-full flex-col p-7">
      {/* Only ever visible in development — samples are stripped from a
          production build entirely (lib/api/testimonials.ts). */}
      {isSample && (
        <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-amber-400">
          Sample — not a real client
        </span>
      )}

      <svg
        className="h-6 w-6 flex-shrink-0 text-brand-500/40"
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M9.983 3v7.391c0 5.704-3.731 9.404-6.983 10.109V17.5c2.114-1.09 3.5-3.234 3.5-5.109H3V3h6.983zm11 0v7.391c0 5.704-3.731 9.404-6.983 10.109V17.5c2.114-1.09 3.5-3.234 3.5-5.109H14V3h6.983z" />
      </svg>

      <blockquote className="mt-5 flex-1 text-base leading-relaxed text-industrial-200">
        {quote}
      </blockquote>

      <figcaption className="mt-6 border-t border-industrial-800 pt-5">
        <p className="text-sm font-semibold text-white">{name}</p>
        <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.15em] text-industrial-500">
          {location}
          {service ? ` · ${service}` : ""}
        </p>
      </figcaption>
    </figure>
  );
}

function TrustGrid({ "aria-busy": ariaBusy }: { "aria-busy"?: boolean } = {}) {
  return (
    <div
      aria-busy={ariaBusy}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {CREDENTIALS.map((credential) => (
        <div key={credential.label} className="tile p-7">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500 ring-1 ring-inset ring-brand-500/20">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </span>
          <h3 className="mt-5 text-base font-bold text-white">{credential.label}</h3>
          <p className="mt-2 text-sm leading-relaxed text-industrial-400">
            {credential.detail}
          </p>
        </div>
      ))}
    </div>
  );
}
