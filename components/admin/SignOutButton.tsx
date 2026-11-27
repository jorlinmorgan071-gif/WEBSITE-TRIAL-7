"use client";

/**
 * STEP 4A — sign out of the owner dashboard.
 * Signs out via Supabase Auth, then returns to the login page.
 */

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function SignOutButton() {
  const [busy, setBusy] = useState(false);

  const onSignOut = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await createSupabaseBrowserClient()?.auth.signOut();
    } finally {
      window.location.assign("/admin/login");
    }
  };

  return (
    <button
      type="button"
      onClick={onSignOut}
      disabled={busy}
      aria-busy={busy}
      className="inline-flex min-h-11 items-center justify-center rounded-full border border-cream/25 px-4 font-sans text-xs font-semibold text-muted transition-colors duration-300 ease-luxe hover:border-cream/50 hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
