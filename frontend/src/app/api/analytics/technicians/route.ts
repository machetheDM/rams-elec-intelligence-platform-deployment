import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const technicians = await prisma.technician.findMany({
      select: { id: true, name: true },
    });

    const completedJobs = await prisma.job.findMany({
      where: { status: "complete" },
      select: {
        technicianId: true,
        actualCost: true,
        scheduledDate: true,
        completedDate: true,
        areaZone: true,
      },
    });

    const perfMap = new Map<
      string,
      { jobs: number; totalCost: number; totalDays: number; dayCount: number }
    >();
    const areaMap = new Map<string, Map<string, number>>();
    const allAreas = new Set<string>();

    for (const job of completedJobs) {
      const tid = job.technicianId ?? "unassigned";
      const existing = perfMap.get(tid) ?? {
        jobs: 0, totalCost: 0, totalDays: 0, dayCount: 0,
      };
      existing.jobs++;
      if (job.actualCost) existing.totalCost += job.actualCost;
      if (job.scheduledDate && job.completedDate) {
        const days = (job.completedDate.getTime() - job.scheduledDate.getTime()) / (1000 * 60 * 60 * 24);
        existing.totalDays += days;
        existing.dayCount++;
      }
      perfMap.set(tid, existing);

      if (job.areaZone) {
        allAreas.add(job.areaZone);
        const techAreas = areaMap.get(tid) ?? new Map<string, number>();
        techAreas.set(job.areaZone, (techAreas.get(job.areaZone) ?? 0) + 1);
        areaMap.set(tid, techAreas);
      }
    }

    const areas = Array.from(allAreas).sort();

    const performance = technicians
      .map((t) => {
        const p = perfMap.get(t.id);
        return {
          name: t.name,
          jobsCompleted: p?.jobs ?? 0,
          avgDays: p && p.dayCount > 0 ? Math.round((p.totalDays / p.dayCount) * 10) / 10 : null,
          avgJobValue: p && p.jobs > 0 ? Math.round(p.totalCost / p.jobs) : null,
        };
      })
      .sort((a, b) => b.jobsCompleted - a.jobsCompleted);

    const areaCoverage = technicians.map((t) => {
      const techAreas = areaMap.get(t.id) ?? new Map<string, number>();
      return {
        name: t.name,
        ...Object.fromEntries(areas.map((area) => [area, techAreas.get(area) ?? 0])),
      };
    });

    return NextResponse.json({ performance, areaCoverage, areas });
  } catch {
    return NextResponse.json(
      { performance: [], areaCoverage: [], areas: [] },
      { status: 200 }
    );
  }
}
