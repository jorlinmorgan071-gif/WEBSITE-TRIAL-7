"use client";

/**
 * STEP 4A — online checkout (replaces the old #order placeholder).
 *
 * Left card: the order panel (size, quantity 1–10, line total, subtotal and
 * the delivery-fee promise). Right card: customer details, payment method
 * (pay on delivery), Privacy Notice consent and the honeypot. Submitting
 * posts to /api/orders — the SERVER re-validates everything and re-reads the
 * prices, so this component never trusts its own arithmetic for money.
 *
 * Idempotency: the key is derived from the current form contents, so a retry
 * (double click, flaky network) reuses the same key and can never create two
 * orders, while a genuinely changed form gets a fresh key.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { BUSINESS } from "@/lib/business";
import type { Product } from "@/lib/products";
import { formatPrice, telHref, whatsappUrl } from "@/lib/order";
import {
  successWhatsappMessage,
  totalLine,
  type ClientOrder,
} from "@/lib/client-order";
import { DELIVERY_AREAS, deliveryFeeText } from "@/lib/delivery";
import { paymentMethodLabel, type PaymentMethodId } from "@/lib/payment";
import { EASE_LUXE } from "@/lib/design-tokens";
import SizeSelector from "@/components/SizeSelector";
import QuantityStepper from "@/components/checkout/QuantityStepper";
import AreaCombobox from "@/components/checkout/AreaCombobox";
import PaymentMethodSelector from "@/components/checkout/PaymentMethodSelector";

const CHECKOUT_EYEBROW = "Order Online";
const CHECKOUT_HEADING = "Place Your Order";
const CHECKOUT_SUBHEADING =
  "Fresh fried omena, delivered within Nairobi. We confirm every delivery on WhatsApp or phone.";

/** Random idempotency key (crypto.randomUUID with a fallback for older browsers). */
function newRequestKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `lf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export default function CheckoutSection({ products }: { products: Product[] }) {
  const product = products[0];
  const [optionId, setOptionId] = useState(product?.defaultOptionId ?? "");
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [area, setArea] = useState("");
  const [addressDetails, setAddressDetails] = useState("");
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>("pay_on_delivery");
  const [honeypot, setHoneypot] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [order, setOrder] = useState<ClientOrder | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  /* One key per form contents: retries reuse it (no duplicate orders),
   * a changed form gets a new one. */
  const idempotencyKey = useMemo(
    () => newRequestKey(),
    [optionId, quantity, name, phone, email, area, addressDetails, notes, consent, paymentMethod]
  );

  const selected =
    product?.options.find((o) => o.id === optionId) ?? product?.options[0];
  const lineTotal = (selected?.priceKes ?? 0) * quantity;

  // Reduced-motion is applied after mount (same pattern as the products section).
  const prefersReduced = useReducedMotion();
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => setReducedMotion(!!prefersReduced), [prefersReduced]);

  // Move focus to the error summary after a failed submit.
  useEffect(() => {
    if (apiError) alertRef.current?.focus();
  }, [apiError]);

  /** Error text for a form field (server field errors + item errors). */
  const errorFor = (field: string): string | undefined => {
    if (errors[field]) return errors[field];
    if (field === "quantity") {
      const key = Object.keys(errors).find(
        (k) => k === "quantity" || k.startsWith("items")
      );
      return key ? errors[key] : undefined;
    }
    return undefined;
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return; // never double submit
    setSubmitting(true);
    setErrors({});
    setApiError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email,
          area,
          addressDetails,
          notes,
          consent,
          paymentMethod,
          items: [{ optionId: selected?.id ?? "", quantity }],
          idempotencyKey,
          companyWebsite: honeypot,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setOrder(data.order as ClientOrder);
        return;
      }
      setErrors(data?.errors ?? {});
      setApiError(
        data?.message ??
          "We could not place your order. Please check the form and try again."
      );
    } catch {
      setApiError(
        "We could not reach the shop right now. Please check your connection and try again, or order on WhatsApp."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onReset = () => {
    setOrder(null);
    setQuantity(1);
    setConsent(false);
    setNotes("");
  };

  const selectedArea =
    DELIVERY_AREAS.find((a) => a.name === area.trim()) ?? null;

  return (
    <section
      id="order"
      aria-label={CHECKOUT_HEADING}
      className="relative isolate flex w-full flex-col items-center bg-background px-4 py-24 sm:px-6"
    >
      {/* ---------- heading ---------- */}
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
          {CHECKOUT_EYEBROW}
        </p>
        <h2 className="max-w-2xl font-serif text-3xl font-semibold text-cream sm:text-4xl md:text-5xl">
          {CHECKOUT_HEADING}
        </h2>
        <div className="gold-rule w-40" aria-hidden />
        <p className="max-w-xl font-sans text-sm leading-relaxed text-muted sm:text-base">
          {CHECKOUT_SUBHEADING}
        </p>
      </div>

      {order ? (
        <SuccessPanel order={order} onReset={onReset} reducedMotion={reducedMotion} />
      ) : product && selected ? (
        <form
          onSubmit={onSubmit}
          noValidate
          className="mx-auto mt-10 grid w-full max-w-5xl gap-6 lg:grid-cols-2"
        >
          {/* ================= order panel ================= */}
          <div className="flex flex-col gap-5 rounded-2xl border border-gold/20 bg-surface/50 p-6 sm:p-8">
            <div>
              <h3 className="font-serif text-2xl font-semibold text-cream">
                {product.name}
              </h3>
              <p className="mt-1 font-sans text-xs font-medium uppercase tracking-[0.2em] text-gold-light">
                {product.tagline}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Choose a size
              </span>
              <SizeSelector
                options={product.options}
                selectedId={selected.id}
                currency={BUSINESS.currency}
                onSelect={setOptionId}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                How many bags?
              </span>
              <QuantityStepper value={quantity} onChange={setQuantity} error={errorFor("quantity")} />
            </div>

            <div className="gold-rule w-full" aria-hidden />

            <div aria-live="polite" className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between font-sans text-sm text-cream/85">
                <span>
                  {selected.label} × {quantity}
                </span>
                <span>{formatPrice(lineTotal, BUSINESS.currency)}</span>
              </div>
              <div className="flex items-baseline justify-between font-sans text-sm font-semibold text-cream">
                <span>Subtotal</span>
                <span>{formatPrice(lineTotal, BUSINESS.currency)}</span>
              </div>
              <p className="font-sans text-xs text-muted">
                {deliveryFeeText(selectedArea)}
              </p>
            </div>
          </div>

          {/* ================= customer details ================= */}
          <div className="flex flex-col gap-5 rounded-2xl border border-cream/10 bg-surface/30 p-6 sm:p-8">
            {apiError && (
              <div
                ref={alertRef}
                role="alert"
                tabIndex={-1}
                className="rounded-xl border border-gold-light/50 bg-gold/10 px-4 py-3 font-sans text-sm text-gold-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
              >
                {apiError}
              </div>
            )}

            <TextField
              id="name"
              label="Full name"
              error={errorFor("name")}
              placeholder="e.g. Jane Wanjiku"
              autoComplete="name"
              value={name}
              onChange={setName}
            />

            <TextField
              id="phone"
              label="Phone number"
              error={errorFor("phone")}
              hint="We call or WhatsApp you to confirm delivery."
              placeholder="0712 345 678"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={setPhone}
            />

            <TextField
              id="email"
              label="Email address"
              error={errorFor("email")}
              hint="For your order confirmation."
              placeholder="you@example.com"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
            />

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="area"
                className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted"
              >
                Nairobi area / estate
              </label>
              <AreaCombobox
                id="area"
                value={area}
                onChange={setArea}
                error={errorFor("area")}
                hintId="area-hint"
              />
              <p id="area-hint" className="font-sans text-xs text-muted">
                Pick your area — choose “Other” if it is not listed.
              </p>
            </div>

            <TextArea
              id="addressDetails"
              label="Building / house & landmark"
              error={errorFor("addressDetails")}
              placeholder="e.g. House 4B, blue gate opposite the primary school"
              rows={2}
              value={addressDetails}
              onChange={setAddressDetails}
            />

            <TextArea
              id="notes"
              label="Notes for your order (optional)"
              hint="Prepared to your taste — e.g. extra spicy, less salt."
              placeholder="e.g. extra spicy"
              rows={2}
              value={notes}
              onChange={setNotes}
            />

            <div className="flex flex-col gap-2">
              <span className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Payment
              </span>
              <PaymentMethodSelector
                selectedId={paymentMethod}
                onSelect={setPaymentMethod}
                error={errorFor("paymentMethod")}
              />
            </div>

            {/* consent */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="consent"
                className="flex min-h-11 cursor-pointer items-start gap-3 py-2"
              >
                <input
                  id="consent"
                  name="consent"
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  aria-invalid={errorFor("consent") ? true : undefined}
                  aria-describedby={errorFor("consent") ? "consent-error" : undefined}
                  className="mt-1 h-5 w-5 shrink-0 accent-[#C9A24B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
                />
                <span className="font-sans text-sm leading-relaxed text-cream/85">
                  I agree to the{" "}
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-gold-light underline decoration-gold/40 underline-offset-4 transition-colors duration-300 ease-luxe hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
                  >
                    Privacy Notice
                  </a>
                  {" "}— we use your details only to process and deliver your order.
                </span>
              </label>
              {errorFor("consent") && (
                <p id="consent-error" className="font-sans text-xs text-gold-light">
                  {errorFor("consent")}
                </p>
              )}
            </div>

            {/* Honeypot — invisible to people, tempting to bots. */}
            <div
              aria-hidden
              className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden"
            >
              <label htmlFor="companyWebsite">Company website</label>
              <input
                id="companyWebsite"
                name="companyWebsite"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-full bg-gold px-7 font-sans text-sm font-semibold text-background transition-all duration-300 ease-luxe hover:bg-gold-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Placing your order…" : "Place my order"}
            </button>

            <p className="text-center font-sans text-xs text-muted">
              Prefer to talk? Call or text{" "}
              <a
                href={telHref(BUSINESS)}
                className="font-medium text-gold-light underline decoration-gold/40 underline-offset-4 transition-colors duration-300 ease-luxe hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
              >
                {BUSINESS.displayPhone}
              </a>
            </p>
          </div>
        </form>
      ) : (
        <div className="mx-auto mt-10 max-w-md rounded-2xl border border-cream/10 bg-surface/40 p-8 text-center">
          <p className="font-sans text-sm leading-relaxed text-muted">
            Our online menu is being updated right now. Please order on
            WhatsApp — the button above opens a chat with your order message
            ready to send.
          </p>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Success screen                                                      */
/* ------------------------------------------------------------------ */

function SuccessPanel({
  order,
  onReset,
  reducedMotion,
}: {
  order: ClientOrder;
  onReset: () => void;
  reducedMotion: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const waHref = whatsappUrl(BUSINESS, successWhatsappMessage(BUSINESS, order));

  return (
    <motion.div
      initial={{ opacity: 0, y: reducedMotion ? 0 : 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.5, ease: EASE_LUXE }}
      role="status"
      className="mx-auto mt-10 w-full max-w-xl"
    >
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-gold/30 bg-surface/60 p-6 text-center sm:p-10">
        <CheckCircle2 aria-hidden className="h-10 w-10 text-gold" strokeWidth={1.6} />
        <div>
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="font-serif text-3xl font-semibold text-cream focus-visible:outline-none sm:text-4xl"
          >
            Order placed — thank you!
          </h3>
          <p className="mt-2 font-sans text-sm font-semibold uppercase tracking-[0.25em] text-gold-light">
            {order.orderNumber}
          </p>
        </div>

        <ul className="flex w-full flex-col gap-2 text-left">
          {order.items.map((item, i) => (
            <li
              key={`${item.optionLabel}-${i}`}
              className="flex items-baseline justify-between font-sans text-sm text-cream/85"
            >
              <span>
                {item.quantity} × {item.productName} ({item.optionLabel})
              </span>
              <span>{formatPrice(item.lineTotalKes, BUSINESS.currency)}</span>
            </li>
          ))}
        </ul>

        <div className="flex w-full flex-col gap-1.5">
          <div className="flex items-baseline justify-between font-sans text-sm font-semibold text-cream">
            <span>Subtotal</span>
            <span>{formatPrice(order.subtotalKes, BUSINESS.currency)}</span>
          </div>
          <p className="text-left font-sans text-xs text-muted">
            {order.deliveryFeeKes === null
              ? "Delivery fee confirmed when we contact you"
              : `Delivery fee ${formatPrice(order.deliveryFeeKes, BUSINESS.currency)}`
            }
            {order.totalKes !== null &&
              ` · Total ${formatPrice(order.totalKes, BUSINESS.currency)}`}
          </p>
          <p className="text-left font-sans text-xs text-muted">
            {paymentMethodLabel(order.paymentMethod)}.
          </p>
        </div>

        <p className="font-sans text-sm leading-relaxed text-cream/85">
          We will contact you on WhatsApp or phone to confirm delivery.
        </p>

        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Send order ${order.orderNumber} on WhatsApp`}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-full bg-gold px-7 font-sans text-sm font-semibold text-background transition-all duration-300 ease-luxe hover:bg-gold-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
        >
          <MessageCircle aria-hidden className="h-5 w-5" strokeWidth={1.8} />
          Send this order on WhatsApp
        </a>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-gold/50 px-6 font-sans text-sm font-semibold text-gold transition-colors duration-300 ease-luxe hover:border-gold hover:bg-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
        >
          Place another order
        </button>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Small field helpers (labels + errors tied to inputs)                */
/* ------------------------------------------------------------------ */

function TextField({
  id,
  label,
  error,
  hint,
  value,
  onChange,
  placeholder,
  inputMode,
  autoComplete,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "tel" | "email";
  autoComplete?: string;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="text"
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
          undefined
        }
        className={`min-h-11 w-full rounded-xl border bg-surface/60 px-4 py-2.5 font-sans text-sm text-cream placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light ${
          error ? "border-gold-light/70" : "border-cream/15 focus:border-gold/50"
        }`}
      />
      {hint && (
        <p id={hintId} className="font-sans text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="font-sans text-xs text-gold-light">
          {error}
        </p>
      )}
    </div>
  );
}

function TextArea({
  id,
  label,
  error,
  hint,
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted"
      >
        {label}
      </label>
      <textarea
        id={id}
        name={id}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
          undefined
        }
        className={`min-h-11 w-full rounded-xl border bg-surface/60 px-4 py-2.5 font-sans text-sm text-cream placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light ${
          error ? "border-gold-light/70" : "border-cream/15 focus:border-gold/50"
        }`}
      />
      {hint && (
        <p id={hintId} className="font-sans text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="font-sans text-xs text-gold-light">
          {error}
        </p>
      )}
    </div>
  );
}
