import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const completedJobs = await prisma.job.findMany({
      where: { status: "complete", actualCost: { not: null } },
      select: {
        actualCost: true,
        completedDate: true,
        serviceType: { select: { category: true } },
      },
      orderBy: { completedDate: "asc" },
    });

    const monthlyMap = new Map<string, { revenue: number; jobCount: number }>();
    const catMap = new Map<string, number>();
    let totalRevenue = 0;

    for (const job of completedJobs) {
      const cost = job.actualCost ?? 0;
      totalRevenue += cost;

      if (job.completedDate) {
        const month = `${job.completedDate.getFullYear()}-${String(job.completedDate.getMonth() + 1).padStart(2, "0")}`;
        const existing = monthlyMap.get(month) ?? { revenue: 0, jobCount: 0 };
        monthlyMap.set(month, {
          revenue: existing.revenue + cost,
          jobCount: existing.jobCount + 1,
        });
      }

      const cat = job.serviceType?.category ?? "Other";
      catMap.set(cat, (catMap.get(cat) ?? 0) + cost);
    }

    return NextResponse.json({
      totalRevenue,
      totalJobs: completedJobs.length,
      monthlyTrend: Array.from(monthlyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({ month, ...data })),
      byCategory: Array.from(catMap.entries())
        .sort(([, a], [, b]) => b - a)
        .map(([name, revenue]) => ({ name, revenue })),
    });
  } catch {
    return NextResponse.json(
      { totalRevenue: 0, totalJobs: 0, monthlyTrend: [], byCategory: [] },
      { status: 200 }
    );
  }
}
