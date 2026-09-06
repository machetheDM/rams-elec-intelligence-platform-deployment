import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const now = new Date();
    const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [equipByType, overdueSchedules, upcomingSchedules, totalEquipment] =
      await Promise.all([
        prisma.equipment.groupBy({
          by: ["type"],
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
        }),
        prisma.maintenanceSchedule.findMany({
          where: { status: "overdue" },
          include: {
            equipment: { select: { type: true, brand: true, model: true } },
            customer: { select: { name: true } },
          },
          orderBy: { scheduledDate: "asc" },
        }),
        prisma.maintenanceSchedule.findMany({
          where: {
            status: "pending",
            scheduledDate: { lte: thirtyDaysOut },
          },
          include: {
            equipment: { select: { type: true, brand: true } },
            customer: { select: { name: true } },
          },
          orderBy: { scheduledDate: "asc" },
        }),
        prisma.equipment.count(),
      ]);

    const overdueCount = overdueSchedules.length;
    const complianceRate =
      totalEquipment > 0
        ? ((totalEquipment - overdueCount) / totalEquipment) * 100
        : 100;

    return NextResponse.json({
      byType: equipByType.map((e) => ({ name: e.type, value: e._count.id })),
      totalEquipment,
      overdueCount,
      complianceRate,
      overdue: overdueSchedules.map((s) => ({
        type: s.equipment.type,
        brand: s.equipment.brand,
        model: s.equipment.model,
        customer: s.customer.name,
        scheduledDate: s.scheduledDate.toISOString().slice(0, 10),
        daysOverdue: Math.floor(
          (now.getTime() - s.scheduledDate.getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
      upcoming: upcomingSchedules.map((s) => ({
        type: s.equipment.type,
        brand: s.equipment.brand,
        customer: s.customer.name,
        scheduledDate: s.scheduledDate.toISOString().slice(0, 10),
      })),
    });
  } catch {
    return NextResponse.json(
      {
        byType: [], totalEquipment: 0, overdueCount: 0,
        complianceRate: 100, overdue: [], upcoming: [],
      },
      { status: 200 }
    );
  }
}
