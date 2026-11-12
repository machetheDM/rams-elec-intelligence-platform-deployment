/**
 * Website enquiry API client — pure data-fetching, no React and no markup.
 *
 * Implements v1 of the contract owned by the Manager app repository
 * (`docs/integration/website.md`, 4 November 2026). That document is the
 * authority; this file is the website's half of it.
 *
 * WHY THIS POSTS STRAIGHT FROM THE BROWSER, WITH NO KEY
 * -----------------------------------------------------
 * The public site is a static export served from the Manager app's server.
 * There is no route handler to proxy through and no server process to hold a
 * secret, so anything this file held would be readable by anyone who opened
 * the bundle. The endpoint is public by design and defended by rate limits,
 * a honeypot and (when switched on) Cloudflare Turnstile — not by a key.
 *
 * This is the opposite of `triage.ts`, which deliberately goes through a
 * same-origin Next route because the triage service DOES require an
 * X-API-Key. The public build must not call the triage service at all.
 *
 * EXACT FIELD NAMES
 * -----------------
 * The API rejects the whole request with 400 if it carries a field the
 * contract does not list. So the payload is assembled explicitly below,
 * field by field, and optional values are omitted rather than sent as empty
 * strings or null. Do not spread form state into the body.
 *
 * Adding a field is a contract change: the API gets it and is deployed
 * first, then the site starts sending it.
 */

// ---------------------------------------------------------------------------
// Configuration — one value, so wiring environments is a single change
// ---------------------------------------------------------------------------

/**
 * Where enquiries are posted.
 *
 * Inlined at build time (NEXT_PUBLIC_*), which is what a static export needs.
 * The production default answers 404 until the owner sets
 * WEBSITE_ENQUIRIES_ENABLED=true on the server — a 404 is handled as "not
 * sent", never as success.
 *
 * For local work against the Manager app's dev stack:
 *   NEXT_PUBLIC_ENQUIRY_URL=http://localhost:5000/api/website/enquiries
 */
export const ENQUIRY_URL =
  process.env.NEXT_PUBLIC_ENQUIRY_URL ??
  "https://api.ramsatelec.co.za/api/website/enquiries";

/**
 * Cloudflare Turnstile site key. A site key is public by design; the secret
 * lives on the server. Unset means Turnstile is off, and the widget is not
 * rendered or loaded at all.
 */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/**
 * Which wording of the consent line the visitor was shown.
 *
 * Bump this whenever the consent text in the form changes — it is the only
 * record of what was actually agreed to, and POPIA consent is specific to
 * the wording. Changing the text without changing this makes the stored
 * audit trail wrong.
 */
export const CONSENT_VERSION = "2026-11-04";

