"use client";

/**
 * STEP 3 — featured showcase for a single product.
 * Two columns on desktop (photo card left, details right), stacked on
 * mobile. The selected size drives the price animation and the WhatsApp
 * order link together — the link is derived from the selection on every
 * render, so the message can never disagree with the screen.
 *
 * Photos: 2+ images show thumbnails under the card; the main photo
 * crossfades on switch (the thumbnail uses the same image variant as
 * the main photo, so a switch is always instant — no waiting, no flash).
 */

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ChefHat,
  Droplets,
  Fish,
  Flame,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { BUSINESS } from "@/lib/business";
import type { Product } from "@/lib/products";
import { formatPrice, orderMessage, telHref, whatsappUrl } from "@/lib/order";
import { EASE_LUXE } from "@/lib/design-tokens";
import PriceTag from "./PriceTag";
import SizeSelector from "./SizeSelector";

/** Icon for each highlight line (by position); extra lines get Sparkles. */
const HIGHLIGHT_ICONS = [Fish, Droplets, Flame, ChefHat];

/** Photo variant requested by the main photo and every thumbnail —
 *  identical URLs mean one download serves both. */
const PHOTO_SIZES = "(max-width: 768px) 92vw, 560px";

export default function ProductShowcase({
  product,
  entered,
  reducedMotion,
}: {
  product: Product;
  /** True once the section has entered the viewport (gates image loads). */
  entered: boolean;
  reducedMotion: boolean;
}) {
  const [selectedId, setSelectedId] = useState(product.defaultOptionId);
  const [imageIndex, setImageIndex] = useState(0);
  /** Photo indices that failed to load (dark surface fallback). */
  const [failed, setFailed] = useState<Set<number>>(new Set());

  const selected =
    product.options.find((o) => o.id === selectedId) ?? product.options[0];

  // Derived on every render from the current selection — the WhatsApp
  // message always matches the size and price shown.
  const waUrl = whatsappUrl(BUSINESS, orderMessage(BUSINESS, product, selected));

  const markFailed = (i: number) =>
    setFailed((prev) => {
      if (prev.has(i)) return prev;
      const next = new Set(prev);
      next.add(i);
      return next;
    });

  const mainFailed = failed.has(imageIndex);
  const photo = product.images[imageIndex];

  return (
    <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
      {/* ---------- photo card ---------- */}
      <div className="relative">
        {/* faint gold glow behind the card */}
        <div
          aria-hidden
          className="absolute -inset-5 rounded-[2.5rem] bg-[radial-gradient(50%_50%_at_50%_50%,rgba(201,162,75,0.16),transparent_72%)] blur-2xl"
        />
        <div className="lift-card relative aspect-[4/3] overflow-hidden rounded-2xl border border-gold/20 bg-surface shadow-2xl shadow-black/60">
          {entered ? (
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div
                key={`photo-${imageIndex}`}
                className="absolute inset-0"
                initial={
                  reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.035 }
                }
                animate={{ opacity: 1, scale: 1 }}
                exit={
                  reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.02 }
                }
                transition={{
                  duration: reducedMotion ? 0.2 : 0.45,
                  ease: EASE_LUXE,
                }}
              >
                {mainFailed || !photo ? (
                  // Failure fallback: dark surface, no broken-image icon.
                  <div className="absolute inset-0 bg-surface" />
                ) : (
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    sizes={PHOTO_SIZES}
                    className="object-cover"
                    onError={() => markFailed(imageIndex)}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="absolute inset-0 bg-surface" aria-hidden />
          )}
          {/* readability scrim */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-background/60 to-transparent"
          />
        </div>

        {/* thumbnails — 2+ photos only */}
        {product.images.length > 1 && (
          <div className="mt-5 flex items-center justify-center gap-3 lg:justify-start">
            {product.images.map((img, i) => (
              <button
                key={img.src}
                type="button"
                onClick={() => setImageIndex(i)}
                aria-label={`Show photo ${i + 1} of ${
                  product.images.length
                }: ${img.alt}`}
                aria-current={i === imageIndex}
                className={`relative h-16 w-20 overflow-hidden rounded-lg border transition-colors duration-300 ease-luxe focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light ${
                  i === imageIndex
                    ? "border-gold"
                    : "border-cream/15 opacity-80 hover:border-gold/50 hover:opacity-100"
                }`}
              >
                {entered && !failed.has(i) ? (
                  <Image
                    src={img.src}
                    alt=""
                    fill
                    sizes={PHOTO_SIZES}
                    className="object-cover"
                    onError={() => markFailed(i)}
                  />
                ) : (
                  <span className="absolute inset-0 block bg-surface" aria-hidden />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ---------- details ---------- */}
      <div className="flex flex-col items-start gap-5">
        {product.badge && (
          <span className="inline-flex items-center rounded-full border border-gold/40 bg-gold/10 px-3 py-1 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-light">
            {product.badge}
          </span>
        )}

        <div>
          <h3 className="font-serif text-3xl font-semibold text-cream sm:text-4xl">
            {product.name}
          </h3>
          <p className="mt-1 font-sans text-sm font-medium uppercase tracking-[0.2em] text-gold-light">
            {product.tagline}
          </p>
        </div>

        <p className="max-w-xl font-sans text-sm leading-relaxed text-cream/75 sm:text-base">
          {product.description}
        </p>

        <ul className="flex flex-col gap-2.5">
          {product.highlights.map((h, i) => {
            const Icon = HIGHLIGHT_ICONS[i] ?? Sparkles;
            return (
              <li
                key={h}
                className="flex items-center gap-2.5 font-sans text-sm text-cream/85"
              >
                <Icon
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-gold"
                  strokeWidth={1.8}
                />
                {h}
              </li>
            );
          })}
        </ul>

        <p
          className={`flex items-center gap-2 font-sans text-sm ${
            product.inStock ? "text-cream/85" : "text-muted"
          }`}
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${
              product.inStock ? "bg-gold" : "bg-cream/30"
            }`}
          />
          {product.inStock ? "In stock" : "Out of stock"}
        </p>

        <PriceTag
          price={formatPrice(selected.priceKes, BUSINESS.currency)}
          changeKey={selected.id}
          reducedMotion={reducedMotion}
        />

        <SizeSelector
          options={product.options}
          selectedId={selected.id}
          currency={BUSINESS.currency}
          onSelect={setSelectedId}
        />

        {/* ---------- order buttons ---------- */}
        <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row">
          <a
            href={product.inStock ? waUrl : undefined}
            target={product.inStock ? "_blank" : undefined}
            rel="noopener noreferrer"
            aria-label={`Order on WhatsApp — ${product.name}, ${selected.label}`}
            aria-disabled={!product.inStock}
            className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2.5 rounded-full px-7 font-sans text-sm font-semibold transition-all duration-300 ease-luxe focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light ${
              product.inStock
                ? "bg-gold text-background hover:bg-gold-light"
                : "pointer-events-none cursor-not-allowed bg-gold/25 text-background/70 opacity-50"
            }`}
          >
            <MessageCircle
              aria-hidden
              className="h-5 w-5"
              strokeWidth={1.8}
            />
            Order on WhatsApp
          </a>
          <a
            href={product.inStock ? "#order" : undefined}
            aria-label="Order online — jump to online ordering"
            aria-disabled={!product.inStock}
            className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2.5 rounded-full border px-6 font-sans text-sm font-semibold transition-all duration-300 ease-luxe focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light ${
              product.inStock
                ? "border-gold/50 text-gold hover:border-gold hover:bg-gold/10"
                : "pointer-events-none cursor-not-allowed border-cream/15 text-muted opacity-50"
            }`}
          >
            <ArrowDown aria-hidden className="h-5 w-5" strokeWidth={1.8} />
            Order online
          </a>
        </div>

        <p className="mt-1 font-sans text-sm text-muted">
          Questions? Call or text{" "}
          <a
            href={telHref(BUSINESS)}
            className="font-medium text-gold-light underline decoration-gold/40 underline-offset-4 transition-colors duration-300 ease-luxe hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
          >
            {BUSINESS.displayPhone}
          </a>
        </p>

        <SocialRow />
      </div>
    </div>
  );
}

/** Social links — an icon renders only when the link is non-empty. */
function SocialRow() {
  const links = [
    { name: "TikTok", url: BUSINESS.social.tiktok, Glyph: TikTokGlyph },
    { name: "Instagram", url: BUSINESS.social.instagram, Glyph: InstagramGlyph },
    { name: "Facebook", url: BUSINESS.social.facebook, Glyph: FacebookGlyph },
  ].filter((s) => s.url);

  if (links.length === 0) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="font-sans text-xs uppercase tracking-[0.2em] text-muted">
        Follow us
      </span>
      {links.map(({ name, url, Glyph }) => (
        <a
          key={name}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${BUSINESS.name} on ${name}`}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/40 text-gold transition-colors duration-300 ease-luxe hover:border-gold hover:bg-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
        >
          <Glyph />
        </a>
      ))}
    </div>
  );
}

/* ---- social glyphs, drawn in the site's stroke style (1.8, round) ---- */

function TikTokGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* simplified note glyph */}
      <path d="M14 4v9.5a3.75 3.75 0 1 1-3.75-3.75" />
      <path d="M14 6.5c.9 1.9 2.5 3 4.6 3.2" />
    </svg>
  );
}

function InstagramGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="0.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}
