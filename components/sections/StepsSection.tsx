"use client";

/**
 * STEP 2 — "Cook It the Lake Flavour Way" floating step viewer.
 *
 * Structure (z-order):
 *   ambient background  — current step's tiny placeholder, scaled up,
 *                         heavily blurred, ~35% brightness, gold tint;
 *                         cross-fades with the step.
 *   floating card       — 16:9 desktop / ~4:5 mobile, gold hairline
 *                         border, continuous bob + micro-rotation,
 *                         elliptical shadow + gold glow beneath that
 *                         breathe with the bob.
 *   glass panel         — bottom-left over the card (below it on mobile):
 *                         step number, serif title, description, time chip.
 *
 * Signature transition (see lib/viewer-tokens.ts): the incoming step is
 * a blurred+zoomed base layer with a sharp copy above it, revealed by a
 * radial mask expanding from the centre (feathered focus). The outgoing
 * layer fades and eases to 1.06 zoom. Direction-aware: next drifts
 * content left, prev drifts right.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import { COOKING_STEPS, STEPS_HEADING, STEPS_SUBHEADING } from "@/lib/steps";
import { EASE_LUXE, MASK_FULL_PCT, VIEWER } from "@/lib/viewer-tokens";

// The fullscreen viewer is only needed once a user opens it — its code
// (drag, mask, focus-trap logic) is split out of the initial chunk.
const StepLightbox = dynamic(() => import("@/components/StepLightbox"), {
  ssr: false,
});

const TOTAL = COOKING_STEPS.length;

/** Radial mask used by the sharp reveal layer (feathered focus). */
const radialMask = (pct: number) =>
  `radial-gradient(circle at 50% 50%, #000 0%, #000 ${Math.max(
    0,
    pct - 18
  )}%, transparent ${pct}%)`;

