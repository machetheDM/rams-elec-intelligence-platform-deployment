"use client";

/**
 * Public enquiry form — presentation only.
 *
 * Every rule lives in `useEnquiryForm`, every request in `lib/api/enquiries`.
 * This file decides how it looks and nothing else, per CLAUDE.md's frontend
 * separation, so the redesign can rework it freely.
 *
 * This is NOT `InquiryForm.tsx`. That one calls the triage service through a
 * same-origin Next route to produce an AI estimate, which a static export
 * cannot serve. This one posts straight to the Manager app's public enquiry
 * endpoint and makes no claim about an instant answer.
 *
 * Styling uses the existing `brand-*` and `industrial-*` tokens rather than
 * literal colours, so retuning the palette restyles this form without
 * editing it.
 */

import Script from "next/script";

import { FALLBACK_PHONE, TURNSTILE_SITE_KEY } from "@/lib/api/enquiries";
import {
  MESSAGE_MAX,
  PREFERRED_CONTACT_LABELS,
  SERVICE_TYPE_LABELS,
  useEnquiryForm,
} from "@/hooks/useEnquiryForm";

const FIELD =
  "w-full rounded-lg border bg-industrial-900 px-4 py-3 text-base text-white " +
  "placeholder:text-industrial-500 focus:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-brand-400 focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-industrial-950";

const FIELD_OK = "border-industrial-700";
const FIELD_BAD = "border-red-500";

const LABEL = "mb-1.5 block text-sm font-medium text-industrial-200";
const ERROR = "mt-1.5 text-sm text-red-400";

/** A dialable href — strip spaces so the phone app gets a clean number. */
const PHONE_HREF = `tel:${FALLBACK_PHONE.replace(/[^+\d]/g, "")}`;

