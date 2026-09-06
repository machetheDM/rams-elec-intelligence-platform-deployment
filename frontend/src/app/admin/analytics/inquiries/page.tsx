"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface InquiryData {
  dailyVolume: { date: string; count: number }[];
  byCategory: { name: string; count: number }[];
  bySource: { name: string; value: number }[];
  byStatus: { name: string; count: number }[];
  total: number;
}

const COLORS = ["#f59e0b", "#3b82f6", "#8b5cf6", "#10b981", "#ef4444", "#ec4899"];

export default function InquiryAnalyticsPage() {
  const [data, setData] = useState<InquiryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/analytics/inquiries");
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
        <h1 className="text-2xl font-bold text-white">Inquiry Analytics</h1>
        <p className="text-industrial-400">Loading...</p>
      </div>
    );
  }

  const d = data ?? { dailyVolume: [], byCategory: [], bySource: [], byStatus: [], total: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Inquiry Analytics</h1>
          <p className="text-sm text-industrial-400 mt-1">Track inquiry volume, sources, and conversion</p>
        </div>
        <div className="bg-industrial-900 rounded-xl border border-industrial-800 px-4 py-2">
          <p className="text-xs text-industrial-500">Total Inquiries</p>
          <p className="text-xl font-bold text-white">{d.total.toLocaleString()}</p>
        </div>
      </div>

      {/* Volume over time */}
      <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Inquiry Volume Over Time</h2>
        {d.dailyVolume.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={d.dailyVolume}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                itemStyle={{ color: "#f8fafc" }}
              />
              <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-industrial-500 text-sm">No inquiry data available. Seed the database first.</p>
        )}
      </div>

      {/* Bottom charts */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* By Category */}
        <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">By Service Category</h2>
          {d.byCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={d.byCategory} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} width={100} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                  itemStyle={{ color: "#f8fafc" }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-industrial-500 text-sm">No data</p>
          )}
        </div>

        {/* By Source */}
        <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">By Source</h2>
          {d.bySource.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={d.bySource}
                  cx="50%" cy="50%"
                  innerRadius={40} outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  label={({ name }) => name}
                >
                  {d.bySource.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                  itemStyle={{ color: "#f8fafc" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-industrial-500 text-sm">No data</p>
          )}
        </div>

        {/* By Status */}
        <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">By Status</h2>
          {d.byStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={d.byStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                  itemStyle={{ color: "#f8fafc" }}
                />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-industrial-500 text-sm">No data</p>
          )}
        </div>
      </div>
    </div>
  );
}
