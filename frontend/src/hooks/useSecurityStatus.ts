"use client";

/**
 * Headless data hook — state management only, zero markup.
 *
 * Same {data, loading, error} shape as `@/hooks/useModelMetrics`, so a
 * "security posture" widget can be designed identically to the model
 * metrics one even though this one currently resolves from a static
 * dataset, not a live endpoint — see `@/lib/api/security.ts` for why.
 */

import { useEffect, useState } from "react";
import { fetchSecurityStatus, type SecurityStatus } from "@/lib/api/security";

export interface UseSecurityStatusResult {
  status: SecurityStatus | null;
  loading: boolean;
  error: string | null;
}

export function useSecurityStatus(): UseSecurityStatusResult {
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchSecurityStatus()
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load security status");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { status, loading, error };
}
