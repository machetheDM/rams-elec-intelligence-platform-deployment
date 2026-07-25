"use client";

import { useState, useCallback } from "react";

interface LoadsheddingStatus {
  area_zone: string;
  current_stage: number | null;
  next_outage_start: string | null;
  next_outage_end: string | null;
  status: "active" | "scheduled" | "none" | "unknown";
  last_updated: string;
}

const AREA_ZONES = [
  "Sandton", "Midrand", "Centurion", "Pretoria East", "Soweto",
  "Polokwane", "Mokopane", "Bela-Bela",
];

const STAGE_COLORS: Record<number, string> = {
  0: "bg-green-100 text-green-800 border-green-300",
  1: "bg-yellow-100 text-yellow-800 border-yellow-300",
  2: "bg-yellow-100 text-yellow-800 border-yellow-300",
  3: "bg-orange-100 text-orange-800 border-orange-300",
  4: "bg-orange-100 text-orange-800 border-orange-300",
  5: "bg-red-100 text-red-800 border-red-300",
  6: "bg-red-100 text-red-800 border-red-300",
  7: "bg-red-200 text-red-900 border-red-400",
  8: "bg-red-200 text-red-900 border-red-400",
};

export default function LoadSheddingWidget() {
  const [areaZone, setAreaZone] = useState("");
  const [status, setStatus] = useState<LoadsheddingStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!areaZone) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_LOADSHEDDING_API_URL || "http://localhost:8002"}/loadshedding/status/${encodeURIComponent(areaZone)}`
      );
      if (!res.ok) throw new Error("Failed to fetch status");
      const data = await res.json();
      setStatus(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not fetch load-shedding status");
    } finally {
      setLoading(false);
    }
  }, [areaZone]);

  const subscribe = useCallback(async () => {
    if (!areaZone) return;
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_LOADSHEDDING_API_URL || "http://localhost:8002"}/loadshedding/subscribe`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ area_zone: areaZone }),
        }
      );
      setSubscribed(true);
    } catch {
      setError("Could not subscribe. Please try again.");
    }
  }, [areaZone]);

  const formatTime = (iso: string | null): string => {
    if (!iso) return "N/A";
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  };

  const stageBadge = (stage: number | null) => {
    if (stage === null || stage === undefined) return null;
    // eslint-disable-next-line security/detect-object-injection -- stage is a number, not user-controlled
    const colorClass = STAGE_COLORS[stage] || "bg-gray-100 text-gray-800 border-gray-300";
    return (
      <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold border ${colorClass}`}>
        Stage {stage}
      </span>
    );
  };

  return (
    <div className="w-full max-w-md mx-auto bg-industrial-900 rounded-2xl shadow-2xl shadow-black/40 border border-industrial-800 overflow-hidden">
      <div className="bg-industrial-950 p-5 border-b border-industrial-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Load Shedding Status</h3>
            <p className="text-industrial-500 text-xs">Real-time EskomSePush data</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Area selector */}
        <div>
          <label className="block text-sm font-medium text-industrial-300 mb-1.5">
            Check your area
          </label>
          <div className="flex gap-2">
            <select
              value={areaZone}
              onChange={(e) => {
                setAreaZone(e.target.value);
                setStatus(null);
                setError(null);
              }}
              className="flex-1 px-3 py-2.5 rounded-xl border border-industrial-700 bg-industrial-800 text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              <option value="">Select your suburb...</option>
              {AREA_ZONES.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
            <button
              onClick={checkStatus}
              disabled={!areaZone || loading}
              className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:bg-industrial-700 disabled:text-industrial-500 text-white text-sm font-semibold rounded-xl transition-all"
            >
              {loading ? "..." : "Check"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}

        {/* Status result */}
        {status && (
          <div className="space-y-3">
            {/* Current stage */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-industrial-400">Current Stage</span>
              {stageBadge(status.current_stage) || (
                <span className="text-sm text-industrial-500">Unknown</span>
              )}
            </div>

            {/* Status indicator */}
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                status.status === "active" ? "bg-red-500 animate-pulse" :
                status.status === "scheduled" ? "bg-yellow-500" :
                "bg-green-500"
              }`} />
              <span className="text-sm font-medium text-industrial-200 capitalize">
                {status.status === "active" ? "Load shedding now" :
                 status.status === "scheduled" ? "Scheduled" :
                 "No load shedding"}
              </span>
            </div>

            {/* Next outage */}
            {status.next_outage_start && (
              <div className="p-3 bg-industrial-800 rounded-xl">
                <p className="text-xs text-industrial-500">Next outage</p>
                <p className="font-semibold text-white">
                  {formatTime(status.next_outage_start)} – {formatTime(status.next_outage_end)}
                </p>
              </div>
            )}

            {/* Subscribe */}
            {!subscribed ? (
              <button
                onClick={subscribe}
                className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg> Get WhatsApp Alerts
              </button>
            ) : (
              <p className="text-center text-sm text-green-400 font-medium">
                <svg className="w-4 h-4 inline-block mr-1 -mt-0.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> You&apos;re subscribed to alerts for {status.area_zone}
              </p>
            )}

            {/* CTA — drives to inquiry */}
            <div className="p-3 bg-brand-500/5 rounded-xl border border-brand-500/20">
              <p className="text-sm text-brand-400 font-medium">
                Protect your business from load shedding
              </p>
              <p className="text-xs text-brand-400/70 mt-1">
                Backup power • Surge protection • Generator installs
              </p>
              <a
                href="/inquire"
                className="inline-block mt-2 px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg transition-all"
              >
                Get a Free Quote →
              </a>
            </div>

            <p className="text-xs text-industrial-500 text-right">
              Updated: {new Date(status.last_updated).toLocaleTimeString("en-ZA")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
