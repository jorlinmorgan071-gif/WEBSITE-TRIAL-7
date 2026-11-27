import "server-only";

/**
 * STEP 4A — server-side environment variables.
 * Server-only (the "server-only" import makes any accidental client import a
 * build error). Values are read from the environment (never hard-coded, never
 * committed — see .env.example for the names).
 */

export interface ServerEnv {
  /** Public Supabase URL (also inlined into the client bundle). */
  supabaseUrl: string | null;
  /** Public anon key (also inlined into the client bundle). */
  supabaseAnonKey: string | null;
  /** Service-role key — SERVER ONLY, never reaches the client bundle. */
  supabaseServiceKey: string | null;
  /** Direct Postgres connection (local dev/tests via postgres.js). */
  databaseUrl: string | null;
  /** Resend API key — SERVER ONLY. */
  resendApiKey: string | null;
  /** Resend API base URL (default https://api.resend.com; tests point it at a local mock). */
  resendBaseUrl: string;
  /** From address for notification emails. */
  resendFrom: string;
  /** Only true once a verified sending domain allows emailing customers. */
  resendSendToCustomers: boolean;
  /** Where owner order notifications go. */
  ownerEmail: string | null;
  /** Emails allowed to open /admin (comma-separated). */
  adminEmails: string[];
  /** Public site URL used in emails (Open Graph uses it too). */
  siteUrl: string;
}

export function getServerEnv(): ServerEnv {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? null,
    databaseUrl: process.env.DATABASE_URL ?? null,
    resendApiKey: process.env.RESEND_API_KEY ?? null,
    resendBaseUrl: process.env.RESEND_API_BASE_URL || "https://api.resend.com",
    resendFrom: process.env.RESEND_FROM || "Lake Flavour <onboarding@resend.dev>",
    resendSendToCustomers: /^(true|1)$/i.test(process.env.RESEND_SEND_TO_CUSTOMERS ?? ""),
    ownerEmail: process.env.OWNER_EMAIL?.trim() || null,
    adminEmails: parseAdminEmailsValue(process.env.ADMIN_EMAILS ?? ""),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  };
}

function parseAdminEmailsValue(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0 && s.includes("@"));
}
