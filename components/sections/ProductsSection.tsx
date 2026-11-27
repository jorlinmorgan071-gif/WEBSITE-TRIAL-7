"use client";

/**
 * STEP 3 — "Get Your Fried Omena" product section (STEP 4A: data now comes
 * from the server — database catalogue with lib/products.ts fallback).
 * One product renders the featured showcase; two or more switch to a
 * responsive product grid (1 column mobile, 2 tablet, 3 desktop).
 *
 * The whole block enters with one small fade + rise the first time it
 * scrolls into view; product photos only start loading then too, keeping
 * the first page load light.
 */

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  PRODUCTS_EYEBROW,
  PRODUCTS_HEADING,
  PRODUCTS_SUBHEADING,
  type Product,
} from "@/lib/products";
import { EASE_LUXE } from "@/lib/design-tokens";
import ProductShowcase from "@/components/ProductShowcase";
import ProductCard from "@/components/ProductCard";

/**
 * STEP 4A — the section is now data-driven from the server: the page passes
 * the database-backed catalogue (or the lib/products.ts fallback when the
 * database is unreachable). One product renders the featured showcase; two or
 * more switch to the responsive product grid.
 */
export default function ProductsSection({ products }: { products: Product[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  /** True once the section has entered the viewport (entrance reveal). */
  const [entered, setEntered] = useState(false);

  /* Reduced-motion must be applied AFTER mount: the server cannot know
   * the user's OS setting, so branching the render on it directly makes
   * the client markup differ from SSR (React #418 hydration error). */
  const prefersReduced = useReducedMotion();
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    setReducedMotion(!!prefersReduced);
  }, [prefersReduced]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setEntered(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      id="products"
      ref={sectionRef}
      aria-label={PRODUCTS_HEADING}
      className="relative isolate flex w-full flex-col items-center overflow-hidden bg-background px-4 py-24 sm:px-6"
    >
      {/* ---------- heading ---------- */}
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
          {PRODUCTS_EYEBROW}
        </p>
        <h2 className="max-w-2xl font-serif text-3xl font-semibold text-cream sm:text-4xl md:text-5xl">
          {PRODUCTS_HEADING}
        </h2>
        <div className="gold-rule w-40" aria-hidden />
        <p className="max-w-xl font-sans text-sm leading-relaxed text-muted sm:text-base">
          {PRODUCTS_SUBHEADING}
        </p>
      </div>

      {/* ---------- showcase (1 product) or grid (2+) — one entrance ---------- */}
      <motion.div
        className="mt-10 w-full"
        initial={false}
        animate={entered ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: reducedMotion ? 0 : 0.7, ease: EASE_LUXE }}
        style={{ opacity: entered ? undefined : 0 }}
      >
        {products.length === 1 ? (
          <ProductShowcase
            product={products[0]}
            entered={entered}
            reducedMotion={reducedMotion}
          />
        ) : products.length > 1 ? (
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} entered={entered} />
            ))}
          </div>
        ) : (
          <p className="mx-auto mt-8 max-w-md font-sans text-sm leading-relaxed text-muted">
            Our menu is being updated right now. Please order on WhatsApp — we
            reply fast.
          </p>
        )}
      </motion.div>
    </section>
  );
}
