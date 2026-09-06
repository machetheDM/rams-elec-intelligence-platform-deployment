"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface OverviewData {
  totalJobs: number;
  jobsThisMonth: number;
  jobsDelta: number;
  revenueThisMonth: number;
  avgJobValue: number | null;
  conversionRate: number | null;
  jobsByStatus: { name: string; value: number }[];
  techUtilisation: { name: string; utilisation: number }[];
}

const STATUS_COLORS = ["#f59e0b", "#3b82f6", "#8b5cf6", "#10b981", "#ef4444", "#6b7280"];

export default function BusinessOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/analytics/overview");
        if (res.ok) {
          setData(await res.json());
        }
      } catch {
        // Service unavailable — show empty state
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Business Overview</h1>
        <p className="text-industrial-400">Loading analytics...</p>
      </div>
    );
  }

  const overview = data ?? {
    totalJobs: 0, jobsThisMonth: 0, jobsDelta: 0,
    revenueThisMonth: 0, avgJobValue: null, conversionRate: null,
    jobsByStatus: [], techUtilisation: [],
  };

  const metrics = [
    { label: "Total Jobs", value: overview.totalJobs.toLocaleString() },
    {
      label: "Jobs This Month",
      value: overview.jobsThisMonth.toLocaleString(),
      delta: overview.jobsDelta,
    },
    {
      label: "Revenue This Month",
      value: `R${overview.revenueThisMonth.toLocaleString("en-ZA", { minimumFractionDigits: 0 })}`,
    },
    {
      label: "Avg Job Value",
      value: overview.avgJobValue != null
        ? `R${overview.avgJobValue.toLocaleString("en-ZA", { minimumFractionDigits: 0 })}`
        : "N/A",
    },
    {
      label: "Conversion Rate",
      value: overview.conversionRate != null
        ? `${overview.conversionRate.toFixed(1)}%`
        : "N/A",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Business Overview</h1>
        <p className="text-sm text-industrial-400 mt-1">Key metrics at a glance</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="bg-industrial-900 rounded-xl border border-industrial-800 p-4">
            <p className="text-xs text-industrial-500 uppercase tracking-wide">{m.label}</p>
            <p className="text-xl font-bold text-white mt-1">{m.value}</p>
            {"delta" in m && m.delta !== undefined && (
              <p className={`text-xs mt-1 ${m.delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {m.delta >= 0 ? "+" : ""}{m.delta} vs last month
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Jobs by Status */}
        <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Jobs by Status</h2>
          {overview.jobsByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={overview.jobsByStatus}
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {overview.jobsByStatus.map((_, i) => (
                    <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                  itemStyle={{ color: "#f8fafc" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-industrial-500 text-sm">No job data available</p>
          )}
        </div>

        {/* Technician Utilisation */}
        <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Technician Utilisation</h2>
          {overview.techUtilisation.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={overview.techUtilisation}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                  itemStyle={{ color: "#f8fafc" }}
                />
                <Bar dataKey="utilisation" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-industrial-500 text-sm">No technician data available</p>
          )}
        </div>
      </div>
    </div>
  );
}