export default function StepsSection() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  /** Count of queued rapid changes — keeps will-change on during bursts. */
  const [busy, setBusy] = useState(0);
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  /** True once the section has entered the viewport (entrance pop). */
  const [entered, setEntered] = useState(false);

  /* Reduced-motion must be applied AFTER mount: the server cannot know
   * the user's OS setting, so branching the render on it directly makes
   * the client markup differ from SSR (React #418 hydration error).
   * useReducedMotion() returns null on the server and during the first
   * client render, then updates — but to be explicit and safe we take
   * its value into state only once mounted. */
  const prefersReduced = useReducedMotion();
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    setReducedMotion(!!prefersReduced);
  }, [prefersReduced]);

  const step = COOKING_STEPS[index];
  const imageFailed = failed.has(index);

  /* ---------- navigation ---------- */

  const goTo = useCallback(
    (next: number, dir: 1 | -1) => {
      setIndex((cur) => (next === cur ? cur : next));
      setDirection((cur) => (next === index ? cur : dir));
      // keep will-change alive during rapid changes
      setBusy((b) => b + 1);
      window.setTimeout(() => setBusy((b) => Math.max(0, b - 1)), 1400);
    },
    [index]
  );

  const nextStep = useCallback(() => {
    if (index < TOTAL - 1) goTo(index + 1, 1);
  }, [index, goTo]);

  const prevStep = useCallback(() => {
    if (index > 0) goTo(index - 1, -1);
  }, [index, goTo]);

  /* ---------- entrance (once) + keyboard arrows while in view ---------- */

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

  useEffect(() => {
    // Arrow keys navigate while the section is on screen (or focused).
    // Skip when the lightbox handles its own keys, or a text control
    // has focus.
    const onKey = (e: KeyboardEvent) => {
      if (lightboxOpen) return;
      const el = sectionRef.current;
      if (!el) return;
      const inDOM = document.activeElement?.closest("#steps");
      const rect = el.getBoundingClientRect();
      const inView = rect.top < window.innerHeight * 0.8 && rect.bottom > 0;
      if (!inView && !inDOM) return;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.key === "ArrowRight") nextStep();
      else if (e.key === "ArrowLeft") prevStep();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nextStep, prevStep, lightboxOpen]);

  /* ---------- preload neighbours ----------
   * Only once the section has entered the viewport — keeps the initial
   * page load free of step-image fetches the user hasn't scrolled to. */
  useEffect(() => {
    if (!entered) return;
    [index - 1, index + 1].forEach((i) => {
      if (i < 0 || i >= TOTAL) return;
      const img = new window.Image();
      img.src = COOKING_STEPS[i].src;
      img.src = COOKING_STEPS[i].srcMobile;
    });
  }, [index, entered]);

  const markFailed = useCallback((i: number) => {
    setFailed((prev) => new Set(prev).add(i));
  }, []);

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <section
      id="steps"
      ref={sectionRef}
      aria-label={STEPS_HEADING}
      className="relative isolate flex w-full flex-col items-center overflow-hidden bg-background px-4 py-24 sm:px-6"
    >
      {/* ---------- ambient background ---------- */}
      {/* Tiny placeholder of the current step, scaled up + blurred + dark
          + gold tint; cross-fades on step change. */}
      <div className="absolute inset-0 -z-10" aria-hidden>
        <AnimatePresence initial={false}>
          <motion.div
            key={`ambient-${step.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: reducedMotion ? 0.15 : VIEWER.revealS,
              ease: EASE_LUXE,
            }}
            className="absolute inset-0"
          >
            {/* plain img: 24px file, ~2KB — instant, no layout impact */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={step.srcTiny}
              alt=""
              className="h-full w-full scale-110 object-cover blur-3xl"
              style={{ filter: "brightness(0.35) blur(24px) sepia(0.25) hue-rotate(-8deg)" }}
            />
          </motion.div>
        </AnimatePresence>
        {/* base dark wash so the tint never fully disappears */}
        <div className="absolute inset-0 bg-background/60" />
      </div>

      {/* ---------- heading ---------- */}
      <div className="flex flex-col items-center gap-4 text-center">
        <h2 className="max-w-2xl font-serif text-3xl font-semibold text-cream sm:text-4xl md:text-5xl">
          {STEPS_HEADING}
        </h2>
        <div className="gold-rule w-40" aria-hidden />
        <p className="max-w-xl font-sans text-sm leading-relaxed text-muted sm:text-base">
          {STEPS_SUBHEADING}
        </p>
      </div>

      {/* ---------- floating card ---------- */}
      <motion.div
        className="relative mt-14 flex w-full max-w-4xl flex-col items-center"
        initial={false}
        animate={
          entered
            ? reducedMotion
              ? { opacity: 1, scale: 1, y: 0 }
              : { opacity: 1, scale: 1, y: 0 }
            : { opacity: 0, scale: 0.92, y: 28 }
        }
        transition={{ duration: 0.7, ease: EASE_LUXE }}
        style={{ opacity: entered ? undefined : 0 }}
      >
        {/* Entrance handled above; bob wrapper below animates only
            transform properties (GPU). */}
        <motion.div
          className="relative w-full"
          animate={
            reducedMotion || !entered
              ? undefined
              : { y: [0, -8, 0, 8, 0], rotate: [0, 0.4, 0, -0.4, 0] }
          }
          transition={{
            y: { duration: 6, repeat: Infinity, ease: "easeInOut" },
            rotate: { duration: 12, repeat: Infinity, ease: "easeInOut" },
          }}
        >
          {/* elliptical shadow + gold glow — breathe opposite the bob */}
          {!reducedMotion && (
            <motion.div
              aria-hidden
              className="absolute -bottom-7 left-1/2 h-10 w-3/4 -translate-x-1/2 rounded-[100%] bg-black/70 blur-xl"
              animate={{ scaleX: [1, 0.88, 1], opacity: [0.55, 0.35, 0.55] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              style={{
                background:
                  "radial-gradient(50% 50% at 50% 50%, rgba(201,162,75,0.28), rgba(0,0,0,0.75) 60%, transparent 100%)",
              }}
            />
          )}

          {/* THE CARD — 16:9 desktop; taller on mobile (landscape photos
              use cover, portrait steps use contain so they never crop). */}
          <motion.button
            type="button"
            id="step-card-opener"
            layoutId="step-card"
            onClick={() => setLightboxOpen(true)}
            aria-label={`Open step ${step.id} full screen`}
            className="group relative block w-full overflow-hidden rounded-2xl border border-gold/20 bg-surface shadow-2xl shadow-black/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-light aspect-[4/3] sm:aspect-[16/10] md:aspect-video"
            whileHover={{ scale: 1.008 }}
            whileTap={{ scale: 0.985 }}
            transition={{ duration: 0.4, ease: EASE_LUXE }}
          >
            {/* layered feathered-focus reveal — see file header.
                Until the section first enters the viewport (once), only
                a flat placeholder renders: zero image layers hydrate on
                page load, the whole scene mounts on first approach. */}
            {entered ? (
              <StepImage
                step={step}
                index={index}
                direction={direction}
                failed={imageFailed}
                onImageError={() => markFailed(index)}
                busy={busy > 0}
                reducedMotion={!!reducedMotion}
                priority={index === 0}
              />
            ) : (
              <div className="absolute inset-0 bg-surface" aria-hidden />
            )}
            {/* readability scrim above the image, below the panel */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-background/85 via-background/35 to-transparent"
            />
          </motion.button>
        </motion.div>
      </motion.div>

      {/* ---------- glass explanation panel ---------- */}
      {/* Below the card on mobile, overlapping it bottom-left on desktop. */}
      <div className="relative z-10 mt-5 w-full max-w-4xl px-0 md:-mt-28 md:px-6">
        <AnimatePresence initial={false}>
          <motion.div
            key={`panel-${step.id}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: EASE_LUXE }}
            className="mx-auto w-fit max-w-sm rounded-xl border border-cream/10 bg-black/45 px-5 py-4 text-center backdrop-blur-md md:mx-0 md:text-left"
            aria-live="polite"
          >
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
              Step {pad(step.id)} / {TOTAL}
            </p>
            <h3 className="mt-1.5 font-serif text-xl font-semibold text-cream md:text-2xl">
              {step.title}
            </h3>
            <p className="mt-1.5 max-w-xs font-sans text-[13px] leading-relaxed text-cream/75 md:text-sm">
              {step.description}
            </p>
            <span className="mt-3 inline-block rounded-full border border-gold/40 bg-gold/10 px-3 py-1 font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-gold-light">
              {step.timeLabel}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ---------- prev / next + progress + dots ---------- */}
      <div className="mt-8 flex w-full max-w-4xl flex-col items-center gap-5">
        <div className="flex items-center gap-4">
          <StepArrow
            direction="prev"
            disabled={index === 0}
            onClick={prevStep}
          />
          {/* thin gold progress bar */}
          <div className="relative h-px w-40 overflow-visible bg-cream/15 sm:w-56">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gold"
              animate={{ width: `${((index + 1) / TOTAL) * 100}%` }}
              transition={{ duration: 0.5, ease: EASE_LUXE }}
            />
          </div>
          <StepArrow
            direction="next"
            disabled={index === TOTAL - 1}
            onClick={nextStep}
          />
        </div>

        {/* step dots — keyboard accessible jump navigation */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {COOKING_STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Go to step ${s.id}: ${s.title}`}
              aria-current={i === index}
              onClick={() => goTo(i, i > index ? 1 : -1)}
              className="flex h-8 w-8 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-light"
            >
              <span
                className={`block rounded-full transition-all duration-300 ease-luxe ${
                  i === index
                    ? "h-2.5 w-2.5 bg-gold"
                    : "h-1.5 w-1.5 bg-cream/30 hover:bg-cream/60"
                }`}
              />
            </button>
          ))}
        </div>

        {/* hidden live region announcing the step title (panel is
            aria-live already; this guards when panel re-mounts) */}
        <p className="sr-only" aria-live="polite">
          Step {step.id} of {TOTAL}: {step.title}
        </p>
      </div>

      {/* ---------- fullscreen lightbox ---------- */}
      <AnimatePresence>
        {lightboxOpen && (
          <StepLightbox
            index={index}
            onClose={() => setLightboxOpen(false)}
            onNavigate={(i) => goTo(i, i > index ? 1 : -1)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

/* ================= sub-components ================= */

/** Circular gold-outline prev/next button (44px+ tap target). */
function StepArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "next" ? "Next step" : "Previous step"}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/50 text-gold transition-all duration-300 ease-luxe hover:border-gold hover:bg-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent"
    >
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
        {direction === "next" ? (
          <path d="M5 12h14M13 6l6 6-6 6" />
        ) : (
          <path d="M19 12H5M11 6l-6 6 6 6" />
        )}
      </svg>
    </button>
  );
}

/**
 * The layered step image with the feathered-focus reveal.
 * Renders at most 2 layers: incoming (blurred base + masked sharp
 * copy) and the outgoing one. Each step id animates in once.
 */
function StepImage({
  step,
  index,
  direction,
  failed,
  onImageError,
  busy,
  reducedMotion,
  priority,
}: {
  step: (typeof COOKING_STEPS)[number];
  index: number;
  direction: 1 | -1;
  failed: boolean;
  onImageError: () => void;
  busy: boolean;
  reducedMotion: boolean;
  priority: boolean;
}) {
  const drift = direction * VIEWER.driftPx;
  const showReveal = !reducedMotion && !failed;

  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div
        key={`img-${step.id}`}
        className="absolute inset-0"
        initial={
          reducedMotion
            ? { opacity: 0 }
            : {
                // incoming: slight drift from the travel direction
                opacity: 0,
                x: -drift,
              }
        }
        animate={
          reducedMotion
            ? { opacity: 1 }
            : { opacity: 1, x: 0 }
        }
        exit={
          reducedMotion
            ? { opacity: 0 }
            : {
                // outgoing: fade + zoom out toward the exit side
                opacity: 0,
                scale: VIEWER.exitScale,
                x: drift,
              }
        }
        transition={{
          opacity: { duration: reducedMotion ? 0.2 : VIEWER.exitS, ease: EASE_LUXE },
          x: { duration: VIEWER.revealS, ease: EASE_LUXE },
          scale: { duration: VIEWER.exitS, ease: EASE_LUXE },
        }}
      >
        {failed ? (
          // Failure fallback: dark surface only; the glass panel still
          // explains the step. No broken-image icon.
          <div className="absolute inset-0 bg-surface" />
        ) : (
          <>
            {/* LAYER 0 — contain steps (portrait photos) sit on a blurred
                copy of themselves so the side bars feel ambient, not dead. */}
            {step.fit === "contain" && (
              <div className="absolute inset-0" aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={step.srcTiny}
                  alt=""
                  className="h-full w-full scale-110 object-cover blur-xl"
                />
              </div>
            )}

            {/* LAYER 1 — blurred base of the incoming image: the tiny
                placeholder scaled up, zooming 1.12 -> 1 while the
                sharp layer's expanding mask clears the picture above
                it. The base deliberately STAYS slightly blurred — it is
                the "unfocused" part the mask pulls into focus. */}
            {showReveal && (
              <motion.div
                className="absolute inset-0"
                initial={{ scale: VIEWER.enterScale }}
                animate={{ scale: 1 }}
                transition={{ duration: VIEWER.revealS, ease: EASE_LUXE }}
                style={{
                  filter: "blur(28px)",
                  willChange: busy ? "transform" : "auto",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={step.srcTiny}
                  alt=""
                  className={`h-full w-full ${
                    step.fit === "contain" ? "object-contain" : "object-cover"
                  }`}
                  style={{ objectPosition: step.objectPosition }}
                />
              </motion.div>
            )}

            {/* LAYER 2 — sharp copy revealed by the expanding radial mask */}
            <motion.div
              className="absolute inset-0"
              initial={
                showReveal
                  ? {
                      maskImage: radialMask(0),
                      WebkitMaskImage: radialMask(0),
                    }
                  : undefined
              }
              animate={
                showReveal
                  ? {
                      maskImage: radialMask(MASK_FULL_PCT),
                      WebkitMaskImage: radialMask(MASK_FULL_PCT),
                    }
                  : undefined
              }
              transition={{ duration: VIEWER.revealS, ease: EASE_LUXE }}
              style={{ willChange: busy ? "mask-image" : "auto" }}
            >
              <Image
                src={step.src}
                alt={step.alt}
                fill
                priority={priority}
                sizes="(max-width: 768px) 100vw, 896px"
                className={step.fit === "contain" ? "object-contain" : "object-cover"}
                style={{ objectPosition: step.objectPosition }}
                onError={onImageError}
              />
            </motion.div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
