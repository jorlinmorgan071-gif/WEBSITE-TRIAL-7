/**
 * Shared design tokens and helpers for the whole site.
 * Single source of truth — import from here instead of redefining
 * values in components (Steps 2-5 plug into these too).
 */

/** Standard easing used by every animation on the site. */
export const EASE_LUXE: [number, number, number, number] = [
  0.22, 1, 0.36, 1,
];

/** sessionStorage flag: intro has played this session. */
export const INTRO_SEEN_KEY = "lakeflavour-intro-seen";

/** Landing hero slides, in order. Sizes are pre-converted WebP in
 *  /public/images/landing (1920px desktop, 960px mobile). */
export interface HeroSlide {
  src: string;
  srcMobile: string;
  alt: string;
}

export const HERO_SLIDES: HeroSlide[] = [
  {
    src: "/images/landing/hero-1.webp",
    srcMobile: "/images/landing/hero-1-960.webp",
    alt: "A bag of Lake Flavour fried omena standing on a wooden board",
  },
  {
    src: "/images/landing/hero-2.webp",
    srcMobile: "/images/landing/hero-2-960.webp",
    alt: "Five bags of Lake Flavour fried omena together on a wooden board",
  },
  {
    src: "/images/landing/hero-3.webp",
    srcMobile: "/images/landing/hero-3-960.webp",
    alt:
      "Bag of fried omena with onions, tomatoes, coriander and lettuce on a wooden board",
  },
  {
    src: "/images/landing/hero-4.webp",
    srcMobile: "/images/landing/hero-4-960.webp",
    alt: "Bag of fried omena beside a steaming plate of ugali and stew",
  },
  {
    src: "/images/landing/hero-5.webp",
    srcMobile: "/images/landing/hero-5-960.webp",
    alt: "Bag of fried omena with a chef, knife and chillies in the kitchen",
  },
  {
    src: "/images/landing/hero-6.webp",
    srcMobile: "/images/landing/hero-6-960.webp",
    alt: "A raw pile of crispy fried omena on a wooden board",
  },
];

/** Autoplay interval between slides (ms). */
export const SLIDE_INTERVAL_MS = 6000;

/** Crossfade duration between slides (ms) — matches Framer variants. */
export const SLIDE_FADE_MS = 1400;
