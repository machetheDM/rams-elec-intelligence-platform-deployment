"use client";

import { useState, useEffect } from "react";
import {
  PieChart, Pie, Cell,
  Tooltip, ResponsiveContainer,
} from "recharts";

interface EquipmentData {
  byType: { name: string; value: number }[];
  totalEquipment: number;
  overdueCount: number;
  complianceRate: number;
  overdue: {
    type: string;
    brand: string;
    model: string;
    customer: string;
    scheduledDate: string;
    daysOverdue: number;
  }[];
  upcoming: {
    type: string;
    brand: string;
    customer: string;
    scheduledDate: string;
  }[];
}

const TYPE_COLORS = ["#f59e0b", "#3b82f6", "#8b5cf6", "#10b981", "#ef4444", "#ec4899", "#14b8a6"];

export default function EquipmentAnalyticsPage() {
  const [data, setData] = useState<EquipmentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/analytics/equipment");
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
        <h1 className="text-2xl font-bold text-white">Equipment &amp; Maintenance</h1>
        <p className="text-industrial-400">Loading...</p>
      </div>
    );
  }

  const d = data ?? {
    byType: [], totalEquipment: 0, overdueCount: 0,
    complianceRate: 100, overdue: [], upcoming: [],
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Equipment &amp; Maintenance</h1>
        <p className="text-sm text-industrial-400 mt-1">Track equipment health and maintenance compliance</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-4">
          <p className="text-xs text-industrial-500 uppercase tracking-wide">Total Equipment</p>
          <p className="text-2xl font-bold text-white mt-1">{d.totalEquipment}</p>
        </div>
        <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-4">
          <p className="text-xs text-industrial-500 uppercase tracking-wide">Maintenance Compliance</p>
          <p className={`text-2xl font-bold mt-1 ${d.complianceRate >= 90 ? "text-emerald-400" : d.complianceRate >= 70 ? "text-amber-400" : "text-red-400"}`}>
            {d.complianceRate.toFixed(1)}%
          </p>
        </div>
        <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-4">
          <p className="text-xs text-industrial-500 uppercase tracking-wide">Overdue</p>
          <p className={`text-2xl font-bold mt-1 ${d.overdueCount === 0 ? "text-emerald-400" : "text-red-400"}`}>
            {d.overdueCount}
          </p>
        </div>
      </div>

      {/* Equipment by type chart */}
      <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Equipment by Type</h2>
        {d.byType.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={d.byType}
                cx="50%" cy="50%"
                innerRadius={60} outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {d.byType.map((_, i) => (
                  <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                itemStyle={{ color: "#f8fafc" }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-industrial-500 text-sm">No equipment data available</p>
        )}
      </div>

      {/* Overdue maintenance table */}
      <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Overdue Maintenance</h2>
        {d.overdue.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-industrial-800">
                  <th className="text-left py-2 px-3 text-industrial-400 font-medium">Type</th>
                  <th className="text-left py-2 px-3 text-industrial-400 font-medium">Brand / Model</th>
                  <th className="text-left py-2 px-3 text-industrial-400 font-medium">Customer</th>
                  <th className="text-left py-2 px-3 text-industrial-400 font-medium">Scheduled</th>
                  <th className="text-right py-2 px-3 text-industrial-400 font-medium">Days Overdue</th>
                </tr>
              </thead>
              <tbody>
                {d.overdue.map((row, i) => (
                  <tr key={i} className="border-b border-industrial-800/50 hover:bg-industrial-800/30">
                    <td className="py-2 px-3 text-white">{row.type}</td>
                    <td className="py-2 px-3 text-industrial-300">{row.brand} {row.model}</td>
                    <td className="py-2 px-3 text-industrial-300">{row.customer}</td>
                    <td className="py-2 px-3 text-industrial-300">{row.scheduledDate}</td>
                    <td className="py-2 px-3 text-right text-red-400 font-semibold">{row.daysOverdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-emerald-400 text-sm">No overdue maintenance — all equipment is up to date.</p>
        )}
      </div>

      {/* Upcoming maintenance */}
      <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Upcoming Maintenance (Next 30 Days)</h2>
        {d.upcoming.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-industrial-800">
                  <th className="text-left py-2 px-3 text-industrial-400 font-medium">Type</th>
                  <th className="text-left py-2 px-3 text-industrial-400 font-medium">Brand</th>
                  <th className="text-left py-2 px-3 text-industrial-400 font-medium">Customer</th>
                  <th className="text-left py-2 px-3 text-industrial-400 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {d.upcoming.map((row, i) => (
                  <tr key={i} className="border-b border-industrial-800/50 hover:bg-industrial-800/30">
                    <td className="py-2 px-3 text-white">{row.type}</td>
                    <td className="py-2 px-3 text-industrial-300">{row.brand}</td>
                    <td className="py-2 px-3 text-industrial-300">{row.customer}</td>
                    <td className="py-2 px-3 text-industrial-300">{row.scheduledDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-industrial-500 text-sm">No maintenance scheduled in the next 30 days.</p>
        )}
      </div>
    </div>
  );
}
