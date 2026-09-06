import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const inquiries = await prisma.inquiry.findMany({
      select: {
        id: true,
        source: true,
        classifiedType: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const dailyMap = new Map<string, number>();
    const catMap = new Map<string, number>();
    const sourceMap = new Map<string, number>();
    const statusMap = new Map<string, number>();

    for (const inq of inquiries) {
      const day = inq.createdAt.toISOString().slice(0, 10);
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);

      const cat = inq.classifiedType ?? "unclassified";
      catMap.set(cat, (catMap.get(cat) ?? 0) + 1);

      const src = inq.source ?? "unknown";
      sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1);

      const st = inq.status ?? "pending";
      statusMap.set(st, (statusMap.get(st) ?? 0) + 1);
    }

    return NextResponse.json({
      total: inquiries.length,
      dailyVolume: Array.from(dailyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count })),
      byCategory: Array.from(catMap.entries())
        .sort(([, a], [, b]) => b - a)
        .map(([name, count]) => ({ name, count })),
      bySource: Array.from(sourceMap.entries())
        .map(([name, value]) => ({ name, value })),
      byStatus: Array.from(statusMap.entries())
        .map(([name, count]) => ({ name, count })),
    });
  } catch {
    return NextResponse.json(
      { total: 0, dailyVolume: [], byCategory: [], bySource: [], byStatus: [] },
      { status: 200 }
    );
  }
}
