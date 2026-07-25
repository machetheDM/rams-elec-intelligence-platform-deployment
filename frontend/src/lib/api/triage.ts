/**
 * Triage service API client — pure data-fetching, no React and no markup.
 *
 * Kept separate from any component so this logic survives untouched
 * regardless of how the UI around it is designed/redesigned (this project's
 * frontend layer is being iterated on separately in v0.dev) — components
 * should call the hooks in `@/hooks`, which call the functions here.
 *
 * Note: this calls the same-origin `/api/model-metrics` Next.js route, not
 * the triage service's NEXT_PUBLIC_TRIAGE_API_URL directly — that endpoint
 * requires an X-API-Key (security/auth/api_key_middleware.py), which is a
 * server secret and must never be sent from browser JS. See
 * `frontend/src/app/api/model-metrics/route.ts` for the proxy that holds it.
 */

export interface ModelMetrics {
  trained: boolean;
  trained_at: string | null;
  training_samples: number | null;
  test_samples: number | null;
  data_source: string | null;
  mae: number | null;
  rmse: number | null;
  r2: number | null;
  cv_mae: number | null;
  cv_folds: number | null;
  feature_importance: Record<string, number> | null;
}

/**
 * Fetch the quote estimator's held-out evaluation metrics.
 *
 * Backed by GET /triage/model-metrics, which itself only reads the
 * metrics.json that services/triage/train_model.py writes after each
 * training run — this call never triggers training.
 */
export async function fetchModelMetrics(): Promise<ModelMetrics> {
  const res = await fetch("/api/model-metrics");
  if (!res.ok) {
    throw new Error(`Failed to fetch model metrics (HTTP ${res.status})`);
  }
  return res.json();
}
