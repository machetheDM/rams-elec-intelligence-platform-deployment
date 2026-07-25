"use client";

import { useState, useCallback } from "react";

type Step = "category" | "describe" | "location" | "urgency" | "contact" | "result";

interface FormData {
  serviceCategory: string;
  description: string;
  areaZone: string;
  urgency: string;
  name: string;
  phone: string;
  email: string;
}

interface TriageResult {
  classification: {
    service_category: string;
    urgency: string;
    equipment_mentioned: string[];
    area_zone: string | null;
    estimated_scope: string;
    confidence: number;
  };
  cost_estimate: {
    cost_min: number;
    cost_max: number;
    confidence: number;
    explanation: string;
    similar_jobs_count: number;
  };
  recommended_technicians: Array<{
    name: string;
    combined_score: number;
  }>;
}

const SERVICE_CATEGORIES = [
  { value: "electrical", label: "Electrical", desc: "Wiring, DB boards, compliance, surge protection" },
  { value: "refrigeration", label: "Refrigeration", desc: "Cold rooms, freezers, cooling systems" },
  { value: "hvac", label: "Air Conditioning", desc: "HVAC install, repair, maintenance" },
  { value: "emergency", label: "Emergency", desc: "No power, sparks, burning smell, critical failure" },
  { value: "maintenance", label: "Maintenance", desc: "Preventative service, inspections, tune-ups" },
  { value: "installation", label: "Installation", desc: "New equipment, generators, cold room builds" },
];

function categoryIcon(value: string) {
  const cls = "w-5 h-5 flex-shrink-0";
  switch (value) {
    case "electrical":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
    case "refrigeration":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
    case "hvac":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>;
    case "emergency":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>;
    case "maintenance":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case "installation":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>;
    default:
      return null;
  }
}

const AREA_ZONES = [
  "Sandton", "Midrand", "Centurion", "Pretoria East", "Soweto",
  "Polokwane", "Mokopane", "Bela-Bela",
];

const URGENCY_LEVELS = [
  { value: "low", label: "Not urgent", desc: "Planning ahead, no rush" },
  { value: "medium", label: "Soon", desc: "Within the next week or two" },
  { value: "high", label: "Urgent", desc: "Needs attention within 24–48 hours" },
  { value: "emergency", label: "Emergency", desc: "Immediate response required" },
];

function urgencyIcon(value: string) {
  const cls = "w-5 h-5 flex-shrink-0";
  switch (value) {
    case "low":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M12 5l7 7-7 7" /></svg>;
    case "medium":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case "high":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
    case "emergency":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>;
    default:
      return null;
  }
}

