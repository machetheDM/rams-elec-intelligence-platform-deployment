"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import Logo from "./Logo";
import { PHONE_DISPLAY, PHONE_HREF } from "@/lib/company";

/**
 * Public site header.
 *
 * THE LOGIN LINKS ARE GONE, and that was a correctness fix rather than a design
 * one. There were two — "Login" on desktop and "Login / Portal" on mobile —
 * both pointing at /login. The public site is a static export that deliberately
 * excludes /login, /dashboard and every portal route, so both links shipped to
 * customers as guaranteed 404s. The agreed first cut is the public pages plus
 * the enquiry form; the portal is not in the navigation because it is not in
 * the build.
 *
 * The phone number is no longer typed in twice. It comes from lib/company.ts,
 * which exists because a fabricated number once reached three files.
 *
 * On scroll the bar goes solid rather than translucent-with-backdrop-blur.
 * A backdrop filter over a scrolling page repaints the blurred region on every
 * frame, and this is a site for people on mid-range Android phones.
 */

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/gallery", label: "Our work" },
  { href: "/#about", label: "About" },
  { href: "/#contact", label: "Contact" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-200 ${
        scrolled
          ? "border-b border-industrial-800 bg-industrial-950"
          : "border-b border-transparent bg-industrial-950/80"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between lg:h-20">
          <Link href="/" className="flex items-center" aria-label="Rams @Elec — home">
            <Logo className="h-9 w-auto lg:h-10" />
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-4 py-2 text-sm font-medium text-industrial-300 transition-colors hover:bg-industrial-900 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-4 lg:flex">
            <a
              href={PHONE_HREF}
              className="text-sm font-medium text-industrial-200 transition-colors hover:text-white"
            >
              {PHONE_DISPLAY}
            </a>
            <Link href="/inquire" className="btn-primary !px-5 !py-2.5 text-sm">
              Request a quote
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            className="rounded-lg p-2 text-industrial-200 hover:text-white lg:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
          >
            <svg
              aria-hidden="true"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {mobileOpen && (
          <div id="mobile-menu" className="border-t border-industrial-800 pb-4 lg:hidden">
            <div className="flex flex-col gap-1 pt-3">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-4 py-3 text-base font-medium text-industrial-200 transition-colors hover:bg-industrial-900 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}

              <div className="mt-3 flex flex-col gap-3 border-t border-industrial-800 px-4 pt-4">
                <a href={PHONE_HREF} className="text-base font-medium text-white">
                  {PHONE_DISPLAY}
                </a>
                <Link
                  href="/inquire"
                  onClick={() => setMobileOpen(false)}
                  className="btn-primary w-full text-sm"
                >
                  Request a quote
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
