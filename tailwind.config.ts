import type { Config } from "tailwindcss";

/**
 * Lake Flavour design system.
 * Colors, fonts and easing live here as tokens so every later step
 * (Steps 2-5) reuses the same values without duplicating styles.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0A0A0A", // near-black page background
        surface: "#141210", // raised panels / cards
        gold: {
          DEFAULT: "#C9A24B", // primary gold accent
          light: "#E6C877", // highlight gold (gradients, hovers)
          deep: "#8F7230", // pressed / shadow gold
        },
        cream: "#F3EDE0", // warm off-white body text
        muted: "#A89F8C", // secondary text
      },
      fontFamily: {
        // CSS variables are injected by next/font in app/layout.tsx
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      transitionTimingFunction: {
        // Standard site easing: easeOutQuint-like
        luxe: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
