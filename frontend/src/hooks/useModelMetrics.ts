"use client";

/**
 * Headless data hook — state management only, zero markup.
 *
 * Deliberately returns plain data/loading/error, not JSX: any component
 * (in any layout, any styling) can consume this without this file ever
 * needing to change. Pairs with `@/lib/api/triage`, which does the actual
 * fetch — this hook owns only the React lifecycle around that call.
 */

import { useEffect, useState } from "react";
import { fetchModelMetrics, type ModelMetrics } from "@/lib/api/triage";

export interface UseModelMetricsResult {
  metrics: ModelMetrics | null;
  loading: boolean;
  error: string | null;
}

export function useModelMetrics(): UseModelMetricsResult {
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchModelMetrics()
      .then((data) => {
        if (!cancelled) setMetrics(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load model metrics");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { metrics, loading, error };
}
