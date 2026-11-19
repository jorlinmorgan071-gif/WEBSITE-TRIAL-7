"use client";

/**
 * STEP 2 — Fullscreen step viewer (lightbox).
 *
 * - Opens from the step card via a Framer Motion shared layoutId
 *   ("step-card"), so the card visibly grows into the full-screen view.
 * - Dark blurred backdrop (the step's tiny placeholder), image with
 *   "contain", the same explanation caption, close button, prev/next.
 * - Esc closes, ArrowLeft/ArrowRight navigate, touch swipe navigates.
 * - Page scroll is locked while open; focus is trapped inside and
 *   returned to the previously focused element on close.
 * - Step changes inside use the same layered feathered-focus reveal
 *   (cheap: mask-image on the sharp layer over a blurred base).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { COOKING_STEPS } from "@/lib/steps";
import { EASE_LUXE, MASK_FULL_PCT, VIEWER } from "@/lib/viewer-tokens";

const TOTAL = COOKING_STEPS.length;
const radialMask = (pct: number) =>
  `radial-gradient(circle at 50% 50%, #000 0%, #000 ${Math.max(
    0,
    pct - 18
  )}%, transparent ${pct}%)`;

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Build a unique CSS selector for an element (used to re-find the
 *  opener button on close, since the shared-layout swap unmounts it). */
function buildSelector(el: HTMLElement): string {
  if (el.id) return `#${el.id}`;
  const tag = el.tagName.toLowerCase();
  const attrs: string[] = [];
  const aria = el.getAttribute("aria-label");
  if (aria) attrs.push(`[aria-label="${CSS.escape(aria)}"]`);
  const parent = el.parentElement;
  if (!parent) return tag + attrs.join("");
  const sameTag = Array.from(parent.querySelectorAll(tag + attrs.join("")));
  const idx = sameTag.indexOf(el);
  return (
    buildSelector(parent) +
    " > " +
    tag +
    attrs.join("") +
    (idx > 0 ? `:nth-of-type(${idx + 1})` : "")
  );
}

