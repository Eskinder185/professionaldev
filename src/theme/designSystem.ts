import { cardLayout, cardTokens } from "./cardTokens";

/**
 * Roadmap to Role — design system (Apple Developer–inspired).
 *
 * IMPLEMENTATION MAP
 * -----------------
 * • Semantic colors & light/dark: `src/styles/tailwind.css` (`:root`, `.dark` / `:root:not(.light)`)
 * • Tailwind theme keys: `tailwind.config.js` (fontSize, spacing, radius, shadows, maxWidth)
 * • Cards: `cardTokens.ts` + `--card-*` CSS variables
 * • Global UI classes: `tailwind.css` `@layer components` (`.btn`, `.input`, `.surface`, `.section-label`)
 *
 * USAGE IN REACT
 * --------------
 * Prefer Tailwind utilities wired to tokens: `bg-canvas`, `text-ink-muted`, `rounded-ds-lg`, `shadow-ds-soft`.
 * Use `max-w-content` + horizontal padding for page shell; `py-section` / `py-section-sm` for vertical rhythm.
 * Icons: `lucide-react`, stroke ~1.75, sizes 16–24px for UI chrome.
 */

/** Semantic roles → use these Tailwind color keys (RGB from CSS vars). */
export const palette = {
  canvas: "canvas", // page background
  canvasSubtle: "canvas-subtle", // bands, wells
  ink: "ink", // primary text
  inkMuted: "ink-muted", // secondary text
  inkFaint: "ink-faint", // tertiary / placeholders
  accent: "accent", // links, primary actions, focus rings (sparingly)
  accentMuted: "accent-muted", // hover on accent
  graphite: "graphite", // neutral chrome; avoid rainbow accents
} as const;

/** Typography scale — map to `tailwind.config` fontSize keys. */
export const typeScale = {
  displayLg: "text-display-lg", // hero only
  display: "text-display",
  displaySm: "text-display-sm",
  title: "text-3xl font-semibold tracking-tight sm:text-4xl", // section titles (compose in JSX)
  titleSm: "text-2xl font-semibold tracking-tight sm:text-3xl",
  lead: "text-lead text-ink-muted",
  body: "text-body",
  caption: "text-caption uppercase tracking-[0.12em]", // + text-ink-muted for labels
  /** Eyebrow — prefer utility class `.section-label` from global CSS */
  sectionLabel: "section-label",
} as const;

/**
 * Spacing: 4px base. Tailwind defaults (1=4px) + project extensions.
 * Section vertical rhythm: `py-section` (5rem) / `py-section-sm` (3.5rem).
 */
export const space = {
  section: "py-section",
  sectionSm: "py-section-sm",
  gutter: "px-4 sm:px-6",
  stackSm: "space-y-3",
  stackMd: "space-y-4",
  stackLg: "space-y-6",
  gridGap: "gap-4 sm:gap-6",
} as const;

/** Radius — prefer Tailwind `rounded-ds-*` from config; cards use CSS vars. */
export const radius = {
  sm: "rounded-ds-sm",
  md: "rounded-ds-md",
  lg: "rounded-ds-lg",
  xl: "rounded-ds-xl",
  pill: "rounded-full",
} as const;

export const shadow = {
  soft: "shadow-ds-soft",
  softLg: "shadow-ds-soft-lg",
  nav: "shadow-ds-nav",
} as const;

/** Layout grid */
export const layout = {
  /** Main content column — 72rem max */
  maxWidth: "max-w-content",
  /** Readable copy width */
  prose: "max-w-prose",
  /** Standard page horizontal inset */
  pagePadding: "px-4 sm:px-6",
  /** Centered shell */
  container: "mx-auto w-full max-w-content px-4 sm:px-6",
} as const;

/** Buttons — use global `.btn` + modifier or `<Button />` */
export const button = {
  base: "btn",
  primary: "btn btn-primary",
  secondary: "btn",
  /** Text-style control */
  ghost: "btn-ghost",
} as const;

export const form = {
  input: "input",
  textarea: "textarea",
  chip: "chip",
} as const;

/** Motion — respect `prefers-reduced-motion` (global CSS collapses durations) */
export const motion = {
  ease: "ease-out-editorial", // CSS var on :root; Tailwind arbitrary: cubic-bezier(0.25,0.1,0.25,1)
  durationMs: { fast: 150, base: 280, slow: 450 },
  /** Prefer `motion-safe:` prefix on transforms / hovers */
  enter: "animate-fade-in-up",
  enterSubtle: "fade-up",
} as const;

/** Icons (Lucide) */
export const icon = {
  strokeWidth: 1.75,
  sizeSm: 16,
  sizeMd: 20,
  sizeLg: 24,
  /** Default chrome: ink, not accent — use accent only for active/progress states */
  className: "text-ink dark:text-white",
  classNameMuted: "text-ink-muted",
} as const;

export const designSystem = {
  palette,
  typeScale,
  space,
  radius,
  shadow,
  layout,
  button,
  form,
  motion,
  icon,
  cardLayout,
  cardTokens,
} as const;

export type DesignSystem = typeof designSystem;

export { cardLayout, cardTokens };