export default function EnquiryForm() {
  const {
    draft,
    setField,
    errors,
    unmappedErrors,
    submitting,
    result,
    submitted,
    submit,
    reset,
    setTurnstileToken,
    messageLength,
  } = useEnquiryForm();

  // Show a field's error only after a submit attempt, so the form does not
  // turn red while someone is still typing their first field. Takes the
  // message itself rather than a field name, so there is no computed lookup.
  const show = (message?: string) => (submitted ? message : undefined);

  // ---- Terminal states: the enquiry is done, so the fields are gone -------

  if (result?.kind === "sent") {
    return (
      <div
        role="status"
        className="rounded-xl border border-brand-500/40 bg-industrial-900 p-6 sm:p-8"
      >
        <h3 className="text-xl font-semibold text-white">Thank you — we have your enquiry.</h3>
        <p className="mt-3 text-industrial-300">
          Your reference is{" "}
          <span className="font-mono font-semibold text-brand-400">{result.reference}</span>.
          Quote it if you phone us about this job.
        </p>
        <p className="mt-4 text-industrial-300">
          One of our team will read it and contact you directly — usually the same working day.
          Nothing is scheduled automatically.
        </p>
        <p className="mt-4 text-sm text-industrial-400">
          Urgent? Phone{" "}
          <a className="font-medium text-brand-400 underline" href={PHONE_HREF}>
            {FALLBACK_PHONE}
          </a>
          .
        </p>
        <button type="button" onClick={reset} className="mt-6 text-sm font-medium text-brand-400 underline">
          Send another enquiry
        </button>
      </div>
    );
  }

  if (result?.kind === "discarded") {
    // Honeypot was filled. Nothing was stored, and we say nothing about why.
    return (
      <div role="status" className="rounded-xl border border-industrial-700 bg-industrial-900 p-6 sm:p-8">
        <h3 className="text-xl font-semibold text-white">Thank you — we have your enquiry.</h3>
        <p className="mt-3 text-industrial-300">
          If you need an answer urgently, phone{" "}
          <a className="font-medium text-brand-400 underline" href={PHONE_HREF}>
            {FALLBACK_PHONE}
          </a>
          .
        </p>
      </div>
    );
  }

  // ---- Non-terminal problems: keep the fields, explain what happened ------

  const banner = (() => {
    if (!result) return null;

    if (result.kind === "undelivered") {
      // Never claim it was sent. We genuinely do not know.
      return {
        tone: "bad" as const,
        title: "We could not send that just now.",
        body: (
          <>
            Nothing has reached us yet, so please phone{" "}
            <a className="font-semibold underline" href={PHONE_HREF}>
              {FALLBACK_PHONE}
            </a>{" "}
            and we will take the details over the phone. You can also try again in a moment —
            retrying will not create a duplicate.
          </>
        ),
      };
    }

    if (result.kind === "rate-limited") {
      const wait = result.retryAfterSeconds;
      return {
        tone: "bad" as const,
        title: "That is a few enquiries in a short time.",
        body: (
          <>
            Please wait{" "}
            {wait ? `about ${Math.max(1, Math.ceil(wait / 60))} minute(s)` : "a few minutes"} and
            try again, or phone{" "}
            <a className="font-semibold underline" href={PHONE_HREF}>
              {FALLBACK_PHONE}
            </a>
            .
          </>
        ),
      };
    }

    if (result.kind === "challenge-failed") {
      return {
        tone: "bad" as const,
        title: "That check did not pass.",
        body: <>{result.message} Please try once more.</>,
      };
    }

    if (result.kind === "too-large") {
      return {
        tone: "bad" as const,
        title: "That message is too long to send.",
        body: <>Please shorten the description and try again.</>,
      };
    }

    if (result.kind === "invalid") {
      return {
        tone: "bad" as const,
        title: "Please check the details below.",
        body: unmappedErrors.length ? <>{unmappedErrors.join(" ")}</> : <>We have marked what needs fixing.</>,
      };
    }

    return null;
  })();

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="rounded-xl border border-industrial-700 bg-industrial-900 p-5 sm:p-8"
    >
      {banner && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-500/50 bg-red-950/40 p-4 text-sm text-red-200"
        >
          <p className="font-semibold text-red-100">{banner.title}</p>
          <p className="mt-1">{banner.body}</p>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <label className={LABEL} htmlFor="enq-name">
            Your name <span className="text-brand-400">*</span>
          </label>
          <input
            id="enq-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            value={draft.name}
            onChange={(e) => setField("name", e.target.value)}
            aria-invalid={show(errors.name) ? true : undefined}
            aria-describedby={show(errors.name) ? "enq-name-error" : undefined}
            className={`${FIELD} ${show(errors.name) ? FIELD_BAD : FIELD_OK}`}
          />
          {show(errors.name) && (
            <p id="enq-name-error" className={ERROR}>
              {errors.name}
            </p>
          )}
        </div>

        <div className="sm:col-span-1">
          <label className={LABEL} htmlFor="enq-phone">
            Phone number <span className="text-brand-400">*</span>
          </label>
          <input
            id="enq-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            placeholder="082 123 4567"
            value={draft.phone}
            onChange={(e) => setField("phone", e.target.value)}
            aria-invalid={show(errors.phone) ? true : undefined}
            aria-describedby={show(errors.phone) ? "enq-phone-error" : undefined}
            className={`${FIELD} ${show(errors.phone) ? FIELD_BAD : FIELD_OK}`}
          />
          {show(errors.phone) && (
            <p id="enq-phone-error" className={ERROR}>
              {errors.phone}
            </p>
          )}
        </div>

        <div className="sm:col-span-1">
          <label className={LABEL} htmlFor="enq-email">
            Email <span className="text-industrial-400">(optional)</span>
          </label>
          <input
            id="enq-email"
            name="email"
            type="email"
            autoComplete="email"
            value={draft.email}
            onChange={(e) => setField("email", e.target.value)}
            aria-invalid={show(errors.email) ? true : undefined}
            aria-describedby={show(errors.email) ? "enq-email-error" : undefined}
            className={`${FIELD} ${show(errors.email) ? FIELD_BAD : FIELD_OK}`}
          />
          {show(errors.email) && (
            <p id="enq-email-error" className={ERROR}>
              {errors.email}
            </p>
          )}
        </div>

        <div className="sm:col-span-1">
          <label className={LABEL} htmlFor="enq-area">
            Suburb or town <span className="text-brand-400">*</span>
          </label>
          <input
            id="enq-area"
            name="area"
            type="text"
            autoComplete="address-level2"
            required
            placeholder="Centurion"
            value={draft.area}
            onChange={(e) => setField("area", e.target.value)}
            aria-invalid={show(errors.area) ? true : undefined}
            aria-describedby={show(errors.area) ? "enq-area-error" : undefined}
            className={`${FIELD} ${show(errors.area) ? FIELD_BAD : FIELD_OK}`}
          />
          {show(errors.area) && (
            <p id="enq-area-error" className={ERROR}>
              {errors.area}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor="enq-service">
            What do you need? <span className="text-brand-400">*</span>
          </label>
          <select
            id="enq-service"
            name="serviceType"
            required
            value={draft.serviceType}
            onChange={(e) => setField("serviceType", e.target.value as typeof draft.serviceType)}
            aria-invalid={show(errors.serviceType) ? true : undefined}
            aria-describedby={show(errors.serviceType) ? "enq-service-error" : undefined}
            className={`${FIELD} ${show(errors.serviceType) ? FIELD_BAD : FIELD_OK}`}
          >
            <option value="">Choose one…</option>
            {Object.entries(SERVICE_TYPE_LABELS).map(([type, label]) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </select>
          {show(errors.serviceType) && (
            <p id="enq-service-error" className={ERROR}>
              {errors.serviceType}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor="enq-message">
            What is wrong, or what do you need done?{" "}
            <span className="text-brand-400">*</span>
          </label>
          <textarea
            id="enq-message"
            name="message"
            required
            rows={5}
            maxLength={MESSAGE_MAX}
            placeholder="The cold room at our shop is holding 8°C instead of 2°C since yesterday."
            value={draft.message}
            onChange={(e) => setField("message", e.target.value)}
            aria-invalid={show(errors.message) ? true : undefined}
            aria-describedby={`enq-message-count${show(errors.message) ? " enq-message-error" : ""}`}
            className={`${FIELD} ${show(errors.message) ? FIELD_BAD : FIELD_OK}`}
          />
          <div className="mt-1.5 flex items-start justify-between gap-4">
            {show(errors.message) ? (
              <p id="enq-message-error" className="text-sm text-red-400">
                {errors.message}
              </p>
            ) : (
              <span />
            )}
            <p id="enq-message-count" className="shrink-0 text-xs text-industrial-400">
              {messageLength} / {MESSAGE_MAX}
            </p>
          </div>
        </div>

        <fieldset className="sm:col-span-2">
          <legend className={LABEL}>
            How should we reply? <span className="text-industrial-400">(optional)</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PREFERRED_CONTACT_LABELS).map(([option, label]) => {
              const selected = draft.preferredContact === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    setField(
                      "preferredContact",
                      selected ? "" : (option as typeof draft.preferredContact),
                    )
                  }
                  className={
                    "rounded-lg border px-4 py-2 text-sm font-medium transition-colors " +
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 " +
                    "focus-visible:ring-offset-2 focus-visible:ring-offset-industrial-950 " +
                    (selected
                      ? "border-brand-500 bg-brand-500/15 text-brand-300"
                      : "border-industrial-700 text-industrial-300 hover:border-industrial-500")
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      {/*
        Honeypot. Off-screen rather than display:none — some bots skip hidden
        inputs but will happily fill one that is merely positioned away. Not
        reachable by keyboard (tabindex -1) and hidden from assistive tech.
      */}
      <div aria-hidden="true" className="pointer-events-none absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="enq-leaveblank">Leave this field blank</label>
        <input
          id="enq-leaveblank"
          name="leaveBlank"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={draft.leaveBlank}
          onChange={(e) => setField("leaveBlank", e.target.value)}
        />
      </div>

      <div className="mt-6 border-t border-industrial-800 pt-5">
        <div className="flex gap-3">
          <input
            id="enq-consent"
            name="consent"
            type="checkbox"
            required
            checked={draft.consent}
            onChange={(e) => setField("consent", e.target.checked)}
            aria-invalid={show(errors.consent) ? true : undefined}
            aria-describedby={show(errors.consent) ? "enq-consent-error" : undefined}
            className="mt-1 h-5 w-5 shrink-0 rounded border-industrial-600 bg-industrial-900 text-brand-500 focus-visible:ring-2 focus-visible:ring-brand-400"
          />
          <label htmlFor="enq-consent" className="text-sm text-industrial-300">
            I agree that Rams @Elec may use the details above to contact me about this enquiry.{" "}
            <span className="text-industrial-400">
              We keep them only for that purpose and do not share them. You can ask us to delete
              them at any time.
            </span>{" "}
            <span className="text-brand-400">*</span>
          </label>
        </div>
        {show(errors.consent) && (
          <p id="enq-consent-error" className={ERROR}>
            {errors.consent}
          </p>
        )}
      </div>

      {/*
        Turnstile renders only when a site key was present at build time. A
        site key is public by design; the secret stays on the server.
      */}
      {TURNSTILE_SITE_KEY && (
        <div className="mt-5">
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
          <div
            className="cf-turnstile"
            data-sitekey={TURNSTILE_SITE_KEY}
            data-theme="dark"
            data-callback="onRamsElecTurnstile"
            ref={(node) => {
              if (!node) return;
              // The widget calls a global by name, so bridge it into state.
              (window as unknown as Record<string, unknown>).onRamsElecTurnstile = (
                token: string,
              ) => setTurnstileToken(token);
            }}
          />
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className={
          "mt-6 w-full rounded-lg bg-brand-500 px-6 py-3.5 text-base font-semibold " +
          "text-industrial-950 transition-colors hover:bg-brand-400 focus:outline-none " +
          "focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 " +
          "focus-visible:ring-offset-industrial-950 disabled:cursor-not-allowed disabled:opacity-60 " +
          "sm:w-auto"
        }
      >
        {submitting ? "Sending…" : "Request a quote"}
      </button>

      <p className="mt-4 text-sm text-industrial-400">
        Rather talk to someone? Phone{" "}
        <a className="font-medium text-brand-400 underline" href={PHONE_HREF}>
          {FALLBACK_PHONE}
        </a>
        .
      </p>
    </form>
  );
}
