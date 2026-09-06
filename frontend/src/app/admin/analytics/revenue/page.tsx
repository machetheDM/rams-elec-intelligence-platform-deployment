"use client";

import { useState, useEffect } from "react";
import {
  ComposedChart, Bar, Line, BarChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface RevenueData {
  monthlyTrend: { month: string; revenue: number; jobCount: number }[];
  byCategory: { name: string; revenue: number }[];
  totalRevenue: number;
  totalJobs: number;
}

export default function RevenueAnalyticsPage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/analytics/revenue");
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
        <h1 className="text-2xl font-bold text-white">Revenue &amp; Forecasting</h1>
        <p className="text-industrial-400">Loading...</p>
      </div>
    );
  }

  const d = data ?? { monthlyTrend: [], byCategory: [], totalRevenue: 0, totalJobs: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Revenue &amp; Forecasting</h1>
          <p className="text-sm text-industrial-400 mt-1">Monthly revenue trends and breakdown</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-industrial-900 rounded-xl border border-industrial-800 px-4 py-2">
            <p className="text-xs text-industrial-500">Total Revenue</p>
            <p className="text-xl font-bold text-amber-400">R{d.totalRevenue.toLocaleString("en-ZA")}</p>
          </div>
          <div className="bg-industrial-900 rounded-xl border border-industrial-800 px-4 py-2">
            <p className="text-xs text-industrial-500">Completed Jobs</p>
            <p className="text-xl font-bold text-white">{d.totalJobs.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Monthly revenue trend with dual axis */}
      <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Monthly Revenue Trend</h2>
        {d.monthlyTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={d.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`}
              />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                itemStyle={{ color: "#f8fafc" }}
                formatter={(value, name) =>
                  name === "revenue" ? `R${Number(value).toLocaleString("en-ZA")}` : String(value)
                }
              />
              <Legend wrapperStyle={{ color: "#94a3b8" }} />
              <Bar yAxisId="left" dataKey="revenue" fill="#f59e0b" name="Revenue (R)" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="jobCount" stroke="#3b82f6" strokeWidth={2} name="Job Count" dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-industrial-500 text-sm">No revenue data available</p>
        )}
      </div>

      {/* Revenue by category */}
      <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Revenue by Service Category</h2>
        {d.byCategory.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={d.byCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                itemStyle={{ color: "#f8fafc" }}
                formatter={(value) => `R${Number(value).toLocaleString("en-ZA")}`}
              />
              <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-industrial-500 text-sm">No category breakdown available</p>
        )}
      </div>

      {/* Forecast disclosure */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
        <p className="text-sm text-amber-400">
          Revenue forecasting (Prophet time-series) will be available once 6+ months of completed
          job data exist. Current data is from the synthetic ETL pipeline.
        </p>
      </div>
    </div>
  );
}
