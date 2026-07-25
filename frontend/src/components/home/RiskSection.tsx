import Link from "next/link";
import type { ReactNode } from "react";

/**
 * "The Risk of Mediocrity" — preserved from the live ramsatelec.com site.
 *
 * NOTE: the previous implementation of this section displayed specific
 * statistics ("40% of electrical fires...", "R2.4B annual surge damage",
 * "R850K average cold room loss", "68% fail compliance") with no source.
 * Publishing unsourced figures as fact on a client-facing site is a real
 * liability, so this version makes the same argument qualitatively.
 * If Rams @Elec has citable sources (SABS, ESKOM, insurer data), the
 * figures can be restored here with attribution.
 */

interface RiskItem {
  title: string;
  description: string;
  icon: ReactNode;
}

const RISKS: RiskItem[] = [
  {
    title: "Fire & fault risk",
    description:
      "Degraded wiring, overloaded circuits and poor earthing remain leading causes of preventable electrical fire.",
    icon: <FireIcon />,
  },
  {
    title: "Surge damage",
    description:
      "Grid instability and load-shedding switching events destroy unprotected equipment without warning.",
    icon: <BoltIcon />,
  },
  {
    title: "Cold chain loss",
    description:
      "A cold room failure can write off an entire stockholding before anyone notices the temperature drift.",
    icon: <SnowflakeIcon />,
  },
  {
    title: "Failed compliance",
    description:
      "An invalid or absent Certificate of Compliance can block a property transfer or void an insurance claim.",
    icon: <ClipboardIcon />,
  },
];

export default function RiskSection() {
  return (
    <section className="relative border-y border-industrial-800 bg-industrial-900/40 py-24 lg:py-32">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-start gap-14 lg:grid-cols-12 lg:gap-20">
          <div className="lg:col-span-5">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-red-400">
              04 / The Risk of Mediocrity
            </span>
            <h2 className="section-heading mt-4">
              Electrical failure is
              <br />
              rarely sudden.
            </h2>
            <p className="section-subheading mt-5">
              It accumulates — in a loose termination, an undersized conductor, a compressor
              running hot for months. We ensure your infrastructure meets modern SANS regulations
              through documented, tested, verified work.
            </p>
            <div className="mt-8">
              <Link href="/inquire" className="btn-primary">
                Initiate Compliance Audit
                <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-7">
            {RISKS.map((risk) => (
              <div
                key={risk.title}
                className="tile p-6 transition-colors duration-300 hover:border-red-900/50"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
                  {risk.icon}
                </span>
                <h3 className="mt-4 text-sm font-semibold text-white">{risk.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-industrial-400">
                  {risk.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FireIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

function BoltIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function SnowflakeIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  );
}
