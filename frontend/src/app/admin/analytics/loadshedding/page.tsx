"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis,
} from "recharts";

interface LoadSheddingData {
  byStage: { name: string; count: number }[];
  byZone: { name: string; count: number }[];
  correlation: {
    data: { lsEvents: number; emergencyCount: number }[];
    coefficient: number | null;
  };
  totalEvents: number;
}

export default function LoadSheddingImpactPage() {
  const [data, setData] = useState<LoadSheddingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/analytics/loadshedding");
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
        <h1 className="text-2xl font-bold text-white">Load-Shedding Impact</h1>
        <p className="text-industrial-400">Loading...</p>
      </div>
    );
  }

  const d = data ?? { byStage: [], byZone: [], correlation: { data: [], coefficient: null }, totalEvents: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Load-Shedding Impact</h1>
          <p className="text-sm text-industrial-400 mt-1">Correlation between load-shedding and emergency inquiries</p>
        </div>
        <div className="bg-industrial-900 rounded-xl border border-industrial-800 px-4 py-2">
          <p className="text-xs text-industrial-500">Total LS Events</p>
          <p className="text-xl font-bold text-amber-400">{d.totalEvents.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Events by Stage */}
        <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Events by Stage</h2>
          {d.byStage.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={d.byStage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                  itemStyle={{ color: "#f8fafc" }}
                />
                <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-industrial-500 text-sm">No load-shedding data available</p>
          )}
        </div>

        {/* Events by Zone */}
        <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Events by Area Zone</h2>
          {d.byZone.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={d.byZone} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} width={100} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                  itemStyle={{ color: "#f8fafc" }}
                />
                <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-industrial-500 text-sm">No zone data available</p>
          )}
        </div>
      </div>

      {/* Correlation scatter */}
      <div className="bg-industrial-900 rounded-xl border border-industrial-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Emergency Inquiries vs Load-Shedding</h2>
          {d.correlation.coefficient != null && (
            <div className="bg-industrial-800 rounded-lg px-3 py-1">
              <p className="text-xs text-industrial-400">
                Correlation: <span className="text-white font-semibold">{d.correlation.coefficient.toFixed(3)}</span>
              </p>
            </div>
          )}
        </div>
        {d.correlation.data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                type="number" dataKey="lsEvents" name="LS Events"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                label={{ value: "Load-Shedding Events", position: "bottom", fill: "#94a3b8", fontSize: 12 }}
              />
              <YAxis
                type="number" dataKey="emergencyCount" name="Emergencies"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                label={{ value: "Emergency Inquiries", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 12 }}
              />
              <ZAxis range={[40, 40]} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                itemStyle={{ color: "#f8fafc" }}
                cursor={{ strokeDasharray: "3 3" }}
              />
              <Scatter data={d.correlation.data} fill="#f59e0b" />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-industrial-500 text-sm">
            Not enough data points to calculate correlation. Need at least 4 days with both
            load-shedding events and emergency inquiries.
          </p>
        )}
      </div>
    </div>
  );
}
