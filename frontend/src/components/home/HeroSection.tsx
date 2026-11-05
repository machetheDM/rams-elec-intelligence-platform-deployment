import Link from "next/link";

import { AREAS, HOURS, PHONE_DISPLAY, PHONE_HREF, WHAT_WE_DO } from "@/lib/company";

/**
 * Landing hero — presentational only.
 *
 * WHAT CHANGED, AND WHY
 *
 * The previous hero led with "Engineering Reliability." over a pull-quote and a
 * line about "AI-assisted quoting... and a 24/7 emergency task force". Three
 * problems, in order of seriousness:
 *
 *  1. It mounted LoadSheddingWidget, which fetches
 *     NEXT_PUBLIC_LOADSHEDDING_API_URL || "http://localhost:8002" straight from
 *     the browser. In the deployed static export that env var is unset, so
 *     every visitor's browser would have called THEIR OWN machine; and the
 *     server's CSP allows connect-src 'self' and the Manager API only, so even
 *     a correct URL would be blocked. The widget could only ever have shown an
 *     error. It is gone from the public build.
 *  2. "Get an Instant Quote" is no longer true. The form sends an enquiry a
 *     person answers, usually the same working day.
 *  3. A visitor on a phone had to scroll past a badge, a headline, a
 *     pull-quote and a paragraph before reaching either call to action. Most
 *     arrive on a phone, on mobile data, wanting the number.
 *
 * There is also no background photograph any more. It was a hot-linked 1920px
 * Unsplash image at 20% opacity — the largest element on the page, so the LCP
 * element, unoptimisable in a static export, and generic stock that implies
 * work the company may not have done. The target is LCP under 2.5s on mobile;
 * the cheapest way to hit it is not to ship a decorative hero image at all.
 *
 * "Since 2011" is the company's own claim, carried over from the live
 * ramsatelec.com copy. It stays because it is theirs; it is no longer set in a
 * glowing badge.
 */

const CREDENTIALS = ["SANS 10142 certified", "Fully insured", "Emergency call-outs"];

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-industrial-800">
      <div className="absolute inset-0 bg-grid mask-fade-b opacity-60" aria-hidden="true" />

      {/* Padding, not min-h-screen: at 375x812 both actions sit above the fold. */}
      <div className="relative mx-auto w-full max-w-5xl px-4 pb-14 pt-28 sm:px-6 sm:pb-20 sm:pt-32 lg:px-8">
        <p className="text-sm font-medium text-brand-400">
          Electrical &amp; refrigeration contractors · {AREAS}
        </p>

        <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
          Cold rooms and electrical work,
          <br className="hidden sm:block" /> done properly.
        </h1>

        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-industrial-300">
          {WHAT_WE_DO} Working across {AREAS} since 2011.
        </p>

        {/* The two actions, side by side on a phone. Phoning comes first: it is
            what most people want, and it is the only one that works instantly. */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a href={PHONE_HREF} className="btn-primary text-base">
            Phone {PHONE_DISPLAY}
          </a>
          <Link href="/inquire" className="btn-outline text-base">
            Request a quote
          </Link>
        </div>

        <p className="mt-4 text-sm text-industrial-400">{HOURS}</p>

        <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-industrial-800 pt-6 text-sm text-industrial-400">
          {CREDENTIALS.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
