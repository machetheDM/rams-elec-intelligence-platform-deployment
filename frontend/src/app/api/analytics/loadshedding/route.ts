import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const [lsEvents, emergencyInquiries] = await Promise.all([
      prisma.loadsheddingEvent.findMany({
        select: { areaZone: true, stage: true, startTime: true },
        orderBy: { startTime: "desc" },
      }),
      prisma.inquiry.findMany({
        where: { classifiedType: "emergency" },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const stageMap = new Map<string, number>();
    const zoneMap = new Map<string, number>();
    const dailyLs = new Map<string, number>();

    for (const ev of lsEvents) {
      const stage = `Stage ${ev.stage}`;
      stageMap.set(stage, (stageMap.get(stage) ?? 0) + 1);
      zoneMap.set(ev.areaZone, (zoneMap.get(ev.areaZone) ?? 0) + 1);

      const day = ev.startTime.toISOString().slice(0, 10);
      dailyLs.set(day, (dailyLs.get(day) ?? 0) + 1);
    }

    const dailyEmergency = new Map<string, number>();
    for (const inq of emergencyInquiries) {
      const day = inq.createdAt.toISOString().slice(0, 10);
      dailyEmergency.set(day, (dailyEmergency.get(day) ?? 0) + 1);
    }

    const allDays = new Set([...dailyLs.keys(), ...dailyEmergency.keys()]);
    const correlationData = Array.from(allDays).map((day) => ({
      lsEvents: dailyLs.get(day) ?? 0,
      emergencyCount: dailyEmergency.get(day) ?? 0,
    }));

    let coefficient: number | null = null;
    if (correlationData.length >= 4) {
      const n = correlationData.length;
      const sumX = correlationData.reduce((a, d) => a + d.lsEvents, 0);
      const sumY = correlationData.reduce((a, d) => a + d.emergencyCount, 0);
      const mx = sumX / n;
      const my = sumY / n;
      let num = 0, dx = 0, dy = 0;
      for (const point of correlationData) {
        num += (point.lsEvents - mx) * (point.emergencyCount - my);
        dx += (point.lsEvents - mx) ** 2;
        dy += (point.emergencyCount - my) ** 2;
      }
      const denom = Math.sqrt(dx * dy);
      coefficient = denom > 0 ? num / denom : 0;
    }

    return NextResponse.json({
      totalEvents: lsEvents.length,
      byStage: Array.from(stageMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ name, count })),
      byZone: Array.from(zoneMap.entries())
        .sort(([, a], [, b]) => b - a)
        .map(([name, count]) => ({ name, count })),
      correlation: { data: correlationData, coefficient },
    });
  } catch {
    return NextResponse.json(
      {
        totalEvents: 0, byStage: [], byZone: [],
        correlation: { data: [], coefficient: null },
      },
      { status: 200 }
    );
  }
}