export default function StepLightbox({
  index,
  onClose,
  onNavigate,
}: {
  index: number;
  onClose: () => void;
  /** goTo(i, direction) from the section — keeps both in sync. */
  onNavigate: (i: number) => void;
}) {
  const step = COOKING_STEPS[index];
  const reducedMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  /** swipe tracking (touch) */
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  /** drag tracking (mouse) for desktop swipe on the image */
  const dragStartX = useRef<number | null>(null);

  /* ---------- scroll lock + focus management ---------- */

  useEffect(() => {
    // The card button unmounts while the lightbox owns the shared
    // layoutId, so remember it by SELECTOR and re-query on close.
    const opener = (document.activeElement as HTMLElement) ?? null;
    const openerSelector = opener?.id
      ? `#${opener.id}`
      : opener
        ? buildSelector(opener)
        : null;

    const { scrollY } = window;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    // move focus into the dialog
    const raf = requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    return () => {
      cancelAnimationFrame(raf);
      body.style.overflow = prevOverflow;
      window.scrollTo(0, scrollY);
      // The card remounts AFTER this cleanup (shared-layout swap), so
      // restore focus after the next paint, once the card is back.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const target = openerSelector
            ? (document.querySelector(openerSelector) as HTMLElement | null)
            : null;
          (target ?? opener)?.focus();
        });
      });
    };
  }, []);

  /* ---------- keyboard: Esc + arrows + focus trap ---------- */

  const nextStep = useCallback(() => {
    if (index < TOTAL - 1) onNavigate(index + 1);
  }, [index, onNavigate]);

  const prevStep = useCallback(() => {
    if (index > 0) onNavigate(index - 1);
  }, [index, onNavigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        nextStep();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevStep();
        return;
      }
      if (e.key === "Tab") {
        // focus trap: cycle within the dialog
        const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (!nodes || nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, nextStep, prevStep]);

  /* ---------- touch swipe ---------- */

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = t.clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0) nextStep();
      else prevStep();
    }
  };

  /* ---------- desktop drag (framer) ---------- */

  const onDragEnd = (e: unknown, info: { offset: { x: number } }) => {
    if (Math.abs(info.offset.x) > 80) {
      if (info.offset.x < 0) nextStep();
      else prevStep();
    }
  };

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <motion.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Step ${step.id}: ${step.title}`}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col outline-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: EASE_LUXE }}
    >
      {/* blurred backdrop from the step's tiny placeholder */}
      <div className="absolute inset-0" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={step.srcTiny}
          alt=""
          className="h-full w-full scale-125 object-cover blur-3xl"
          style={{ filter: "brightness(0.3) blur(40px) sepia(0.2)" }}
        />
        <div className="absolute inset-0 bg-black/70" />
      </div>

      {/* header: step caption + close */}
      <div className="relative z-10 flex items-start justify-between gap-4 p-4 sm:p-6">
        <div className="min-w-0">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
            Step {pad(step.id)} / {TOTAL}
          </p>
          <h3 className="mt-1 truncate font-serif text-xl font-semibold text-cream sm:text-2xl">
            {step.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close full screen view"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold/50 text-gold transition-colors duration-300 ease-luxe hover:bg-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {/* image stage — shared layout zoom target */}
      <div
        className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4 sm:px-16"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <motion.div
          layoutId="step-card"
          className="relative h-full w-full max-w-5xl select-none overflow-hidden rounded-2xl border border-gold/20 bg-surface [touch-action:pan-y] [-webkit-user-drag:none]"
          transition={{ duration: reducedMotion ? 0 : 0.45, ease: EASE_LUXE }}
          drag={!reducedMotion ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.16}
          onDragStart={(e) => {
            // stop the browser's native image drag from stealing the gesture
            if (e.preventDefault) e.preventDefault();
          }}
          onDragEnd={onDragEnd}
          style={{ cursor: "grab" }}
        >
          {failed ? (
            <div className="absolute inset-0 bg-surface" />
          ) : (
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div
                key={`lb-${step.id}`}
                className="absolute inset-0"
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: VIEWER.enterScale }}
                animate={{ opacity: 1, scale: 1 }}
                exit={
                  reducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: VIEWER.exitScale }
                }
                transition={{
                  opacity: { duration: reducedMotion ? 0.2 : VIEWER.exitS, ease: EASE_LUXE },
                  scale: { duration: reducedMotion ? 0.2 : VIEWER.exitS, ease: EASE_LUXE },
                }}
              >
                {!reducedMotion && (
                  /* blurred base layer (same reveal recipe as the card):
                     tiny placeholder, stays blurred behind the mask */
                  <motion.div
                    className="absolute inset-0"
                    initial={{ scale: VIEWER.enterScale }}
                    animate={{ scale: 1 }}
                    transition={{ duration: VIEWER.revealS, ease: EASE_LUXE }}
                    style={{ filter: "blur(28px)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={step.srcTiny}
                      alt=""
                      className="h-full w-full object-contain [user-drag:none] [-webkit-user-drag:none]"
                      draggable={false}
                    />
                  </motion.div>
                )}
                {/* sharp copy revealed by the expanding radial mask */}
                <motion.div
                  className="absolute inset-0"
                  initial={reducedMotion ? undefined : { maskImage: radialMask(0), WebkitMaskImage: radialMask(0) }}
                  animate={reducedMotion ? undefined : { maskImage: radialMask(MASK_FULL_PCT), WebkitMaskImage: radialMask(MASK_FULL_PCT) }}
                  transition={{ duration: VIEWER.revealS, ease: EASE_LUXE }}
                >
                  <Image
                    src={step.src}
                    alt={step.alt}
                    fill
                    sizes="100vw"
                    className="object-contain [user-drag:none] [-webkit-user-drag:none]"
                    draggable={false}
                    onError={() => setFailed(true)}
                  />
                </motion.div>
              </motion.div>
            </AnimatePresence>
          )}

          {/* prev / next INSIDE the stage */}
          <LightboxArrow side="left" disabled={index === 0} onClick={prevStep} />
          <LightboxArrow side="right" disabled={index === TOTAL - 1} onClick={nextStep} />
        </motion.div>
      </div>

      {/* footer caption — same explanation text as the card panel */}
      <div className="relative z-10 p-4 text-center sm:p-6">
        <p className="mx-auto max-w-2xl font-sans text-[13px] leading-relaxed text-cream/75 sm:text-sm">
          {step.description}
        </p>
        <span className="mt-3 inline-block rounded-full border border-gold/40 bg-gold/10 px-3 py-1 font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-gold-light">
          {step.timeLabel}
        </span>
      </div>
    </motion.div>
  );
}

/** Edge arrow inside the lightbox stage. */
function LightboxArrow({
  side,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous step" : "Next step"}
      className={`absolute top-1/2 ${
        side === "left" ? "left-3" : "right-3"
      } z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-gold/50 bg-black/40 text-gold backdrop-blur-sm transition-colors duration-300 ease-luxe hover:bg-gold/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-black/40`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {side === "right" ? <path d="M5 12h14M13 6l6 6-6 6" /> : <path d="M19 12H5M11 6l-6 6 6 6" />}
      </svg>
    </button>
  );
}
