"use client";

/**
 * STEP 4A — quantity stepper (1–10) for the checkout order panel.
 * Buttons are 44px targets; the value can also be typed and is clamped on
 * blur. ArrowUp/ArrowDown work in the field as on a spinbutton.
 */

import { useEffect, useId, useState } from "react";

export default function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 10,
  error,
}: {
  /** Current quantity (controlled). */
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  error?: string;
}) {
  const [text, setText] = useState(String(value));
  const inputId = useId();
  const errorId = `${inputId}-error`;

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  const commit = (raw: string) => {
    const parsed = parseInt(raw.replace(/[^0-9]/g, ""), 10);
    const next = Number.isNaN(parsed) ? min : clamp(parsed);
    onChange(next);
    setText(String(next));
  };

  const step = (dir: 1 | -1) => {
    const next = clamp(value + dir);
    onChange(next);
    setText(String(next));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={value <= min}
          aria-label="Decrease quantity"
          aria-controls={inputId}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-cream/15 bg-surface/60 font-sans text-lg font-semibold text-cream transition-colors duration-300 ease-luxe hover:border-gold/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden>−</span>
        </button>
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={`Quantity (between ${min} and ${max})`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              e.preventDefault();
              step(1);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              step(-1);
            }
          }}
          className="h-11 w-16 rounded-xl border border-cream/15 bg-surface/60 text-center font-sans text-sm font-semibold text-cream placeholder:text-muted focus:border-gold/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
        />
        <button
          type="button"
          onClick={() => step(1)}
          disabled={value >= max}
          aria-label="Increase quantity"
          aria-controls={inputId}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-cream/15 bg-surface/60 font-sans text-lg font-semibold text-cream transition-colors duration-300 ease-luxe hover:border-gold/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden>+</span>
        </button>
      </div>
      {error && (
        <p id={errorId} className="font-sans text-xs text-gold-light">
          {error}
        </p>
      )}
    </div>
  );
}
