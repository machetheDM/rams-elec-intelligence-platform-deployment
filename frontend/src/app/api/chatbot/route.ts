import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy for the chatbot service's RAG query endpoint.
 *
 * Same reasoning as /api/model-metrics: the chatbot service requires an
 * X-API-Key (security/auth/api_key_middleware.py), which is a server
 * secret and must never be sent from browser JS. The browser calls this
 * same-origin route only — see `@/lib/api/chatbot.ts`.
 */

const CHATBOT_SERVICE_URL = process.env.CHATBOT_SERVICE_URL || "http://localhost:8003";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "rams-elec-frontend-2026";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const res = await fetch(`${CHATBOT_SERVICE_URL}/chatbot/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": INTERNAL_API_KEY,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
