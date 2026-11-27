/**
 * STEP 4A — owner admin access list (shared by server code and unit tests).
 * Pure parsing/matching only — no imports, so plain Node can test it too.
 */

/** Parse the ADMIN_EMAILS env value ("a@x.com, B@Y.com") into a set. */
export function parseAdminEmails(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0 && s.includes("@"));
}

/** True when the signed-in email may open /admin. Case-insensitive. */
export function isAdminEmail(email: string | null, admins: string[]): boolean {
  if (!email) return false;
  return admins.includes(email.trim().toLowerCase());
}
