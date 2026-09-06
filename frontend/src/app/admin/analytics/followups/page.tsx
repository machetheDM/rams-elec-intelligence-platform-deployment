"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface FollowUpData {
  total: number;
  responded: number;
  responseRate: number;
  stillWorkingCount: number;
  notWorkingCount: number;
  issuesCreated: number;
  recurrenceRate: number;
  avgSatisfaction: number | null;
  satisfactionDist: { rating: string; count: number }[];
  sentimentBuckets: { name: string; value: number }[];
  themeBreakdown: { name: string; count: number }[];
  monthlyVolume: { month: string; count: number }[];
  mlReady: boolean;
  mlThreshold: number;
}

const SENTIMENT_COLORS = ["#10b981", "#94a3b8", "#ef4444"];
const THEME_COLORS = ["#f59e0b", "#3b82f6", "#8b5cf6", "#10b981", "#ef4444", "#ec4899", "#14b8a6"];

export default function FollowUpAnalyticsPage() {
  const [data, setData] = useState<FollowUpData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/analytics/followups");
        if (res.ok) setData(await res.json());
      } catch {
        // Service unavailable
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Follow-Up Analytics</h1>
        <p className="text-industrial-400">Loading...</p>
      </div>
    );
  }

  const d = data ?? {
    total: 0, responded: 0, responseRate: 0, stillWorkingCount: 0,
    notWorkingCount: 0, issuesCreated: 0, recurrenceRate: 0,
    avgSatisfaction: null, satisfactionDist: [], sentimentBuckets: [],
    themeBreakdown: [], monthlyVolume: [], mlReady: false, mlThreshold: 100,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Follow-Up Analytics</h1>
        <p className="text-sm text-industrial-400 mt-1">Post-service follow-up outcomes, satisfaction, and sentiment</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <KpiCard label="Total Sent" value={d.total.toString()} />
        <KpiCard label="Responded" value={d.responded.toString()} />
        <KpiCard
          label="Response Rate"
          value={`${d.responseRate.toFixed(1)}%`}
          color={d.responseRate >= 50 ? "emerald" : "amber"}
        />
        <KpiCard
          label="Avg Satisfaction"
          value={d.avgSatisfaction != null ? `${d.avgSatisfaction.toFixed(1)}/5` : "N/A"}
          color={d.avgSatisfaction != null && d.avgSatisfaction >= 4 ? "emerald" : "amber"}
        />
        <KpiCard label="Still Working" value={d.stillWorkingCount.toString()} color="emerald" />
        <KpiCard label="Not Working" value={d.notWorkingCount.toString()} color="red" />
        <KpiCard
          label="Recurrence Rate"
          value={`${d.recurrenceRate.toFixed(1)}%`}
          color={d.recurrenceRate <= 10 ? "emerald" : "red"}
        />
      </div>

      {/* ML model readiness banner */}
      <div className={`rounded-xl border p-4 ${
        d.mlReady
          ? "bg-emerald-500/5 border-emerald-500/20"
          : "bg-amber-500/5 border-amber-500/20"
      }`}>
        <p className={`text-sm ${d.mlReady ? "text-emerald-400" : "text-amber-400"}`}>
          {d.mlReady
            ? "Failure-recurrence ML model is ready to train — 100+ labelled follow-ups available."
            : `Failure-recurrence ML model requires ${d.mlThreshold} labelled follow-ups to train. Currently have ${d.total}. Model training is deferred until this threshold is met.`
          }
        </p>
      </div>

      {/* Charts row 1 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Sentiment distribution */}
        <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Sentiment Distribution</h2>
          {d.sentimentBuckets.some((b) => b.value > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={d.sentimentBuckets}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {d.sentimentBuckets.map((_, i) => (
                    <Cell key={i} fill={SENTIMENT_COLORS[i % SENTIMENT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                  itemStyle={{ color: "#f8fafc" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-industrial-500 text-sm">No sentiment data yet</p>
          )}
        </div>

        {/* Satisfaction distribution */}
        <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Satisfaction Ratings</h2>
          {d.satisfactionDist.some((s) => s.count > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={d.satisfactionDist}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="rating" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                  itemStyle={{ color: "#f8fafc" }}
                />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-industrial-500 text-sm">No satisfaction ratings yet</p>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Theme breakdown */}
        <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Sentiment Themes</h2>
          {d.themeBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={d.themeBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} width={120} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                  itemStyle={{ color: "#f8fafc" }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {d.themeBreakdown.map((_, i) => (
                    <Cell key={i} fill={THEME_COLORS[i % THEME_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-industrial-500 text-sm">No theme data yet</p>
          )}
        </div>

        {/* Volume over time */}
        <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Follow-Up Volume</h2>
          {d.monthlyVolume.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={d.monthlyVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                  itemStyle={{ color: "#f8fafc" }}
                />
                <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-industrial-500 text-sm">No follow-up data yet</p>
          )}
        </div>
      </div>

      {/* Issues created summary */}
      <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-2">Follow-Up Issues Created</h2>
        <p className="text-3xl font-bold text-white">{d.issuesCreated}</p>
        <p className="text-sm text-industrial-400 mt-1">
          New inquiry records created from follow-ups where the customer reported the repair was not working.
        </p>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color = "default" }: { label: string; value: string; color?: string }) {
  const colorClasses: Record<string, string> = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    red: "text-red-400",
    default: "text-white",
  };
  // eslint-disable-next-line security/detect-object-injection -- color is a component prop from a fixed set of literals, not user input
  const textColor = colorClasses[color] ?? "text-white";

  return (
    <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-3">
      <p className="text-xs text-industrial-500 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-bold mt-1 ${textColor}`}>{value}</p>
    </div>
  );
}
