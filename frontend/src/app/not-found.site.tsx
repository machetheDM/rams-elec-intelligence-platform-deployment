import Link from "next/link";

import { FALLBACK_PHONE } from "@/lib/api/enquiries";

/**
 * 404 page.
 *
 * Named not-found.site.tsx so it is part of the public export: the static
 * export writes it to out/404.html, and the server returns that file with
 * status 404 for any unknown path. Without it the visitor gets nginx's own
 * default page, which carries no way back and no phone number.
 *
 * Deliberately plain. Someone who lands here is usually following a stale
 * link and wants the phone number or the quote form, not an apology.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center px-4 py-24 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand-400">404</p>
      <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
        That page is not here.
      </h1>
      <p className="mt-4 text-lg text-industrial-300">
        The link may be out of date, or the address may have a typo in it.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded-lg bg-brand-500 px-5 py-3 font-semibold text-industrial-950 transition-colors hover:bg-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-industrial-950"
        >
          Go to the home page
        </Link>
        <Link
          href="/inquire"
          className="rounded-lg border border-industrial-600 px-5 py-3 font-semibold text-industrial-100 transition-colors hover:border-industrial-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-industrial-950"
        >
          Request a quote
        </Link>
      </div>

      <p className="mt-8 text-industrial-400">
        Or phone us on{" "}
        <a
          className="font-medium text-brand-400 underline"
          href={`tel:${FALLBACK_PHONE.replace(/[^+\d]/g, "")}`}
        >
          {FALLBACK_PHONE}
        </a>
        .
      </p>
    </div>
  );
}
