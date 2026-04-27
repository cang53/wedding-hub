/**
 * Wedding Hub — central app configuration.
 *
 * Edit WEDDING_DATE in place when the date is locked. The countdown in the
 * masthead, the dashboard "days until" calculation, and any future
 * date-relative logic all read from this constant.
 */

// ISO date string — interpreted as midnight in the local timezone.
export const WEDDING_DATE = "2026-09-12";

// Display defaults. Locale is set globally because Celal is in Belgium and
// fr-BE renders European number formatting (period as thousands separator).
export const LOCALE = "fr-BE";
export const CURRENCY = "EUR";

// Couple's display name — appears in the masthead.
export const COUPLE_DISPLAY = {
  one: "Celal",
  two: "our future", // placeholder until the prototype's "&" partner is updated
};
