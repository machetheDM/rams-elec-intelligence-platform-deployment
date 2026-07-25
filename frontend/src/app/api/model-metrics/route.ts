import { NextResponse } from "next/server";

/**
 * Server-side proxy for the triage service's quote-estimator metrics.
 *
 * The X-API-Key the triage service requires (security/auth/api_key_middleware.py)
 * is a server secret and must never be shipped to the browser via a
 * NEXT_PUBLIC_* variable, so this route holds it. Client code — see
 * `@/lib/api/triage.ts` — only ever calls this same-origin route, never the
 * triage service directly.
 */

const TRIAGE_SERVICE_URL = process.env.TRIAGE_SERVICE_URL || "http://localhost:8001";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "rams-elec-frontend-2026";

export async function GET() {
  let res: Response;

  try {
    res = await fetch(`${TRIAGE_SERVICE_URL}/triage/model-metrics`, {
      headers: { "X-API-Key": INTERNAL_API_KEY },
      cache: "no-store",
    });
  } catch {
    // The triage service being down is an expected operating state — the
    // rest of the site works fine without it. Return a clean 503 rather
    // than letting the ECONNREFUSED bubble up as an unhandled 500, which
    // logs a scary red error in the browser console on every page load.
    return NextResponse.json(
      { error: "Triage service unreachable" },
      { status: 503 }
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: `Triage service returned HTTP ${res.status}` },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
