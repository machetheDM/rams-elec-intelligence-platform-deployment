/**
 * Load-shedding alert subscription — pure data-fetching, no React, no markup.
 *
 * Calls the same-origin /api/alerts/subscribe route rather than the
 * loadshedding service directly, because that service is API-key gated and
 * the key is a server secret.
 */

export interface SubscribeResult {
  /** True only when an existing customer row was actually updated. */
  matched: boolean;
  status: string;
  areaZone: string | null;
}

interface SubscribeApiResponse {
  status?: string;
  matched?: boolean;
  area_zone?: string | null;
}

/**
 * Subscribe an existing customer (identified by SA phone number) to
 * load-shedding alerts for their area.
 *
 * `matched: false` means no customer with that number exists — the caller
 * must not report success. The service deliberately does not create customer
 * records from public input; see its docstring on POPIA.
 */
export async function subscribeToAlerts(
  phone: string,
  areaZone: string
): Promise<SubscribeResult> {
  const res = await fetch("/api/alerts/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, area_zone: areaZone }),
  });

  if (!res.ok && res.status !== 200) {
    // 422 means the phone or area failed the service's validators.
    if (res.status === 422) {
      throw new Error("Please check the phone number and area are valid.");
    }
    throw new Error(`Subscription failed (HTTP ${res.status})`);
  }

  const data: SubscribeApiResponse = await res.json();
  return {
    matched: data.matched ?? false,
    status: data.status ?? "unknown",
    areaZone: data.area_zone ?? null,
  };
}
