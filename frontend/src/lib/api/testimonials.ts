/**
 * Client testimonials — pure data, no React and no markup.
 *
 * Real testimonials go in REAL_TESTIMONIALS below (or, later, come from the
 * database — only `fetchTestimonials()` changes, no consumer does).
 *
 * ---------------------------------------------------------------------------
 * WHY THE SAMPLES ARE GATED
 * ---------------------------------------------------------------------------
 * SAMPLE_TESTIMONIALS exist so the section can be designed and reviewed
 * before any real quote has been collected. They are invented, and publishing
 * invented testimonials on a commercial site is a misrepresentation under
 * South Africa's Consumer Protection Act — so they are hard-gated behind a
 * development-only check rather than left to discipline.
 *
 * `process.env.NODE_ENV` is statically replaced at build time by Next.js, so
 * in a production build this branch is `false` and the bundler drops
 * SAMPLE_TESTIMONIALS from the output entirely. They cannot ship by accident,
 * and they cannot be re-enabled by an env var at runtime.
 *
 * To go live: add real entries to REAL_TESTIMONIALS, with the client's
 * permission on record. Until then the section renders a verifiable trust
 * panel instead (see TestimonialsSection).
 */

export interface Testimonial {
  /** The client's own words. Never paraphrase or embellish. */
  quote: string;
  /** First name, or full name if they've agreed to it. */
  name: string;
  /** Suburb/town — e.g. "Polokwane". */
  location: string;
  /** What the job was, e.g. "Cold Room Installation". */
  service?: string;
  /** True only for invented placeholder content. Never set on a real quote. */
  isSample?: boolean;
}

/**
 * Real client testimonials, used with permission.
 *
 * Empty until the first client confirms. Add entries as:
 *   { quote: "...", name: "Thabo", location: "Polokwane", service: "Cold Room Repair" }
 */
const REAL_TESTIMONIALS: Testimonial[] = [];

/**
 * Invented placeholders — development only, see the file header.
 * These are marked `isSample` so the UI can label them unmistakably even in
 * dev, and so no code path can mistake them for real feedback.
 */
const SAMPLE_TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "The cold room was back up the same afternoon. We didn't lose a single crate of stock.",
    name: "Sample Client",
    location: "Polokwane",
    service: "Cold Room Repair",
    isSample: true,
  },
  {
    quote:
      "They walked us through the compliance paperwork properly. Our insurer accepted it without a query.",
    name: "Sample Client",
    location: "Sandton",
    service: "Electrical Compliance Audit",
    isSample: true,
  },
];

/**
 * Testimonials to render. Real ones always take precedence; samples appear
 * only in development, and only while there are no real ones to show.
 */
export async function fetchTestimonials(): Promise<Testimonial[]> {
  if (REAL_TESTIMONIALS.length > 0) return REAL_TESTIMONIALS;
  if (process.env.NODE_ENV === "development") return SAMPLE_TESTIMONIALS;
  return [];
}
