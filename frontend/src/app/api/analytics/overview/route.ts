import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalJobs,
      jobsThisMonth,
      jobsLastMonth,
      completedJobs,
      inquiries,
      jobsByStatus,
      techJobs,
    ] = await Promise.all([
      prisma.job.count(),
      prisma.job.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.job.count({
        where: { createdAt: { gte: lastMonthStart, lt: monthStart } },
      }),
      prisma.job.findMany({
        where: { status: "complete" },
        select: { actualCost: true },
      }),
      prisma.inquiry.count(),
      prisma.job.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.job.groupBy({
        by: ["technicianId"],
        where: { status: "complete" },
        _count: { id: true },
      }),
    ]);

    const revenueThisMonth = completedJobs
      .filter((j) => j.actualCost != null)
      .reduce((sum, j) => sum + (j.actualCost ?? 0), 0);

    const costs = completedJobs
      .map((j) => j.actualCost)
      .filter((c): c is number => c != null);
    const avgJobValue = costs.length > 0
      ? costs.reduce((a, b) => a + b, 0) / costs.length
      : null;

    const convertedCount = await prisma.inquiry.count({ where: { status: "converted" } });
    const conversionRate = inquiries > 0 ? (convertedCount / inquiries) * 100 : null;

    const maxTechJobs = Math.max(...techJobs.map((t) => t._count.id), 1);

    const technicians = await prisma.technician.findMany({
      select: { id: true, name: true },
    });
    const techMap = new Map(technicians.map((t) => [t.id, t.name]));

    return NextResponse.json({
      totalJobs,
      jobsThisMonth,
      jobsDelta: jobsThisMonth - jobsLastMonth,
      revenueThisMonth,
      avgJobValue,
      conversionRate,
      jobsByStatus: jobsByStatus.map((s) => ({
        name: s.status,
        value: s._count.id,
      })),
      techUtilisation: techJobs.map((t) => ({
        name: techMap.get(t.technicianId ?? "") ?? "Unknown",
        utilisation: Math.round((t._count.id / maxTechJobs) * 100),
      })),
    });
  } catch {
    return NextResponse.json(
      { totalJobs: 0, jobsThisMonth: 0, jobsDelta: 0, revenueThisMonth: 0, avgJobValue: null, conversionRate: null, jobsByStatus: [], techUtilisation: [] },
      { status: 200 }
    );
  }
}
