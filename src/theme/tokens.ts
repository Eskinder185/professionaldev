/**
 * Legacy numeric tokens — Apple-inspired editorial system.
 * Full system map: `designSystem.ts` + barrel `theme/index.ts`.
 * Colors & motion: `tailwind.css` `:root` / dark. Cards: `cardTokens.ts` + `--card-*`.
 */
export const tokens = {
  radius: {
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
  },
  spacing: {
    sectionY: "5rem", // py-20
    sectionYGutter: "3.5rem", // py-14 mobile
    gutterX: "1.5rem",
    maxContent: "72rem", // max-w-6xl
    prose: "40rem",
  },
  motion: {
    ease: "cubic-bezier(0.25, 0.1, 0.25, 1)",
    duration: "0.28s",
    fadeDistance: "10px",
  },
  shadow: {
    soft: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
    softDark: "0 1px 2px rgba(0,0,0,0.2), 0 12px 40px rgba(0,0,0,0.35)",
    nav: "0 1px 0 rgba(0,0,0,0.06)",
  },
} as const;

export type DesignTokens = typeof tokens;
