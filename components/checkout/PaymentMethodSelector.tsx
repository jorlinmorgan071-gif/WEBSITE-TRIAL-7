"use client";

/**
 * STEP 4A — payment method radios for checkout.
 * A proper radiogroup (same pattern as the size selector). Options come from
 * lib/payment.ts: when "Pay now with M-Pesa" is enabled there (Step 4D), it
 * appears as a normal choice without any other code change.
 */

import { PAYMENT_METHODS, type PaymentMethodId } from "@/lib/payment";

export default function PaymentMethodSelector({
  selectedId,
  onSelect,
  error,
}: {
  selectedId: PaymentMethodId;
  onSelect: (id: PaymentMethodId) => void;
  error?: string;
}) {
  const id = "payment";
  const errorId = `${id}-error`;
  const available = PAYMENT_METHODS.filter((m) => m.available);
  const unavailable = PAYMENT_METHODS.filter((m) => !m.available);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown")
      next = (available.findIndex((m) => m.id === selectedId) + 1) % available.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      next =
        (available.findIndex((m) => m.id === selectedId) - 1 + available.length) %
        available.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = available.length - 1;
    if (next === null || available.length === 0) return;
    e.preventDefault();
    onSelect(available[next].id);
    const group = e.currentTarget;
    requestAnimationFrame(() => {
      group
        .querySelector<HTMLButtonElement>(
          '[role="radio"][aria-checked="true"]'
        )
        ?.focus();
    });
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div
        role="radiogroup"
        aria-label="Payment method"
        onKeyDown={onKeyDown}
        className="flex flex-col gap-2.5"
      >
        {available.map((m) => {
          const checked = m.id === selectedId;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-describedby={error ? errorId : undefined}
              tabIndex={checked ? 0 : -1}
              onClick={() => onSelect(m.id)}
              className={`flex min-h-11 items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-colors duration-300 ease-luxe focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light ${
                checked
                  ? "border-gold/60 bg-gold/15 text-gold-light"
                  : "border-cream/15 bg-surface/60 text-cream/80 hover:border-gold/40 hover:text-cream"
              }`}
            >
              <span
                aria-hidden
                className={`flex h-4.5 w-4.5 items-center justify-center rounded-full border ${
                  checked ? "border-gold-light" : "border-cream/40"
                }`}
                style={{ height: 18, width: 18 }}
              >
                {checked && (
                  <span className="block h-2 w-2 rounded-full bg-gold-light" />
                )}
              </span>
              <span className="flex flex-col">
                <span className="font-sans text-sm font-semibold">{m.label}</span>
                <span className="mt-0.5 font-sans text-xs text-muted">
                  {m.description}
                </span>
              </span>
            </button>
          );
        })}

        {/* Future options show as "coming soon" — not focusable, not
            selectable. No opacity wrapper: it would drop the text contrast
            below the accessible ratio (Lighthouse color-contrast). */}
        {unavailable.map((m) => (
          <div
            key={m.id}
            aria-hidden
            className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-xl border border-cream/10 px-4 py-2.5"
          >
            <span
              aria-hidden
              className="flex items-center justify-center rounded-full border border-cream/25"
              style={{ height: 18, width: 18 }}
            />
            <span className="flex flex-col">
              <span className="font-sans text-sm font-semibold text-cream/70">
                {m.label}
              </span>
              <span className="mt-0.5 font-sans text-xs text-muted">
                {m.description}
              </span>
            </span>
          </div>
        ))}
      </div>
      {error && (
        <p id={errorId} className="font-sans text-xs text-gold-light">
          {error}
        </p>
      )}
    </div>
  );
}
