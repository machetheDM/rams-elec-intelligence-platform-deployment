"use client";

import { useModelMetrics } from "@/hooks/useModelMetrics";
import type { ModelMetrics } from "@/lib/api/triage";

/**
 * Quote estimator — live model evaluation readout.
 *
 * All numbers come from useModelMetrics (ultimately services/triage's
 * metrics.json, written by train_model.py) — nothing here is hardcoded.
 * The `data_source` field is surfaced verbatim so a model trained on the
 * synthetic ETL fallback can never be mistaken for one trained on real
 * client job history.
 */

// A Map rather than an object literal: keys come from the API's
// feature_importance payload, and a bracket lookup on a plain object would
// resolve inherited keys like "__proto__" / "constructor" to truthy values.
const FEATURE_LABELS = new Map<string, string>([
  ["service_category_encoded", "Service category"],
  ["urgency_flag", "Urgency"],
  ["area_zone_encoded", "Area zone"],
  ["equipment_age_years", "Equipment age"],
  ["month", "Month"],
  ["day_of_week", "Day of week"],
  ["is_weekend", "Weekend"],
]);

function formatRand(value: number | null): string {
  if (value === null) return "—";
  return `R${Math.round(value).toLocaleString("en-ZA")}`;
}

export default function QuoteEstimatorStats() {
  const { metrics, loading, error } = useModelMetrics();

  return (
    <section className="relative overflow-hidden border-y border-industrial-800 bg-industrial-900/40 py-24 lg:py-32">
      <div className="pointer-events-none absolute inset-0 bg-grid-fine opacity-40" />
      {/* Instrumentation glow behind the readout column */}
      <div className="pointer-events-none absolute right-0 top-1/2 h-[32rem] w-[32rem] -translate-y-1/2 translate-x-1/3 rounded-full bg-brand-500/[0.05] blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-20">
          {/* ---- Left: narrative ---- */}
          <div className="lg:col-span-5">
            <span className="mono-label">04 / Machine Learning</span>
            <h2 className="section-heading mt-4 text-balance">
              Quoting backed by
              <br />
              <span className="gradient-text">a trained model.</span>
            </h2>
            <div className="rule-accent mt-6 max-w-xs" />
            <p className="section-subheading mt-6 text-pretty">
              Our cost estimator is an XGBoost regression model trained on completed job history
              through a Bronze&nbsp;&rarr;&nbsp;Silver&nbsp;&rarr;&nbsp;Gold ETL pipeline, with
              SHAP explainability on every prediction. These are its real held-out evaluation
              figures — not marketing numbers.
            </p>

            <dl className="mt-10 space-y-0">
              <SpecRow label="Algorithm" value="XGBoost regressor" />
              <SpecRow label="Validation" value={metrics?.cv_folds ? `${metrics.cv_folds}-fold cross-validation` : "Cross-validated"} />
              <SpecRow label="Explainability" value="SHAP (per-prediction attribution)" />
              <SpecRow label="Tracking" value="MLflow experiment registry" />
            </dl>
          </div>

          {/* ---- Right: live metric readout ---- */}
          <div className="lg:col-span-7">
            {loading && <MetricsSkeleton />}
            {!loading && (error || !metrics?.trained) && <MetricsUnavailable error={error} />}
            {!loading && !error && metrics?.trained && <MetricsReadout metrics={metrics} />}
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricsReadout({ metrics }: { metrics: ModelMetrics }) {
  const totalSamples = (metrics.training_samples ?? 0) + (metrics.test_samples ?? 0);
  const importance = metrics.feature_importance ?? {};
  const ranked = Object.entries(importance).sort(([, a], [, b]) => b - a);
  // Share of TOTAL gain, not share of the top feature. Normalising against
  // the max would always render the leading feature as "100%", which reads
  // as "this feature explains everything" — misleading for a published
  // portfolio figure. Share-of-total is the standard interpretation.
  const totalImportance = ranked.reduce((sum, [, gain]) => sum + gain, 0) || 1;

  return (
    <div className="tile relative overflow-hidden p-7 lg:p-9">
      {/* Corner brackets frame the readout like an instrument bezel */}
      <span className="pointer-events-none absolute left-4 top-4 h-5 w-5 border-l border-t border-industrial-700" />
      <span className="pointer-events-none absolute right-4 top-4 h-5 w-5 border-r border-t border-industrial-700" />
      <span className="pointer-events-none absolute bottom-4 left-4 h-5 w-5 border-b border-l border-industrial-700" />
      <span className="pointer-events-none absolute bottom-4 right-4 h-5 w-5 border-b border-r border-industrial-700" />

      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-industrial-800 pb-5">
        <span className="mono-label-muted">Held-out evaluation</span>
        <span className="flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/5 px-3 py-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-green-400">
            Model trained
          </span>
        </span>
      </div>

      {/* Headline metrics — divided cells, like a panel of gauges */}
      <div className="relative grid grid-cols-2 gap-px overflow-hidden py-8 sm:grid-cols-4 sm:gap-0 sm:divide-x sm:divide-industrial-800">
        <MetricFigure label="MAE" value={formatRand(metrics.mae)} hint="Mean abs. error" />
        <MetricFigure
          label="R²"
          value={metrics.r2 !== null ? metrics.r2.toFixed(3) : "—"}
          hint="Variance explained"
        />
        <MetricFigure label="CV MAE" value={formatRand(metrics.cv_mae)} hint="Cross-validated" />
        <MetricFigure
          label="Samples"
          value={totalSamples > 0 ? totalSamples.toLocaleString("en-ZA") : "—"}
          hint={`${metrics.training_samples ?? 0} train / ${metrics.test_samples ?? 0} test`}
        />
      </div>

      {/* Feature importance */}
      {ranked.length > 0 && (
        <div className="relative border-t border-industrial-800 pt-7">
          <div className="flex items-center justify-between">
            <span className="mono-label-muted">Feature importance — share of total gain</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-industrial-600">
              Top {Math.min(5, ranked.length)} of {ranked.length}
            </span>
          </div>
          <div className="mt-6 space-y-4">
            {ranked.slice(0, 5).map(([feature, gain]) => (
              <div key={feature} className="flex items-center gap-4">
                <span className="w-32 flex-shrink-0 truncate text-xs text-industrial-400">
                  {FEATURE_LABELS.get(feature) ?? feature}
                </span>
                <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-industrial-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400"
                    style={{ width: `${Math.max(2, (gain / totalImportance) * 100)}%` }}
                  />
                </div>
                <span className="w-10 flex-shrink-0 text-right font-mono text-[11px] tabular-nums text-industrial-500">
                  {((gain / totalImportance) * 100).toFixed(0)}
                  <span className="text-industrial-600">%</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Provenance — deliberately prominent, never buried */}
      <div className="mt-7 flex items-start gap-2.5 border-t border-industrial-800 pt-5">
        <svg
          className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-industrial-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-xs leading-relaxed text-industrial-500">
          Trained on{" "}
          <span className="font-mono text-industrial-400">{metrics.data_source}</span>
          {metrics.data_source?.startsWith("synthetic") && (
            <> — synthetic data generated through the production ETL pipeline. Figures will change once real client job history is ingested.</>
          )}
          {metrics.trained_at && (
            <> Last trained {new Date(metrics.trained_at).toLocaleDateString("en-ZA", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}.</>
          )}
        </p>
      </div>
    </div>
  );
}

function MetricFigure({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="group/metric sm:px-5 sm:first:pl-0 sm:last:pr-0">
      <span className="mono-label-muted">{label}</span>
      <p className="stat-figure mt-2 text-3xl transition-colors group-hover/metric:text-brand-400 lg:text-4xl">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-industrial-500">{hint}</p>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="group/spec flex items-baseline justify-between gap-4 border-b border-industrial-800/60 py-3 transition-colors hover:border-brand-600/30">
      <dt className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.15em] text-industrial-500">
        <span className="h-1 w-1 rounded-full bg-industrial-600 transition-colors group-hover/spec:bg-brand-500" />
        {label}
      </dt>
      <dd className="text-right text-sm text-industrial-300">{value}</dd>
    </div>
  );
}

function MetricsSkeleton() {
  return (
    <div className="tile p-7 lg:p-9" aria-busy="true" aria-label="Loading model metrics">
      <div className="h-4 w-40 animate-pulse rounded bg-industrial-800" />
      <div className="grid grid-cols-2 gap-6 py-8 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>
            <div className="h-3 w-12 animate-pulse rounded bg-industrial-800" />
            <div className="mt-3 h-9 w-24 animate-pulse rounded bg-industrial-800" />
          </div>
        ))}
      </div>
      <div className="space-y-3 border-t border-industrial-800 pt-7">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-1.5 w-full animate-pulse rounded-full bg-industrial-800" />
        ))}
      </div>
    </div>
  );
}

function MetricsUnavailable({ error }: { error: string | null }) {
  return (
    <div className="tile p-7 lg:p-9">
      <span className="mono-label-muted">Held-out evaluation</span>
      <p className="mt-4 text-sm text-industrial-400">
        Model metrics are currently unavailable
        {error ? " — the triage service could not be reached." : " because no model has been trained yet."}
      </p>
      <p className="mt-3 text-xs text-industrial-500">
        Estimates fall back to documented heuristic cost ranges by service category and urgency
        until a trained model is published.
      </p>
    </div>
  );
}
