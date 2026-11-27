"use client";

/**
 * STEP 3 — segmented size selector (a proper radiogroup).
 * Each segment shows the formal size with its everyday name and price.
 * Keyboard: ArrowLeft/ArrowRight (also Up/Down) move between sizes,
 * Home/End jump to the first/last — standard radiogroup behaviour.
 * The selected segment is the only tab stop (roving tabindex).
 */

import type { ProductOption } from "@/lib/products";
import { formatPrice } from "@/lib/order";

export default function SizeSelector({
  options,
  selectedId,
  currency,
  onSelect,
}: {
  options: ProductOption[];
  /** Id of the currently selected option. */
  selectedId: string;
  /** Business currency shown before each price. */
  currency: string;
  onSelect: (id: string) => void;
}) {
  const index = options.findIndex((o) => o.id === selectedId);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown")
      next = (index + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      next = (index - 1 + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    if (next === null) return;
    e.preventDefault();
    onSelect(options[next].id);
    // roving tabindex: move focus to the newly selected radio once
    // React has re-rendered it as aria-checked="true". currentTarget is
    // only valid during the event, so capture the group first.
    const group = e.currentTarget;
    requestAnimationFrame(() => {
      const target = group.querySelector<HTMLButtonElement>(
        '[role="radio"][aria-checked="true"]'
      );
      target?.focus();
    });
  };

  return (
    <div
      role="radiogroup"
      aria-label="Choose a size"
      onKeyDown={onKeyDown}
      className="flex flex-wrap gap-2.5"
    >
      {options.map((o) => {
        const checked = o.id === selectedId;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onSelect(o.id)}
            className={`flex min-h-11 flex-col items-start rounded-xl border px-4 py-2 text-left transition-colors duration-300 ease-luxe focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light ${
              checked
                ? "border-gold/60 bg-gold/15 text-gold-light"
                : "border-cream/15 bg-surface/60 text-cream/80 hover:border-gold/40 hover:text-cream"
            }`}
          >
            <span className="font-sans text-sm font-semibold">
              {o.label} · {o.localName}
            </span>
            <span className="mt-0.5 font-sans text-xs text-muted">
              {formatPrice(o.priceKes, currency)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
