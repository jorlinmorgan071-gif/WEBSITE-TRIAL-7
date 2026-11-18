"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  EASE_LUXE,
  HERO_SLIDES,
  SLIDE_FADE_MS,
  SLIDE_INTERVAL_MS,
} from "@/lib/design-tokens";

/**
 * FEATURE B — Full-screen landing slides.
 *
 * - 100dvh hero, 6 slides, auto-advance every 6s, loops back after hero-6.
 * - Active slide crossfades (~1.4s) while a slow Ken Burns zoom runs
 *   (scale 1 -> 1.08). Only transform/opacity are animated.
 * - Autoplay pauses while the tab is hidden (visibilitychange).
 * - Only the next slide is preloaded (next <Image> mounts ahead of time).
 * - First slide uses priority; a failed image falls back to the dark
 *   background via onError (no broken-image icon: the img is unmounted).
 * - SCROLL FADE: scroll-linked opacity + gradient dissolve into #0A0A0A.
 */

const FADE_S = SLIDE_FADE_MS / 1000;
const ZOOM_S = (SLIDE_INTERVAL_MS + SLIDE_FADE_MS) / 1000; // Ken Burns span

/** One slide: crossfade + Ken Burns zoom. Animates transform/opacity only. */
function Slide({
  slide,
  index,
  active,
  priority,
  onImageError,
}: {
  slide: (typeof HERO_SLIDES)[number];
  index: number;
  active: boolean;
  priority: boolean;
  onImageError: (index: number) => void;
}) {
  return (
    <motion.div
      key={slide.src}
      // Crossfade: incoming slide fades in on top; outgoing fades out below.
      initial={false}
      animate={{
        opacity: active ? 1 : 0,
        scale: active ? 1.08 : 1,
      }}
      transition={{
        opacity: { duration: FADE_S, ease: EASE_LUXE },
        // Slow zoom across the whole slide's screen time.
        scale: { duration: ZOOM_S, ease: "linear" },
      }}
      className="absolute inset-0"
      aria-hidden={active ? undefined : true}
    >
      <Image
        src={slide.src}
        alt={active ? slide.alt : ""}
        fill
        priority={priority}
        loading={priority ? undefined : "lazy"}
        // Preload only the next slide: mount it just before its turn so the
        // browser fetches it, but keep it invisible (opacity 0 above).
        quality={85}
        sizes="100vw"
        className="object-cover"
        onError={() => onImageError(index)}
      />
    </motion.div>
  );
}

export default function LandingHero() {
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const reducedMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);

  // SCROLL FADE — hero opacity is linked to scroll through the first
  // viewport height: 1 at top -> 0 once scrolled past, plus a gradient
  // so the dissolve into the #0A0A0A page background has no hard cut.
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 600], [1, 0]);
  const gradientOpacity = useTransform(scrollY, [0, 600], [0.55, 1]);

  const next = (active + 1) % HERO_SLIDES.length;

  // Autoplay: advance every 6s; pause while the tab is hidden.
  useEffect(() => {
    if (reducedMotion) return; // no autoplay churn under reduced motion
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        setActive((i) => (i + 1) % HERO_SLIDES.length);
      }
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [reducedMotion]);

  // Preload only the next slide, shortly before it becomes active.
  useEffect(() => {
    const img = new window.Image();
    img.src = HERO_SLIDES[next].src;
  }, [next]);

  const markFailed = useCallback((index: number) => {
    setFailed((prev) => new Set(prev).add(index));
  }, []);

  // Smooth-scroll to the section below the hero (gold "Explore" button).
  const explore = useCallback(() => {
    document
      .getElementById("next-section")
      ?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  }, [reducedMotion]);

  return (
    <motion.section
      ref={sectionRef}
      style={{ opacity: heroOpacity }}
      className="relative h-[100dvh] w-full overflow-hidden bg-background"
      aria-label="Lake Flavour hero"
    >
      {/* Slides. Rendered: active, the fading-out previous one, and the
          preloaded next one — everything else stays unmounted. */}
      <AnimatePresence initial={false}>
        {HERO_SLIDES.map((slide, i) => {
          const isNear = i === active || i === (active - 1 + HERO_SLIDES.length) % HERO_SLIDES.length || i === next;
          if (!isNear || failed.has(i)) return null; // failed -> dark background fallback
          return (
            <Slide
              key={slide.src}
              slide={slide}
              index={i}
              active={i === active}
              priority={i === 0}
              onImageError={markFailed}
            />
          );
        })}
      </AnimatePresence>

      {/* Dark gradient overlay for text readability (deepens on scroll). */}
      <motion.div
        style={{ opacity: gradientOpacity }}
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/25 to-background/80" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/55 via-transparent to-background/30" />
      </motion.div>

      {/* Top-left gold wordmark. */}
      <div className="absolute left-5 top-5 z-10 sm:left-8 sm:top-8">
        <p className="font-serif text-gold-gradient text-xl font-semibold tracking-[0.18em] sm:text-2xl">
          Lake Flavour
        </p>
      </div>

      {/* Headline block. */}
      <div className="absolute inset-x-0 bottom-24 z-10 flex flex-col items-start gap-4 px-5 sm:bottom-28 sm:px-8 md:items-center md:text-center">
        <h1 className="max-w-3xl font-serif text-4xl font-semibold leading-tight text-cream sm:text-5xl md:text-6xl">
          The Taste of the Lake
        </h1>
        <p className="max-w-xl font-sans text-sm leading-relaxed text-cream/80 sm:text-base md:text-lg">
          Premium Fried Omena — hand-prepared, sun-dried and fried to a
          golden crisp. From Kenya&apos;s lakes straight to your table.
        </p>
        <button
          type="button"
          onClick={explore}
          className="rounded-sm border border-gold bg-gold/0 px-7 py-3 font-sans text-xs font-semibold uppercase tracking-[0.3em] text-gold transition-colors duration-300 ease-luxe hover:bg-gold hover:text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
        >
          Explore
        </button>
      </div>

      {/* Minimal gold line indicators. */}
      <div className="absolute inset-x-0 bottom-8 z-10 flex items-center justify-center gap-2.5">
        {HERO_SLIDES.map((slide, i) => (
          <button
            key={slide.src}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === active}
            onClick={() => setActive(i)}
            className="group p-1"
          >
            <span
              className={`block h-px transition-all duration-500 ease-luxe ${
                i === active ? "w-10 bg-gold" : "w-5 bg-cream/30 group-hover:bg-cream/60"
              }`}
            />
          </button>
        ))}
      </div>

      {/* Subtle animated scroll cue. */}
      <motion.div
        className="absolute inset-x-0 bottom-3 z-10 flex justify-center"
        aria-hidden
        animate={reducedMotion ? undefined : { y: [0, 6, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="block h-6 w-px bg-gradient-to-b from-transparent via-gold/70 to-transparent" />
      </motion.div>
    </motion.section>
  );
}
