"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface TechnicianData {
  performance: {
    name: string;
    jobsCompleted: number;
    avgDays: number | null;
    avgJobValue: number | null;
  }[];
  areaCoverage: {
    name: string;
    [area: string]: string | number;
  }[];
  areas: string[];
}

const AREA_COLORS = ["#f59e0b", "#3b82f6", "#8b5cf6", "#10b981", "#ef4444", "#ec4899", "#14b8a6", "#6366f1"];

export default function TechnicianPerformancePage() {
  const [data, setData] = useState<TechnicianData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/analytics/technicians");
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
        <h1 className="text-2xl font-bold text-white">Technician Performance</h1>
        <p className="text-industrial-400">Loading...</p>
      </div>
    );
  }

  const d = data ?? { performance: [], areaCoverage: [], areas: [] };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Technician Performance</h1>
        <p className="text-sm text-industrial-400 mt-1">Jobs completed, average completion time, and area coverage</p>
      </div>

      {/* Jobs completed and avg value */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Jobs Completed</h2>
          {d.performance.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={d.performance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                  itemStyle={{ color: "#f8fafc" }}
                />
                <Bar dataKey="jobsCompleted" fill="#f59e0b" name="Jobs" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-industrial-500 text-sm">No technician data available</p>
          )}
        </div>

        <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Average Job Value (R)</h2>
          {d.performance.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={d.performance}>
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
                <Bar dataKey="avgJobValue" fill="#8b5cf6" name="Avg Value" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-industrial-500 text-sm">No data</p>
          )}
        </div>
      </div>

      {/* Area coverage stacked bar */}
      <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Area Coverage</h2>
        {d.areaCoverage.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={d.areaCoverage}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                itemStyle={{ color: "#f8fafc" }}
              />
              <Legend wrapperStyle={{ color: "#94a3b8" }} />
              {d.areas.map((area, i) => (
                <Bar key={area} dataKey={area} stackId="areas" fill={AREA_COLORS[i % AREA_COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-industrial-500 text-sm">No area data available</p>
        )}
      </div>

      {/* Technician detail table */}
      <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Technician Details</h2>
        {d.performance.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-industrial-800">
                  <th className="text-left py-2 px-3 text-industrial-400 font-medium">Name</th>
                  <th className="text-right py-2 px-3 text-industrial-400 font-medium">Jobs Done</th>
                  <th className="text-right py-2 px-3 text-industrial-400 font-medium">Avg Days</th>
                  <th className="text-right py-2 px-3 text-industrial-400 font-medium">Avg Value</th>
                </tr>
              </thead>
              <tbody>
                {d.performance.map((t) => (
                  <tr key={t.name} className="border-b border-industrial-800/50 hover:bg-industrial-800/30">
                    <td className="py-2 px-3 text-white font-medium">{t.name}</td>
                    <td className="py-2 px-3 text-right text-industrial-300">{t.jobsCompleted}</td>
                    <td className="py-2 px-3 text-right text-industrial-300">
                      {t.avgDays != null ? t.avgDays.toFixed(1) : "—"}
                    </td>
                    <td className="py-2 px-3 text-right text-industrial-300">
                      {t.avgJobValue != null ? `R${t.avgJobValue.toLocaleString("en-ZA", { minimumFractionDigits: 0 })}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-industrial-500 text-sm">No data</p>
        )}
      </div>
    </div>
  );
}
