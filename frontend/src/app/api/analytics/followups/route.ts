import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const followUps = await prisma.followUp.findMany({
      select: {
        id: true,
        daysSinceCompletion: true,
        responseReceived: true,
        stillWorking: true,
        satisfactionRating: true,
        sentimentScore: true,
        sentimentThemes: true,
        followUpIssueCreated: true,
        triggeredAt: true,
      },
    });

    const total = followUps.length;
    const responded = followUps.filter((f) => f.responseReceived).length;
    const responseRate = total > 0 ? (responded / total) * 100 : 0;

    const stillWorkingCount = followUps.filter((f) => f.stillWorking === true).length;
    const notWorkingCount = followUps.filter((f) => f.stillWorking === false).length;
    const issuesCreated = followUps.filter((f) => f.followUpIssueCreated).length;

    // Satisfaction distribution (1-5)
    const satisfactionDist = [1, 2, 3, 4, 5].map((rating) => ({
      rating: `${rating} star${rating > 1 ? "s" : ""}`,
      count: followUps.filter((f) => f.satisfactionRating === rating).length,
    }));

    const avgSatisfaction = (() => {
      const rated = followUps.filter((f) => f.satisfactionRating != null);
      if (rated.length === 0) return null;
      return rated.reduce((sum, f) => sum + (f.satisfactionRating ?? 0), 0) / rated.length;
    })();

    // Sentiment distribution
    const sentimentBuckets = { negative: 0, neutral: 0, positive: 0 };
    for (const f of followUps) {
      if (f.sentimentScore == null) continue;
      if (f.sentimentScore < -0.2) sentimentBuckets.negative++;
      else if (f.sentimentScore > 0.2) sentimentBuckets.positive++;
      else sentimentBuckets.neutral++;
    }

    // Theme frequency
    const themeMap = new Map<string, number>();
    for (const f of followUps) {
      for (const theme of f.sentimentThemes) {
        themeMap.set(theme, (themeMap.get(theme) ?? 0) + 1);
      }
    }
    const themeBreakdown = Array.from(themeMap.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count }));

    // Follow-up volume over time (monthly)
    const monthlyMap = new Map<string, number>();
    for (const f of followUps) {
      const month = f.triggeredAt.toISOString().slice(0, 7);
      monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + 1);
    }
    const monthlyVolume = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));

    // Recurrence rate (follow-ups where stillWorking=false / total responded)
    const recurrenceRate = responded > 0 ? (notWorkingCount / responded) * 100 : 0;

    return NextResponse.json({
      total,
      responded,
      responseRate,
      stillWorkingCount,
      notWorkingCount,
      issuesCreated,
      recurrenceRate,
      avgSatisfaction,
      satisfactionDist,
      sentimentBuckets: [
        { name: "Positive", value: sentimentBuckets.positive },
        { name: "Neutral", value: sentimentBuckets.neutral },
        { name: "Negative", value: sentimentBuckets.negative },
      ],
      themeBreakdown,
      monthlyVolume,
      mlReady: total >= 100,
      mlThreshold: 100,
    });
  } catch {
    return NextResponse.json(
      {
        total: 0, responded: 0, responseRate: 0, stillWorkingCount: 0,
        notWorkingCount: 0, issuesCreated: 0, recurrenceRate: 0,
        avgSatisfaction: null, satisfactionDist: [],
        sentimentBuckets: [], themeBreakdown: [], monthlyVolume: [],
        mlReady: false, mlThreshold: 100,
      },
      { status: 200 }
    );
  }
}
