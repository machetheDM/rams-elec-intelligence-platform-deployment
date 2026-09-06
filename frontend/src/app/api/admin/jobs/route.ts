import { NextResponse } from "next/server";

const DISPATCH_SERVICE_URL = process.env.DISPATCH_SERVICE_URL || "http://localhost:8004";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "rams-elec-frontend-2026";

export async function GET() {
  try {
    const res = await fetch(`${DISPATCH_SERVICE_URL}/dispatch/jobs`, {
      headers: { "X-API-Key": INTERNAL_API_KEY },
      cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Dispatch service unreachable" },
      { status: 503 }
    );
  }
}
