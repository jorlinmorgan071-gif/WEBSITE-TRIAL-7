"use client";

/**
 * STEP 3 — animated price tag.
 * Changing `changeKey` (the selected size id) swaps the price with a short
 * fade + slide. The wrapper is a static polite live region, so screen
 * readers announce the new price. Reduced motion: the price simply swaps.
 */

import { AnimatePresence, motion } from "framer-motion";
import { EASE_LUXE } from "@/lib/design-tokens";

export default function PriceTag({
  price,
  changeKey,
  reducedMotion = false,
  size = "lg",
  className = "",
}: {
  price: string;
  /** Change this (e.g. the selected size id) and the price animates. */
  changeKey: string;
  reducedMotion?: boolean;
  /** "lg" for the featured showcase, "md" for grid cards. */
  size?: "lg" | "md";
  className?: string;
}) {
  const sizeClass = size === "lg" ? "text-4xl sm:text-5xl" : "text-3xl";

  return (
    <div aria-live="polite" className={`relative ${className}`}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={changeKey}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: reducedMotion ? 0.15 : 0.3, ease: EASE_LUXE }}
          className={`block font-serif font-semibold leading-tight text-gold ${sizeClass}`}
        >
          {price}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
