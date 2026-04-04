/**
 * Editorial layout tokens — flat surfaces, dividers, no card frames.
 */
export const cardTokens = {
  cssVar: {
    radius: "--card-radius",
    radiusLg: "--card-radius-lg",
    border: "--card-border",
    bg: "--card-bg",
    bgMuted: "--card-bg-muted",
    shadow: "--card-shadow",
    shadowHover: "--card-shadow-hover",
    pad: "--card-pad",
    padLg: "--card-pad-lg",
  },
  padding: {
    sm: "1.25rem",
    md: "1.5rem",
    lg: "2rem",
    xl: "2.5rem",
  },
  radius: {
    md: "0",
    lg: "0",
  },
  motion: {
    durationMs: 200,
    easing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
  },
} as const;

/** Flat “surfaces”: no border radius, shadow, or heavy borders */
export const cardLayout = {
  surface: "border-0 bg-transparent shadow-none rounded-none",
  surfaceMuted: "border-0 bg-black/[0.02] shadow-none rounded-none dark:bg-white/[0.02]",
  radiusMd: "rounded-none",
  radiusLg: "rounded-none",
  interactive:
    "motion-safe:transition-colors motion-safe:duration-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]",
  focusRing:
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tw-accent))]",
} as const;
