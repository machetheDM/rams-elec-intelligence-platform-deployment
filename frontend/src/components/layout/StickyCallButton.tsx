import { PHONE_DISPLAY, PHONE_HREF } from "@/lib/company";

/**
 * Sticky call button — mobile only.
 *
 * Most visitors arrive on a phone, on mobile data, wanting to speak to someone
 * about something that has stopped working. The hero puts the number above the
 * fold; this keeps it one tap away after they have scrolled past it.
 *
 * Deliberately a pill rather than a full-width bar: a bar permanently covers a
 * strip of every page, and on a long services page that is the strip the
 * content is in. `lg:hidden` because on a desktop the header number never
 * scrolls away.
 *
 * `env(safe-area-inset-bottom)` keeps it clear of the iPhone home indicator —
 * without it the button sits under the gesture bar and is awkward to hit.
 */
export default function StickyCallButton() {
  return (
    <a
      href={PHONE_HREF}
      aria-label={`Phone Rams @Elec on ${PHONE_DISPLAY}`}
      className="fixed bottom-0 right-4 z-40 mb-[calc(1rem+env(safe-area-inset-bottom))] inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-3.5 text-sm font-semibold text-industrial-950 shadow-lg shadow-black/40 transition-colors hover:bg-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-industrial-950 lg:hidden"
    >
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
        />
      </svg>
      Call us
    </a>
  );
}
