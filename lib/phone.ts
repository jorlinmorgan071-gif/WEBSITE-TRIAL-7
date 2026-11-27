/**
 * STEP 4A — Kenyan phone normalisation (shared by client and server).
 * Pure functions only, so the same code validates in the browser, in the
 * API route and in plain-Node unit tests.
 */

/**
 * Normalise a Kenyan mobile number to the 254XXXXXXXXX form.
 * Accepts: 0712 345 678, 01XX XXX XXX, +254712345678, 254712345678
 * (spaces, dashes and parentheses are ignored).
 * Returns null for anything that is not a Kenyan mobile number.
 */
export function normaliseKenyanPhone(raw: string): string | null {
  // Strip visual separators only — everything else must be part of the number.
  const v = raw.replace(/[\s\-()]/g, "");

  if (/^0[17][0-9]{8}$/.test(v)) return "254" + v.slice(1); // 07XX… / 01XX…
  if (/^254[17][0-9]{8}$/.test(v)) return v; // 2547XXXXXXXX
  if (/^\+254[17][0-9]{8}$/.test(v)) return v.slice(1); // +2547XXXXXXXX
  return null;
}

/** True when the value is already in normalised 254XXXXXXXXX form. */
export function isNormalisedPhone(value: string): boolean {
  return /^254[17][0-9]{8}$/.test(value);
}

/** 254712345678 -> "0712 345 678" (for the owner dashboard). */
export function displayLocalPhone(normalised: string): string {
  if (!isNormalisedPhone(normalised)) return normalised;
  const local = "0" + normalised.slice(3);
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}
