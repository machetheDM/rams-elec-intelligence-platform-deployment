"use client";

/**
 * Headless subscription hook — state management only, zero markup.
 *
 * Pairs with `@/lib/api/alerts`. Distinguishes three outcomes rather than
 * two, because the service can succeed at the HTTP level while recording
 * nothing (no customer matched that phone number) — reporting that as
 * success would be lying to the visitor.
 */

import { useCallback, useState } from "react";
import { subscribeToAlerts } from "@/lib/api/alerts";

export type SubscriptionOutcome = "idle" | "subscribed" | "not_a_customer";

export interface UseAlertSubscriptionResult {
  outcome: SubscriptionOutcome;
  submitting: boolean;
  error: string | null;
  subscribe: (phone: string, areaZone: string) => Promise<void>;
  reset: () => void;
}

export function useAlertSubscription(): UseAlertSubscriptionResult {
  const [outcome, setOutcome] = useState<SubscriptionOutcome>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscribe = useCallback(
    async (phone: string, areaZone: string) => {
      if (submitting) return;

      setSubmitting(true);
      setError(null);

      try {
        const result = await subscribeToAlerts(phone, areaZone);
        setOutcome(result.matched ? "subscribed" : "not_a_customer");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Subscription failed");
      } finally {
        setSubmitting(false);
      }
    },
    [submitting]
  );

  const reset = useCallback(() => {
    setOutcome("idle");
    setError(null);
  }, []);

  return { outcome, submitting, error, subscribe, reset };
}
