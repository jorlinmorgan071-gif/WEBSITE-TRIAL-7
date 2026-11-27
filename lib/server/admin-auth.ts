import "server-only";

/**
 * STEP 4A — admin authentication and authorisation.
 *
 * Authentication: Supabase Auth magic link (the /admin/login page sends it).
 * Authorisation: ONLY emails listed in ADMIN_EMAILS may open /admin — enforced
 * here on the server for EVERY request (page renders and server actions both
 * call these functions; the UI alone never guards anything).
 */

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getServerEnv } from "./env";
import { isAdminEmail } from "@/lib/admin-emails";

export type AdminAuth =
  | { kind: "unconfigured" } // no Supabase env — nobody can sign in
  | { kind: "no-session"; email: null } // signed out
  | { kind: "forbidden"; email: string } // signed in, not in ADMIN_EMAILS
  | { kind: "admin"; email: string }; // signed in and allowed

/** Check the current request's session against ADMIN_EMAILS. */
export async function getAdminAuth(): Promise<AdminAuth> {
  const env = getServerEnv();
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return { kind: "unconfigured" };
  }

  let email: string | null = null;
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server components cannot set cookies — safe to ignore
            // (the page redirects to login instead).
          }
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    email = data.user?.email ?? null;
  } catch (error) {
    console.error("[admin] session check failed:", error instanceof Error ? error.message : error);
    return { kind: "no-session", email: null };
  }

  if (!email) return { kind: "no-session", email: null };
  if (!isAdminEmail(email, env.adminEmails)) return { kind: "forbidden", email };
  return { kind: "admin", email };
}

/**
 * Guard for server actions on /admin: returns the admin's email or null.
 * Anything but an authenticated admin gets null — callers redirect without
 * revealing anything.
 */
export async function getAdminUserEmail(): Promise<string | null> {
  const auth = await getAdminAuth();
  return auth.kind === "admin" ? auth.email : null;
}