/** The phone number shown whenever an enquiry could not be delivered. */
export const FALLBACK_PHONE = "+27 83 453 0607";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Exactly the values the API accepts. Anything else is a 400. */
export const SERVICE_TYPES = [
  "refrigeration",
  "cold_room",
  "electrical",
  "hvac",
  "emergency",
  "other",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export const PREFERRED_CONTACTS = ["phone", "whatsapp", "email"] as const;

export type PreferredContact = (typeof PREFERRED_CONTACTS)[number];

/** What the visitor fills in. Not the wire format — see EnquiryPayload. */
export interface EnquiryDraft {
  name: string;
  phone: string;
  email: string;
  area: string;
  serviceType: ServiceType | "";
  message: string;
  preferredContact: PreferredContact | "";
  consent: boolean;
  /** The honeypot. Must stay empty; a value means a bot filled it. */
  leaveBlank: string;
}

/** The wire format, exactly as the contract's table defines it. */
interface EnquiryPayload {
  idempotencyKey: string;
  name: string;
  phone: string;
  area: string;
  serviceType: ServiceType;
  message: string;
  consent: true;
  email?: string;
  preferredContact?: PreferredContact;
  consentVersion?: string;
  page?: string;
  turnstileToken?: string;
  leaveBlank?: string;
}

/**
 * The outcome of a submission, as a closed set.
 *
 * Deliberately not "ok: boolean". The contract has three distinct
 * non-success shapes that need different words in front of the visitor
 * (field errors, try again, phone instead), and collapsing them loses the
 * one that matters most: "we do not know whether this arrived, so do not
 * tell them it did".
 */
export type EnquiryResult =
  /** 201, or 200 for a retry of the same idempotencyKey. */
  | { kind: "sent"; reference: string; receivedAt: string | null }
  /** 201 with reference null — the honeypot was filled. Nothing was stored. */
  | { kind: "discarded" }
  /** 400 — per-field messages, already plain English, safe to show as-is. */
  | { kind: "invalid"; errors: Record<string, string[]> }
  /** 403 — the Turnstile check failed. */
  | { kind: "challenge-failed"; message: string }
  /** 429 — rate limited. seconds is from Retry-After when present. */
  | { kind: "rate-limited"; retryAfterSeconds: number | null }
  /** 413 — body over 16 KB. */
  | { kind: "too-large" }
  /**
   * 404, 5xx, a network failure, or a body we could not read. The enquiry
   * may or may not have arrived; the only honest message is the phone
   * number. NEVER render this as success.
   */
  | { kind: "undelivered"; reason: "disabled" | "server" | "network" };

// ---------------------------------------------------------------------------
// Idempotency key
// ---------------------------------------------------------------------------

/**
 * A key the API accepts: 16-64 characters of letters, digits and hyphens.
 *
 * crypto.randomUUID() gives 36 such characters, but it only exists in a
 * secure context (https, or localhost). The fallback keeps the form usable
 * if the site is ever opened over plain http on a LAN address during
 * testing — a weaker key is still fine here, because this value only has to
 * be unique per submission, not unguessable.
 */
export function newIdempotencyKey(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  if (c && typeof c.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------

/** The path the form was on — a path only, never a query string (contract). */
function currentPagePath(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const path = window.location.pathname;
  return path ? path.slice(0, 200) : undefined;
}

function buildPayload(
  draft: EnquiryDraft,
  idempotencyKey: string,
  turnstileToken: string,
): EnquiryPayload {
  // Assembled field by field on purpose — see the header note about 400 on
  // unknown fields. Optional values are omitted, not sent empty.
  const payload: EnquiryPayload = {
    idempotencyKey,
    name: draft.name.trim(),
    phone: draft.phone.trim(),
    area: draft.area.trim(),
    serviceType: draft.serviceType as ServiceType,
    message: draft.message.trim(),
    consent: true,
    consentVersion: CONSENT_VERSION,
  };

  const email = draft.email.trim();
  if (email) payload.email = email;

  if (draft.preferredContact) payload.preferredContact = draft.preferredContact;

  const page = currentPagePath();
  if (page) payload.page = page;

  if (TURNSTILE_SITE_KEY && turnstileToken) payload.turnstileToken = turnstileToken;

  // Sent only when non-empty. An absent honeypot is as valid as an empty one,
  // and sending "" on every request puts a useless field on the wire.
  const honeypot = draft.leaveBlank.trim();
  if (honeypot) payload.leaveBlank = honeypot;

  return payload;
}

/** Narrow unknown JSON into the 400 body's shape without trusting it. */
function readFieldErrors(body: unknown): Record<string, string[]> {
  if (!body || typeof body !== "object") return {};
  const errors = (body as { errors?: unknown }).errors;
  if (!errors || typeof errors !== "object") return {};

  // Collected as pairs and assembled with Object.fromEntries rather than
  // written key-by-key: the keys come from a network response, and a
  // computed write would let one named "__proto__" reach the prototype.
  const pairs: Array<[string, string[]]> = [];
  for (const [field, messages] of Object.entries(errors as Record<string, unknown>)) {
    if (field === "__proto__" || field === "constructor" || field === "prototype") continue;
    if (Array.isArray(messages)) {
      const strings = messages.filter((m): m is string => typeof m === "string");
      if (strings.length) pairs.push([field, strings]);
    } else if (typeof messages === "string") {
      pairs.push([field, [messages]]);
    }
  }
  return Object.fromEntries(pairs);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Post one enquiry and map the answer onto EnquiryResult.
 *
 * Never throws: every failure, including a dropped connection, comes back as
 * a result the UI can render. A thrown error here would surface as an
 * unhandled rejection and most likely as a blank form, which is the one
 * outcome that loses the visitor's enquiry silently.
 *
 * Pass the SAME idempotencyKey when retrying, so a double-tap or a retry
 * after a timeout cannot create two enquiries. The API answers the second
 * one with 200 and the original reference.
 */
export async function submitEnquiry(
  draft: EnquiryDraft,
  idempotencyKey: string,
  turnstileToken = "",
): Promise<EnquiryResult> {
  let response: Response;
  try {
    response = await fetch(ENQUIRY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // No credentials: the endpoint takes no cookies and wants none.
      body: JSON.stringify(buildPayload(draft, idempotencyKey, turnstileToken)),
    });
  } catch {
    // DNS failure, offline, CORS rejection, tunnel down. We cannot know
    // whether the request arrived.
    return { kind: "undelivered", reason: "network" };
  }

  if (response.status === 200 || response.status === 201) {
    const body = await readJson(response);
    const reference =
      body && typeof body === "object"
        ? (body as { reference?: unknown }).reference
        : undefined;

    // A null reference is the honeypot answer: accepted, stored nowhere.
    if (reference === null) return { kind: "discarded" };

    if (typeof reference === "string" && reference) {
      const receivedAt =
        body && typeof body === "object"
          ? (body as { receivedAt?: unknown }).receivedAt
          : null;
      return {
        kind: "sent",
        reference,
        receivedAt: typeof receivedAt === "string" ? receivedAt : null,
      };
    }

    // 2xx with a shape we do not recognise. It probably did arrive, but we
    // have no reference to show, and claiming success without one would be
    // a promise we cannot evidence.
    return { kind: "undelivered", reason: "server" };
  }

  if (response.status === 400) {
    return { kind: "invalid", errors: readFieldErrors(await readJson(response)) };
  }

  if (response.status === 403) {
    const body = await readJson(response);
    const message =
      body && typeof body === "object" && typeof (body as { message?: unknown }).message === "string"
        ? ((body as { message: string }).message)
        : "That check did not pass. Please try again.";
    return { kind: "challenge-failed", message };
  }

  if (response.status === 413) return { kind: "too-large" };

  if (response.status === 429) {
    const header = response.headers.get("Retry-After");
    const seconds = header ? Number.parseInt(header, 10) : Number.NaN;
    return {
      kind: "rate-limited",
      retryAfterSeconds: Number.isFinite(seconds) && seconds > 0 ? seconds : null,
    };
  }

  // 404 means enquiries are switched off on the server — the state until the
  // owner turns them on. Everything else here is a server fault.
  return {
    kind: "undelivered",
    reason: response.status === 404 ? "disabled" : "server",
  };
}
