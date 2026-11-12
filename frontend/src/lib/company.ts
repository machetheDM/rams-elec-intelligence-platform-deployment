/**
 * The company's own details — one source of truth.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * These were duplicated across ContactSection, Footer, EnquiryForm and the 404
 * page. A fabricated phone number ("+27 83 453 0607") reached three of those
 * before anyone noticed, because nothing tied them together and nothing said
 * where the real value came from. Every number here now carries its source.
 *
 * The brief for the public site is explicit that the contact details must match
 * what the company's invoices print. If any value below disagrees with an
 * invoice, the invoice wins — change it here and nowhere else.
 */

/**
 * Primary phone number, as shown on the live ramsatelec.com site and in this
 * repo's own ContactSection/Footer since before the redesign.
 */
export const PHONE_DISPLAY = "+27 71 101 8493";

/** Same number, dial-safe. Derived rather than retyped. */
export const PHONE_HREF = `tel:${PHONE_DISPLAY.replace(/[^+\d]/g, "")}`;

/**
 * Current, working email address.
 *
 * NOT info@ramsatelec.co.za: that mailbox receives nothing today, so publishing
 * it would send enquiries into a void. It replaces this only once the owner
 * says it is live.
 */
export const EMAIL = "ramsatelec@gmail.com";
export const EMAIL_HREF = `mailto:${EMAIL}`;

/** Where the company works, in its own words. */
export const AREAS = "Gauteng and Limpopo";

/** Base of operations, as published on the existing site. */
export const BASE = "Polokwane, Limpopo";

/** Office hours, as published on the existing site. */
export const HOURS = "Mon – Fri: 08:00 – 18:00";

/**
 * What the company does, in plain words, for the hero and meta description.
 * Deliberately concrete: the services a customer would search for, not a
 * positioning statement.
 */
export const WHAT_WE_DO =
  "Cold rooms, refrigeration, electrical installations and certificates of compliance, air conditioning, and emergency call-outs.";
