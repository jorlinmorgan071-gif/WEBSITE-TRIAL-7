"use client";

/**
 * STEP 4A — owner sign-in with a Supabase magic link (email OTP).
 * Uses only the public anon key. Access is still decided on the SERVER:
 * even after signing in, only emails in ADMIN_EMAILS can open /admin/orders.
 */

import { useState } from "react";
import Link from "next/link";
import { BUSINESS } from "@/lib/business";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setError("Online sign-in is not configured on this deployment.");
        return;
      }
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/admin/orders`,
        },
      });
      if (authError) {
        setError(
          authError.status === 429
            ? "Too many sign-in attempts. Please wait a few minutes and try again."
            : "We could not send the sign-in email. Please check the address and try again."
        );
        return;
      }
      setSent(true);
    } catch {
      setError("Network problem — please check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="relative flex min-h-dvh w-full flex-col items-center justify-center bg-background px-4 py-16 sm:px-6">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-2xl border border-gold/20 bg-surface/50 p-6 sm:p-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
            {BUSINESS.name}
          </p>
          <h1 className="font-serif text-3xl font-semibold text-cream">
            Owner sign-in
          </h1>
          <div className="gold-rule w-32" aria-hidden />
          <p className="font-sans text-sm leading-relaxed text-muted">
            We send a sign-in link to your email. Only the business
            owner&apos;s email can open the orders page.
          </p>
        </div>

        {sent ? (
          <div role="status" className="flex flex-col items-center gap-4 text-center">
            <p className="font-sans text-sm leading-relaxed text-cream/85">
              Check your email — we sent a sign-in link to{" "}
              <strong className="text-gold-light">{email}</strong>. Open it on
              this device to continue.
            </p>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-gold/50 px-6 font-sans text-sm font-semibold text-gold transition-colors duration-300 ease-luxe hover:border-gold hover:bg-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="owner@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "email-error" : undefined}
                className="min-h-11 w-full rounded-xl border border-cream/15 bg-background/60 px-4 py-2.5 font-sans text-sm text-cream placeholder:text-muted focus:border-gold/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
              />
              {error && (
                <p id="email-error" role="alert" className="font-sans text-xs text-gold-light">
                  {error}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={sending}
              aria-busy={sending}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-gold px-7 font-sans text-sm font-semibold text-background transition-all duration-300 ease-luxe hover:bg-gold-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? "Sending…" : "Send my sign-in link"}
            </button>
          </form>
        )}

        <p className="text-center">
          <Link
            href="/"
            className="font-sans text-xs text-muted underline decoration-cream/20 underline-offset-4 transition-colors duration-300 ease-luxe hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
          >
            Back to the shop
          </Link>
        </p>
      </div>
    </main>
  );
}
