"use client";

import { useState } from "react";
import Link from "next/link";
import { useAlertSubscription } from "@/hooks/useAlertSubscription";

/**
 * Load-shedding alert sign-up.
 *
 * This subscribes to a real, working alert system — EskomSePush data via
 * services/loadshedding, delivered on the schedule that service already
 * tracks. It deliberately does NOT promise a "weekly newsletter": there is no
 * mailing system behind this platform, and advertising one would be a promise
 * the product cannot keep.
 *
 * The service can succeed at the HTTP level while recording nothing (no
 * customer row matches that phone number), so this component reports that
 * outcome honestly and routes the visitor to the inquiry form instead of
 * showing a false confirmation.
 */

// Mirrors AREA_ID_MAP in services/loadshedding/main.py — the only zones with
// EskomSePush coverage configured. Offering a zone the backend can't serve
// would produce a subscription that never fires.
const AREA_ZONES = [
  "Sandton",
  "Midrand",
  "Centurion",
  "Pretoria East",
  "Soweto",
  "Polokwane",
  "Mokopane",
  "Bela-Bela",
];

const BENEFITS = [
  "Stage changes for your area, as they happen",
  "Advance warning before your next scheduled outage",
  "Cold-room and equipment protection guidance",
];

export default function AlertSignupSection() {
  const [phone, setPhone] = useState("");
  const [areaZone, setAreaZone] = useState("");
  const { outcome, submitting, error, subscribe, reset } = useAlertSubscription();

  const canSubmit = phone.trim().length > 0 && areaZone.length > 0 && !submitting;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    subscribe(phone.trim(), areaZone);
  };

  return (
    <section className="relative overflow-hidden border-y border-industrial-800 bg-industrial-900/40 py-24 lg:py-32">
      <div className="pointer-events-none absolute inset-0 bg-grid-fine opacity-40" />
      <div className="pointer-events-none absolute -right-40 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-brand-500/[0.06] blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-20">
          {/* ---- Left: proposition ---- */}
          <div className="lg:col-span-6">
            <span className="mono-label">08 / Stay Powered</span>
            <h2 className="section-heading mt-4 text-balance">
              Know before
              <br />
              <span className="gradient-text">the lights go.</span>
            </h2>
            <p className="section-subheading mt-5 text-pretty">
              We already track EskomSePush data for all eight service areas. Add your number
              and we&apos;ll tell you what your area is doing — no guessing at the schedule.
            </p>

            <ul className="mt-8 space-y-3">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3">
                  <svg
                    className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-brand-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-sm leading-relaxed text-industrial-300">
                    {benefit}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* ---- Right: form ---- */}
          <div className="lg:col-span-6">
            <div className="tile p-7 lg:p-9">
              {outcome === "subscribed" ? (
                <ConfirmationPanel areaZone={areaZone} onReset={reset} />
              ) : outcome === "not_a_customer" ? (
                <NotACustomerPanel onReset={reset} />
              ) : (
                <form onSubmit={handleSubmit}>
                  <span className="mono-label-muted">Alert registration</span>

                  <div className="mt-6 space-y-4">
                    <div>
                      <label
                        htmlFor="alert-phone"
                        className="block text-xs font-medium text-industrial-300"
                      >
                        Mobile number
                      </label>
                      <input
                        id="alert-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="071 101 8493"
                        className="mt-2 w-full rounded-lg border border-industrial-700 bg-industrial-950 px-4 py-2.5 text-sm text-white placeholder:text-industrial-600 focus:border-transparent focus:ring-2 focus:ring-brand-500"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="alert-area"
                        className="block text-xs font-medium text-industrial-300"
                      >
                        Your area
                      </label>
                      <select
                        id="alert-area"
                        value={areaZone}
                        onChange={(e) => setAreaZone(e.target.value)}
                        className="mt-2 w-full rounded-lg border border-industrial-700 bg-industrial-950 px-4 py-2.5 text-sm text-white focus:border-transparent focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">Select your area...</option>
                        {AREA_ZONES.map((zone) => (
                          <option key={zone} value={zone}>
                            {zone}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {error && (
                    <p className="mt-4 text-xs leading-relaxed text-red-400">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:bg-industrial-800 disabled:text-industrial-500 disabled:shadow-none"
                  >
                    {submitting ? "Registering..." : "Register for Alerts"}
                  </button>

                  <p className="mt-4 text-[11px] leading-relaxed text-industrial-500">
                    Used only to send load-shedding alerts for your area. No marketing, and
                    you can opt out at any time.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ConfirmationPanel({
  areaZone,
  onReset,
}: {
  areaZone: string;
  onReset: () => void;
}) {
  return (
    <div className="py-4 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-400">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <h3 className="mt-5 text-lg font-bold text-white">You&apos;re registered</h3>
      <p className="mt-2 text-sm leading-relaxed text-industrial-400">
        We&apos;ll alert you about load-shedding in {areaZone || "your area"}.
      </p>
      <button
        onClick={onReset}
        className="mt-6 font-mono text-[11px] uppercase tracking-[0.15em] text-brand-500 transition-colors hover:text-brand-400"
      >
        Register another number
      </button>
    </div>
  );
}

function NotACustomerPanel({ onReset }: { onReset: () => void }) {
  return (
    <div className="py-4 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/10 text-brand-500">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </span>
      <h3 className="mt-5 text-lg font-bold text-white">We don&apos;t have that number yet</h3>
      <p className="mt-2 text-sm leading-relaxed text-industrial-400">
        Alerts are set up for clients on our books. Send us your first job and we&apos;ll
        register you at the same time.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/inquire" className="btn-primary text-sm">
          Get a Quote
        </Link>
        <button onClick={onReset} className="btn-outline text-sm">
          Try another number
        </button>
      </div>
    </div>
  );
}
