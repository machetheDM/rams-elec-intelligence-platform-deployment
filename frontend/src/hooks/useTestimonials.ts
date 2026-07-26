"use client";

/**
 * Headless data hook — state management only, zero markup.
 *
 * Same {data, loading, error} shape as `@/hooks/useModelMetrics`, so a
 * testimonials UI can be designed identically to the other data-driven
 * sections. Pairs with `@/lib/api/testimonials`, which owns the real-vs-
 * sample gating.
 */

import { useEffect, useState } from "react";
import { fetchTestimonials, type Testimonial } from "@/lib/api/testimonials";

export interface UseTestimonialsResult {
  testimonials: Testimonial[];
  loading: boolean;
  error: string | null;
  /** True when there is nothing to show — render the trust panel instead. */
  isEmpty: boolean;
}

export function useTestimonials(): UseTestimonialsResult {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchTestimonials()
      .then((data) => {
        if (!cancelled) setTestimonials(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load testimonials");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    testimonials,
    loading,
    error,
    isEmpty: !loading && testimonials.length === 0,
  };
}
