"use client";

/**
 * STEP 3 — "Get Your Fried Omena" product section.
 * Data-driven: one product renders the featured showcase; two or more
 * switch to a responsive product grid (1 column mobile, 2 tablet,
 * 3 desktop). All content comes from lib/products.ts and lib/business.ts.
 *
 * The whole block enters with one small fade + rise the first time it
 * scrolls into view; product photos only start loading then too, keeping
 * the first page load light.
 */

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  PRODUCTS,
  PRODUCTS_EYEBROW,
  PRODUCTS_HEADING,
  PRODUCTS_SUBHEADING,
} from "@/lib/products";
import { EASE_LUXE } from "@/lib/design-tokens";
import ProductShowcase from "@/components/ProductShowcase";
import ProductCard from "@/components/ProductCard";

export default function ProductsSection() {
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
        {PRODUCTS.length === 1 ? (
          <ProductShowcase
            product={PRODUCTS[0]}
            entered={entered}
            reducedMotion={reducedMotion}
          />
        ) : (
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {PRODUCTS.map((p) => (
              <ProductCard key={p.id} product={p} entered={entered} />
            ))}
          </div>
        )}
      </motion.div>
    </section>
  );
}
