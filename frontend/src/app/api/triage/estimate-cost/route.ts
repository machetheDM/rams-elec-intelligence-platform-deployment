import { NextRequest, NextResponse } from "next/server";

const TRIAGE_SERVICE_URL = process.env.TRIAGE_SERVICE_URL || "http://localhost:8001";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "rams-elec-frontend-2026";

export async function POST(request: NextRequest) {
  const body = await request.json();

  try {
    const res = await fetch(`${TRIAGE_SERVICE_URL}/triage/estimate-cost`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": INTERNAL_API_KEY,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Triage service unreachable" },
      { status: 503 }
    );
  }
}
