"use client";

/**
 * Headless state and validation for the public enquiry form.
 *
 * Zero markup, by the frontend convention in CLAUDE.md: the form can be
 * redesigned without touching any of the rules below, and the rules can be
 * corrected without touching the design.
 *
 * The validation here mirrors the contract in the Manager app repository
 * (`docs/integration/website.md`). It exists to save the visitor a round
 * trip, NOT to be the gate — the server validates independently and its 400
 * messages are shown verbatim beside the fields. Client-side validation that
 * is treated as authoritative is how a form ends up accepting something the
 * API will reject.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type EnquiryDraft,
  type EnquiryResult,
  type PreferredContact,
  type ServiceType,
  SERVICE_TYPES,
  newIdempotencyKey,
  submitEnquiry,
} from "@/lib/api/enquiries";

const EMPTY_DRAFT: EnquiryDraft = {
  name: "",
  phone: "",
  email: "",
  area: "",
  serviceType: "",
  message: "",
  preferredContact: "",
  consent: false,
  leaveBlank: "",
};

/** Field-level messages, keyed by the contract's field names. */
export type FieldErrors = Partial<Record<keyof EnquiryDraft, string>>;

export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 2000;

/** Digits only — the contract counts digits, not characters. */
function digitCount(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

/**
 * One plain address. Deliberately loose: the server is the authority, and an
 * over-strict client regex rejects valid addresses (long TLDs, plus-tags,
 * apostrophes) that the API would have accepted.
 */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateDraft(draft: EnquiryDraft): FieldErrors {
  const errors: FieldErrors = {};

  const name = draft.name.trim();
  if (name.length < 2) errors.name = "Please give us your name.";
  else if (name.length > 100) errors.name = "That name is too long for our system.";

  const digits = digitCount(draft.phone);
  if (digits === 0) errors.phone = "We need a number to call you on.";
  else if (digits < 9 || digits > 15)
    errors.phone = "That does not look like a complete phone number.";

  const email = draft.email.trim();
  if (email) {
    if (email.length > 254) errors.email = "That email address is too long.";
    else if (!looksLikeEmail(email)) errors.email = "Check that email address.";
  }

  const area = draft.area.trim();
  if (area.length < 2) errors.area = "Which suburb or town are you in?";
  else if (area.length > 100) errors.area = "That is too long — the suburb or town is enough.";

  if (!draft.serviceType) errors.serviceType = "Choose the kind of work you need.";
  else if (!SERVICE_TYPES.includes(draft.serviceType as ServiceType))
    errors.serviceType = "Choose the kind of work you need.";

  const message = draft.message.trim();
  if (message.length < MESSAGE_MIN)
    errors.message = `Tell us a little more — at least ${MESSAGE_MIN} characters.`;
  else if (message.length > MESSAGE_MAX)
    errors.message = `Please keep this under ${MESSAGE_MAX} characters.`;

  // The contract: preferredContact "email" needs email filled in.
  if (draft.preferredContact === "email" && !email)
    errors.email = "Add an email address, or choose another way for us to reply.";

  if (!draft.consent) errors.consent = "We need your permission before we can reply.";

  return errors;
}

export interface UseEnquiryForm {
  draft: EnquiryDraft;
  setField: <K extends keyof EnquiryDraft>(field: K, value: EnquiryDraft[K]) => void;
  /** Client-side messages, plus any the server returned, per field. */
  errors: FieldErrors;
  /** Errors the server reported against fields this form does not render. */
  unmappedErrors: string[];
  submitting: boolean;
  result: EnquiryResult | null;
  /** True once a submit has been attempted — gate error display on this. */
  submitted: boolean;
  submit: () => Promise<void>;
  /** Clear the outcome and start a fresh enquiry with a fresh key. */
  reset: () => void;
  setTurnstileToken: (token: string) => void;
  messageLength: number;
}

export function useEnquiryForm(): UseEnquiryForm {
  const [draft, setDraft] = useState<EnquiryDraft>(EMPTY_DRAFT);
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<EnquiryResult | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");

  /**
   * One key per opened form, reused on every retry — that is what makes a
   * double-tap or a retry after a timeout safe. Generated in an effect
   * rather than in useState's initialiser because crypto.randomUUID() is not
   * available during server rendering, and calling it there would make the
   * first client render disagree with the HTML and break hydration.
   */
  const idempotencyKey = useRef<string>("");
  useEffect(() => {
    if (!idempotencyKey.current) idempotencyKey.current = newIdempotencyKey();
  }, []);

  const setField = useCallback(
    <K extends keyof EnquiryDraft>(field: K, value: EnquiryDraft[K]) => {
      setDraft((prev) => ({ ...prev, [field]: value }));
      // A field the visitor is actively correcting should stop showing the
      // server's complaint about its previous value.
      setServerErrors((prev) => {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field as string];
        return next;
      });
    },
    [],
  );

  const clientErrors = useMemo(() => validateDraft(draft), [draft]);

  const errors = useMemo<FieldErrors>(() => {
    const merged: FieldErrors = { ...clientErrors };
    // The server is the authority, so its message wins where both complain.
    for (const [field, messages] of Object.entries(serverErrors)) {
      if (field in EMPTY_DRAFT && messages.length) {
        merged[field as keyof EnquiryDraft] = messages[0];
      }
    }
    return merged;
  }, [clientErrors, serverErrors]);

  const unmappedErrors = useMemo(() => {
    const out: string[] = [];
    for (const [field, messages] of Object.entries(serverErrors)) {
      if (!(field in EMPTY_DRAFT)) out.push(...messages);
    }
    return out;
  }, [serverErrors]);

  const reset = useCallback(() => {
    setDraft(EMPTY_DRAFT);
    setServerErrors({});
    setResult(null);
    setSubmitted(false);
    setTurnstileToken("");
    // A new enquiry must not be deduplicated against the previous one.
    idempotencyKey.current = newIdempotencyKey();
  }, []);

  const submit = useCallback(async () => {
    setSubmitted(true);
    setServerErrors({});

    // A bot that filled the honeypot still gets submitted, deliberately: the
    // server answers 201 with a null reference and stores nothing. Blocking
    // it here instead would tell the bot which field gave it away.
    if (!draft.leaveBlank.trim() && Object.keys(validateDraft(draft)).length > 0) {
      setResult(null);
      return;
    }

    if (!idempotencyKey.current) idempotencyKey.current = newIdempotencyKey();

    setSubmitting(true);
    const outcome = await submitEnquiry(draft, idempotencyKey.current, turnstileToken);
    setSubmitting(false);
    setResult(outcome);

    if (outcome.kind === "invalid") {
      setServerErrors(outcome.errors);
      return;
    }

    if (outcome.kind === "sent" || outcome.kind === "discarded") {
      // POPIA: the site keeps no copy of the visitor's details once it has an
      // answer. Their details live in the Manager app from here on.
      setDraft(EMPTY_DRAFT);
      setTurnstileToken("");
    }
  }, [draft, turnstileToken]);

  return {
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
    messageLength: draft.message.trim().length,
  };
}

export const PREFERRED_CONTACT_LABELS: Record<PreferredContact, string> = {
  phone: "Phone call",
  whatsapp: "WhatsApp",
  email: "Email",
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  refrigeration: "Refrigeration",
  cold_room: "Cold room",
  electrical: "Electrical installation or CoC",
  hvac: "HVAC / air conditioning",
  emergency: "Emergency call-out",
  other: "Something else",
};
