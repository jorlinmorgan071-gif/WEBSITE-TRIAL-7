/**
 * STEP 2 VIEWER — motion timings shared by the card, ambient background
 * and fullscreen viewer so every layer changes step in lockstep.
 *
 * FEATHERED-FOCUS REVEAL (the signature move): a blurred copy of the
 * incoming step sits underneath; a sharp copy on top is revealed through
 * a radial mask that expands from the centre with a soft feathered edge
 * (mask-image grows 0 -> 150%). The image therefore "clears" from the
 * middle outwards. The mask runs on the sharp layer only — cheap on the
 * compositor (no repaints, just a promoted layer clip).
 */
import { EASE_LUXE } from "./design-tokens";

/** Radial mask size where the sharp layer is fully revealed. */
export const MASK_FULL = "150vmax";
/** Same value as a number (percent) for JS-driven interpolation. */
export const MASK_FULL_PCT = 150;

export const VIEWER = {
  /** Feathered-focus reveal duration (1.1-1.4s band -> 1.25s). */
  revealS: 1.25,
  /** Outgoing layer fade + zoom duration. */
  exitS: 0.6,
  /** Zoom the incoming blurred base starts at. */
  enterScale: 1.12,
  /** Zoom the outgoing layer eases out at. */
  exitScale: 1.06,
  /** Horizontal drift for direction-aware motion (px). */
  driftPx: 24,
  /** Initial blur of the incoming base layer (px). */
  enterBlurPx: 14,
} as const;

/** Shared ease re-exported so the viewer files import one module. */
export { EASE_LUXE };
