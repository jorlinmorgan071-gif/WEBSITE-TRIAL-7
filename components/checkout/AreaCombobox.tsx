"use client";

/**
 * STEP 4A — searchable Nairobi area picker (combobox with a listbox).
 * List comes from lib/delivery.ts (plus "Other"). Keyboard: ArrowDown/ArrowUp
 * move, Enter picks, Escape closes. The list also opens on focus and filters
 * as you type. The server validates the final value against the same list.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { DELIVERY_AREAS, OTHER_AREA } from "@/lib/delivery";

const OPTION_NAMES = [...DELIVERY_AREAS.map((a) => a.name), OTHER_AREA];
const MAX_SUGGESTIONS = 12;

export default function AreaCombobox({
  id,
  value,
  onChange,
  error,
  hintId,
}: {
  /** Field id — the visible label's htmlFor must match this. */
  id: string;
  /** Current area text (a name from the list, "Other", or free text). */
  value: string;
  onChange: (next: string) => void;
  error?: string;
  /** id of the hint element shown under the field. */
  hintId?: string;
}) {
  const inputId = id;
  const listId = `${inputId}-listbox`;
  const errorId = `${inputId}-error`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return OPTION_NAMES.slice(0, MAX_SUGGESTIONS);
    return OPTION_NAMES.filter((n) => n.toLowerCase().includes(q)).slice(
      0,
      MAX_SUGGESTIONS
    );
  }, [value]);

  // Close when clicking outside the widget.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
    setActiveIndex(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(e.key === "ArrowDown" ? 0 : filtered.length - 1);
        return;
      }
      setActiveIndex((i) => {
        if (filtered.length === 0) return -1;
        const down = e.key === "ArrowDown";
        if (i === -1) return down ? 0 : filtered.length - 1;
        return down
          ? (i + 1) % filtered.length
          : (i - 1 + filtered.length) % filtered.length;
      });
    } else if (e.key === "Enter") {
      if (open && activeIndex >= 0 && filtered[activeIndex]) {
        e.preventDefault();
        select(filtered[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open && filtered.length >= 0}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
        }
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [hintId, error ? errorId : null].filter(Boolean).join(" ") || undefined
        }
        autoComplete="off"
        placeholder="Start typing, e.g. Kilimani"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => {
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className="min-h-11 w-full rounded-xl border border-cream/15 bg-surface/60 px-4 py-2.5 font-sans text-sm text-cream placeholder:text-muted focus:border-gold/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light aria-[invalid=true]:border-gold-light/70"
      />

      {error ? (
        <p id={errorId} className="mt-1.5 font-sans text-xs text-gold-light">
          {error}
        </p>
      ) : null}

      {open && (
        <ul
          role="listbox"
          id={listId}
          aria-label="Nairobi areas"
          className="absolute z-20 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-gold/25 bg-[#141210] py-1.5 shadow-2xl shadow-black/70"
        >
          {filtered.length === 0 ? (
            <li
              role="option"
              aria-selected="false"
              aria-disabled="true"
              id={`${listId}-opt-none`}
              className="px-4 py-2.5 font-sans text-sm text-muted"
            >
              No area matches — choose “Other” and add a landmark below
            </li>
          ) : (
            filtered.map((name, i) => (
              <li
                key={name}
                role="option"
                aria-selected={value === name}
                id={`${listId}-opt-${i}`}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => {
                  // mousedown (not click) so the input keeps focus
                  e.preventDefault();
                  select(name);
                }}
                className={`min-h-11 cursor-pointer px-4 py-2.5 font-sans text-sm ${
                  i === activeIndex
                    ? "bg-gold/15 text-gold-light"
                    : "text-cream/85"
                } ${value === name ? "font-semibold" : ""}`}
              >
                {name}
                {name === OTHER_AREA && (
                  <span className="ml-2 text-xs text-muted">
                    type your area in the address
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
