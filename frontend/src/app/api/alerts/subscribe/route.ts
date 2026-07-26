import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy for load-shedding alert subscription.
 *
 * Same reasoning as /api/model-metrics and /api/chatbot: the loadshedding
 * service requires an X-API-Key (security/auth/api_key_middleware.py), which
 * is a server secret and must never be sent from browser JS.
 */

const LOADSHEDDING_SERVICE_URL =
  process.env.LOADSHEDDING_SERVICE_URL || "http://localhost:8002";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "rams-elec-frontend-2026";

export async function POST(request: NextRequest) {
  const body = await request.json();

  let res: Response;

  try {
    res = await fetch(`${LOADSHEDDING_SERVICE_URL}/loadshedding/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": INTERNAL_API_KEY,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json(
      { error: "Load-shedding service unreachable" },
      { status: 503 }
    );
  }

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