export default function InquiryForm() {
  const [step, setStep] = useState<Step>("category");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    serviceCategory: "",
    description: "",
    areaZone: "",
    urgency: "",
    name: "",
    phone: "",
    email: "",
  });

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_TRIAGE_API_URL || "http://localhost:8001"}/triage/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_message: `Service: ${formData.serviceCategory}. ${formData.description}. Area: ${formData.areaZone}. Urgency: ${formData.urgency}.`,
          source: "web_form",
          customer_name: formData.name,
          customer_phone: formData.phone,
        }),
      });

      if (!res.ok) throw new Error("Classification failed");

      const classification = await res.json();

      const costRes = await fetch(`${process.env.NEXT_PUBLIC_TRIAGE_API_URL || "http://localhost:8001"}/triage/estimate-cost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_category: classification.service_category,
          urgency: classification.urgency,
          area_zone: classification.area_zone || formData.areaZone,
          estimated_scope: classification.estimated_scope,
        }),
      });

      if (!costRes.ok) throw new Error("Cost estimation failed");

      const costEstimate = await costRes.json();

      const techRes = await fetch(`${process.env.NEXT_PUBLIC_TRIAGE_API_URL || "http://localhost:8001"}/triage/assign-technician`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(classification),
      });

      const techAssignment = await techRes.json();

      setResult({
        classification,
        cost_estimate: costEstimate,
        recommended_technicians: techAssignment.recommendations || [],
      });
      setStep("result");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [formData]);

  const canProceed = (s: Step): boolean => {
    switch (s) {
      case "category": return !!formData.serviceCategory;
      case "describe": return formData.description.length >= 10;
      case "location": return !!formData.areaZone;
      case "urgency": return !!formData.urgency;
      case "contact": return !!formData.name && !!formData.phone;
      default: return true;
    }
  };

  const progressPercent = (): number => {
    const steps: Step[] = ["category", "describe", "location", "urgency", "contact"];
    const idx = steps.indexOf(step);
    return idx >= 0 ? ((idx + 1) / steps.length) * 100 : 100;
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-industrial-900 rounded-2xl shadow-2xl shadow-black/40 border border-industrial-800 overflow-hidden">
      {/* Progress bar */}
      {step !== "result" && (
        <div className="h-1.5 bg-industrial-800">
          <div
            className="h-full bg-brand-500 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent()}%` }}
          />
        </div>
      )}

      <div className="p-6 sm:p-8">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">
            {step === "result" ? (
              <>
                <svg className="w-6 h-6 inline-block text-green-400 mr-2 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Your Inquiry is Submitted
              </>
            ) : "Get an Instant Quote"}
          </h2>
          <p className="text-sm text-industrial-400 mt-1">
            {step === "result"
              ? "Our AI has analysed your request. Here's what to expect."
              : "Our AI will analyse your needs and provide an instant cost estimate."}
          </p>
        </div>

        {/* Step 1: Service Category */}
        {step === "category" && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-industrial-300 mb-2">
              What do you need help with?
            </label>
            {SERVICE_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => {
                  updateField("serviceCategory", cat.value);
                  setStep("describe");
                }}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                  formData.serviceCategory === cat.value
                    ? "border-brand-500 bg-brand-500/10"
                    : "border-industrial-700 hover:border-brand-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-brand-500">{categoryIcon(cat.value)}</span>
                  <div>
                    <span className="font-semibold text-white">{cat.label}</span>
                    <span className="block text-sm text-industrial-400 mt-0.5">{cat.desc}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Describe the Problem */}
        {step === "describe" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-industrial-300 mb-2">
                Describe the problem or what you need
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="E.g. 'My cold room is not maintaining temperature, the compressor keeps cycling on and off. I have perishable goods inside that need to stay at -18°C.'"
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-industrial-700 bg-industrial-800 text-white placeholder-industrial-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              />
              <p className="text-xs text-industrial-500 mt-1">
                The more detail you provide, the more accurate your estimate will be.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep("category")}
                className="px-4 py-2.5 text-sm font-medium text-industrial-400 hover:text-white transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep("location")}
                disabled={!canProceed("describe")}
                className="ml-auto px-6 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:bg-industrial-700 disabled:text-industrial-500 text-white text-sm font-semibold rounded-xl transition-all"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Location */}
        {step === "location" && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-industrial-300 mb-2">
              Where are you located?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {AREA_ZONES.map((zone) => (
                <button
                  key={zone}
                  onClick={() => {
                    updateField("areaZone", zone);
                    setStep("urgency");
                  }}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    formData.areaZone === zone
                      ? "border-brand-500 bg-brand-500/10 text-brand-400"
                      : "border-industrial-700 text-industrial-300 hover:border-brand-600"
                  }`}
                >
                  {zone}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep("describe")}
              className="px-4 py-2.5 text-sm font-medium text-industrial-400 hover:text-white transition-colors"
            >
              ← Back
            </button>
          </div>
        )}

        {/* Step 4: Urgency */}
        {step === "urgency" && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-industrial-300 mb-2">
              How urgent is this?
            </label>
            {URGENCY_LEVELS.map((level) => (
              <button
                key={level.value}
                onClick={() => {
                  updateField("urgency", level.value);
                  setStep("contact");
                }}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  formData.urgency === level.value
                    ? "border-brand-500 bg-brand-500/10"
                    : "border-industrial-700 hover:border-brand-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-brand-500">{urgencyIcon(level.value)}</span>
                  <div>
                    <span className="font-semibold text-white">{level.label}</span>
                    <span className="block text-sm text-industrial-400 mt-0.5">{level.desc}</span>
                  </div>
                </div>
              </button>
            ))}
            <button
              onClick={() => setStep("location")}
              className="px-4 py-2.5 text-sm font-medium text-industrial-400 hover:text-white transition-colors"
            >
              ← Back
            </button>
          </div>
        )}

        {/* Step 5: Contact Details */}
        {step === "contact" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-industrial-300 mb-1">Your Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Thabo Molefe"
                className="w-full px-4 py-2.5 rounded-xl border border-industrial-700 bg-industrial-800 text-white placeholder-industrial-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-industrial-300 mb-1">Phone Number *</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="+27 83 123 4567"
                className="w-full px-4 py-2.5 rounded-xl border border-industrial-700 bg-industrial-800 text-white placeholder-industrial-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-industrial-300 mb-1">Email (optional)</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="thabo@email.co.za"
                className="w-full px-4 py-2.5 rounded-xl border border-industrial-700 bg-industrial-800 text-white placeholder-industrial-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep("urgency")}
                className="px-4 py-2.5 text-sm font-medium text-industrial-400 hover:text-white transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canProceed("contact") || loading}
                className="ml-auto px-8 py-3 bg-brand-500 hover:bg-brand-600 disabled:bg-industrial-700 disabled:text-industrial-500 text-white font-semibold rounded-xl transition-all flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    AI Analysing...
                  </>
                ) : (
                  "Get Instant Estimate →"
                )}
              </button>
            </div>
            {error && (
              <p className="text-red-500 text-sm mt-2">{error}</p>
            )}
          </div>
        )}

        {/* Result */}
        {step === "result" && result && (
          <div className="space-y-5">
            {/* Classification */}
            <div className="p-4 bg-industrial-800 rounded-xl">
              <p className="text-sm text-industrial-400">We understood your request as:</p>
              <p className="font-semibold text-white mt-1">
                {result.classification.estimated_scope}
              </p>
              <div className="flex gap-2 mt-2">
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-brand-500/20 text-brand-400">
                  {result.classification.service_category}
                </span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  result.classification.urgency === "emergency"
                    ? "bg-red-500/20 text-red-400"
                    : "bg-blue-500/20 text-blue-400"
                }`}>
                  {result.classification.urgency}
                </span>
              </div>
            </div>

            {/* Cost Estimate */}
            <div className="p-5 bg-brand-500/5 rounded-xl border border-brand-500/20">
              <p className="text-sm text-brand-400 font-medium">Estimated Cost Range</p>
              <p className="text-3xl font-bold text-brand-500 mt-1">
                R{result.cost_estimate.cost_min.toLocaleString()} – R{result.cost_estimate.cost_max.toLocaleString()}
              </p>
              <p className="text-xs text-industrial-400 mt-2">
                {result.cost_estimate.explanation}
              </p>
              {result.cost_estimate.similar_jobs_count > 0 && (
                <p className="text-xs text-industrial-500 mt-1">
                  Based on {result.cost_estimate.similar_jobs_count} similar jobs in our database.
                </p>
              )}
            </div>

            {/* Response Time */}
            <div className="p-4 bg-green-500/5 rounded-xl border border-green-500/20">
              <p className="font-semibold text-green-400">
                {result.classification.urgency === "emergency"
                  ? (
                    <>
                      <svg className="w-5 h-5 inline-block mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                      You&apos;ll hear from us within 1 hour
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 inline-block mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                      You&apos;ll hear from us within 4 hours
                    </>
                  )}
              </p>
              <p className="text-sm text-green-400/70 mt-1">
                {result.recommended_technicians.length > 0
                  ? `Our technician ${result.recommended_technicians[0].name} has been notified.`
                  : "Our team will review your request and assign the best technician."}
              </p>
            </div>

            {/* Emergency CTA */}
            {result.classification.urgency === "emergency" && (
              <a
                href="tel:+27711018493"
                className="block w-full text-center px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all"
              >
                📞 Call Emergency Line: +27 71 101 8493
              </a>
            )}

            <button
              onClick={() => {
                setStep("category");
                setResult(null);
                setFormData({ serviceCategory: "", description: "", areaZone: "", urgency: "", name: "", phone: "", email: "" });
              }}
              className="w-full px-6 py-2.5 text-sm font-medium text-industrial-400 hover:text-white transition-colors"
            >
              Submit Another Inquiry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
