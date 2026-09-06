"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Logo from "./Logo";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/gallery", label: "Gallery" },
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
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-industrial-950/95 backdrop-blur-xl border-b border-industrial-800 shadow-lg shadow-black/20"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center group">
            <Logo className="h-10 w-auto" />
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-sm font-medium text-industrial-300 hover:text-white hover:bg-industrial-800 rounded-lg transition-all"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-3">
            <a
              href="tel:+27711018493"
              className="text-sm font-medium text-industrial-300 hover:text-white transition-colors"
            >
              +27 71 101 8493
            </a>
            <Link
              href="/login"
              className="text-sm font-medium text-industrial-300 hover:text-brand-400 transition-colors"
            >
              Login
            </Link>
            <Link href="/inquire" className="btn-primary text-sm !px-5 !py-2.5">
              Get a Quote
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 text-industrial-300 hover:text-white"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden pb-4 border-t border-industrial-800 animate-fade-in">
            <div className="flex flex-col gap-1 pt-3">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-4 py-3 text-sm font-medium text-industrial-300 hover:text-white hover:bg-industrial-800 rounded-lg transition-all"
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-3 pt-3 border-t border-industrial-800 flex flex-col gap-2 px-4">
                <a href="tel:+27711018493" className="text-sm text-industrial-400">
                  +27 71 101 8493
                </a>
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="text-sm text-industrial-400 hover:text-brand-400 transition-colors"
                >
                  Login / Portal
                </Link>
                <Link
                  href="/inquire"
                  onClick={() => setMobileOpen(false)}
                  className="btn-primary text-sm w-full"
                >
                  Get a Quote
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
