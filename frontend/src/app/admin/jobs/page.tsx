"use client";

import { useState, useEffect, useCallback } from "react";

interface Job {
  id: string;
  customer_name: string;
  service_name: string;
  area_zone: string;
  urgency: string;
  status: string;
  scheduled_date: string;
  quoted_cost: number;
  technician_name: string | null;
}

interface TechnicianScore {
  technician_id: string;
  name: string;
  combined_score: number;
  skill_match_score: number;
  availability_score: number;
  area_familiarity_score: number;
  current_workload: number;
  explanation: string;
}

const STATUS_COLUMNS = ["open", "assigned", "in_progress", "complete"];

const URGENCY_COLORS: Record<string, string> = {
  emergency: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

export default function AdminJobBoard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [recommendations, setRecommendations] = useState<TechnicianScore[]>([]);
  const [recLoading, setRecLoading] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/jobs");
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const getRecommendations = async (job: Job) => {
    setSelectedJob(job);
    setRecLoading(true);
    try {
      const res = await fetch(
        "/api/dispatch/recommend",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service_category: job.service_name.toLowerCase().includes("cold") || job.service_name.toLowerCase().includes("hvac") || job.service_name.toLowerCase().includes("refrig") ? "refrigeration" : "electrical",
            urgency: job.urgency,
            area_zone: job.area_zone,
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
      }
    } catch (err) {
      console.error("Failed to get recommendations:", err);
    } finally {
      setRecLoading(false);
    }
  };

  const assignTechnician = async (jobId: string, technicianId: string) => {
    try {
      const res = await fetch(
        "/api/dispatch/assign",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job_id: jobId, technician_id: technicianId }),
        }
      );
      if (res.ok) {
        setSelectedJob(null);
        setRecommendations([]);
        fetchJobs();
      }
    } catch (err) {
      console.error("Failed to assign technician:", err);
    }
  };

  const jobsByStatus = (status: string) => jobs.filter((j) => j.status === status);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Job Board</h1>
          <span className="text-sm text-gray-500">{jobs.length} jobs</span>
        </div>

        {/* Kanban Board */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STATUS_COLUMNS.map((status) => (
            <div key={status} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-white capitalize">
                  {status.replace("_", " ")}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
                  {jobsByStatus(status).length}
                </span>
              </div>
              <div className="space-y-2">
                {jobsByStatus(status).map((job) => (
                  <div
                    key={job.id}
                    onClick={() => status === "open" && getRecommendations(job)}
                    className={`p-3 rounded-lg border text-sm cursor-pointer transition-all ${
                      status === "open"
                        ? "border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-600 hover:shadow"
                        : "border-gray-100 dark:border-gray-800"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900 dark:text-white truncate">
                        {job.service_name}
                      </span>
                      <span className={`px-1.5 py-0.5 text-xs rounded-full ${URGENCY_COLORS[job.urgency] || URGENCY_COLORS.medium}`}>
                        {job.urgency}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{job.customer_name}</p>
                    <p className="text-xs text-gray-400">{job.area_zone}</p>
                    {job.technician_name && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        👤 {job.technician_name}
                      </p>
                    )}
                    {job.quoted_cost && (
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-1">
                        R{job.quoted_cost.toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Recommendation Modal */}
        {selectedJob && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 max-w-lg w-full max-h-[80vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Assign Technician
                </h2>
                <button
                  onClick={() => { setSelectedJob(null); setRecommendations([]); }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>

              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
                <p className="font-medium text-gray-900 dark:text-white">{selectedJob.service_name}</p>
                <p className="text-gray-500">{selectedJob.customer_name} · {selectedJob.area_zone}</p>
                <p className="text-gray-500">Urgency: {selectedJob.urgency}</p>
              </div>

              {recLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-amber-500 border-t-transparent rounded-full mx-auto" />
                  <p className="text-sm text-gray-500 mt-2">Finding best technicians...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Top Recommendations
                  </p>
                  {recommendations.map((tech) => (
                    <div
                      key={tech.technician_id}
                      className="p-3 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-amber-300 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">
                            {tech.name}
                          </p>
                          <p className="text-xs text-gray-500">{tech.explanation}</p>
                        </div>
                        <span className="text-lg font-bold text-amber-600">
                          {(tech.combined_score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex gap-2 mt-2 text-xs text-gray-500">
                        <span>Skills: {(tech.skill_match_score * 100).toFixed(0)}%</span>
                        <span>·</span>
                        <span>Avail: {(tech.availability_score * 100).toFixed(0)}%</span>
                        <span>·</span>
                        <span>Area: {(tech.area_familiarity_score * 100).toFixed(0)}%</span>
                        <span>·</span>
                        <span>Load: {tech.current_workload} jobs</span>
                      </div>
                      <button
                        onClick={() => assignTechnician(selectedJob.id, tech.technician_id)}
                        className="mt-2 w-full px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-all"
                      >
                        Assign {tech.name}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
