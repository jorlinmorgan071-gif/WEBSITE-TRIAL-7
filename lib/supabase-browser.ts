import { createBrowserClient } from "@supabase/ssr";

/**
 * STEP 4A — Supabase browser client (admin sign-in only).
 * Uses ONLY the public URL + anon key (both are public by design). Returns
 * null when the deployment has no Supabase project configured so the login
 * page can explain that instead of failing.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createBrowserClient(url, anonKey);
}
