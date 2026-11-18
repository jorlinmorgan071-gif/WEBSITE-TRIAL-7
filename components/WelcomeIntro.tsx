"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE_LUXE, HERO_SLIDES, INTRO_SEEN_KEY } from "@/lib/design-tokens";

/**
 * FEATURE A — Blur welcome intro (iPhone style).
 *
 * On first load per session a full-screen overlay covers the hero with a
 * heavy backdrop blur (~24px). The wordmark fades in with a slight upward
 * drift, holds ~2.8s, then the blur animates 24px -> 0 while the overlay
 * fades out, revealing the page underneath.
 *
 * - Tap/click anywhere skips the intro.
 * - Played once per session (sessionStorage, wrapped in try/catch because
 *   storage can throw in private windows / embedded webviews).
 * - prefers-reduced-motion: simple short fade, no blur or drift animation.
 * - While the intro shows, body scroll is locked via `overflow: hidden`.
 */

const INTRO_HOLD_MS = 2800; // time before the blur dissolves
const BLUR_FADE_MS = 1100; // blur 24px -> 0 dissolve duration

/** Read whether the intro already played this session. Safe for blocked storage. */
function hasSeenIntro(): boolean {
  try {
    return sessionStorage.getItem(INTRO_SEEN_KEY) === "1";
  } catch {
    return false; // storage unavailable: rather show it than loop it forever
  }
}

/** Mark the intro as played this session. Safe for blocked storage. */
function markIntroSeen(): void {
  try {
    sessionStorage.setItem(INTRO_SEEN_KEY, "1");
  } catch {
    /* ignore — private mode etc. */
  }
}

export default function WelcomeIntro() {
  const [show, setShow] = useState(false);
  // Start as "not ready" so the intro never flashes for returning sessions
  // (mounted check prevents hydration mismatch with sessionStorage).
  const [mounted, setMounted] = useState(false);
  const reducedMotion = useReducedMotion();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    setMounted(true);
    if (!hasSeenIntro()) {
      setShow(true);
      markIntroSeen();
    }
  }, []);

  // Lock page scroll while the intro overlay is visible.
  useEffect(() => {
    if (!show) return;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = prevOverflow;
    };
  }, [show]);

  const finish = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setShow(false);
  }, []);

  useEffect(() => {
    if (!show) return;
    // After the hold, dissolve the blur and fade the overlay away.
    timers.current.push(setTimeout(finish, INTRO_HOLD_MS));
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [show, finish]);

  // Don't render anything until we know the session state (avoids a
  // returning-session flash) — and render nothing once dismissed.
  if (!mounted || !show) return null;

  const hero = HERO_SLIDES[0]; // intro always shows the first hero image

  // Reduced motion: plain short fade, no blur / drift animation.
  const motionProps = reducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.4, ease: "linear" as const },
      }
    : {
        initial: { opacity: 0, backdropFilter: "blur(24px)" },
        animate: {
          opacity: 1,
          // Framer animates backdropFilter as a string interpolation.
          backdropFilter: "blur(24px)",
        },
        exit: {
          opacity: 0,
          backdropFilter: "blur(0px)",
        },
        transition: {
          opacity: { duration: 0.9, ease: EASE_LUXE },
          backdropFilter: { duration: BLUR_FADE_MS / 1000, ease: EASE_LUXE },
        },
      };

  return (
    <AnimatePresence>
      <motion.div
        key="welcome-intro"
        {...motionProps}
        // Tap or click anywhere skips the intro.
        onClick={finish}
        role="presentation"
        aria-label="Welcome intro — tap to skip"
        className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-background/60"
        style={{ backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}
      >
        {/* First hero image behind the blur — decorative, already loaded
            as the hero's priority image. */}
        <Image
          src={hero.src}
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          aria-hidden
        />
        {/* Warm dark veil so the gold text stays readable on any slide. */}
        <div className="absolute inset-0 bg-background/70" />

        {/* Centered wordmark: serif gold gradient, soft fade + upward drift. */}
        <div className="relative z-10 flex flex-col items-center px-6 text-center">
          <motion.p
            initial={{ opacity: 0, y: reducedMotion ? 0 : 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reducedMotion ? 0.4 : 1.1, ease: EASE_LUXE, delay: 0.15 }}
            className="font-serif text-gold-gradient text-4xl font-semibold tracking-wide sm:text-5xl md:text-6xl"
          >
            Welcome to Lake Flavour
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: reducedMotion ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reducedMotion ? 0.4 : 1.1, ease: EASE_LUXE, delay: 0.45 }}
            className="mt-4 font-sans text-sm uppercase tracking-[0.35em] text-muted sm:text-base"
          >
            Crisp. Golden. Straight from the lake.
          </motion.p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
