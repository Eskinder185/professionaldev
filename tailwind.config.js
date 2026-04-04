/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"SF Pro Display"',
          '"Segoe UI"',
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      /**
       * Typography — tight display tracking; body tuned for long reading.
       * Pair with semantic colors: text-ink, text-ink-muted, text-ink-faint.
       */
      fontSize: {
        "display-lg": ["3.75rem", { lineHeight: "1.02", letterSpacing: "-0.04em", fontWeight: "600" }],
        display: ["3rem", { lineHeight: "1.05", letterSpacing: "-0.035em", fontWeight: "600" }],
        "display-sm": ["2.25rem", { lineHeight: "1.1", letterSpacing: "-0.03em", fontWeight: "600" }],
        title: ["1.875rem", { lineHeight: "1.15", letterSpacing: "-0.03em", fontWeight: "600" }],
        "title-sm": ["1.5rem", { lineHeight: "1.2", letterSpacing: "-0.025em", fontWeight: "600" }],
        lead: ["1.125rem", { lineHeight: "1.55", letterSpacing: "-0.01em", fontWeight: "400" }],
        body: ["1rem", { lineHeight: "1.6", letterSpacing: "-0.01em", fontWeight: "400" }],
        caption: ["0.8125rem", { lineHeight: "1.45", letterSpacing: "0.02em", fontWeight: "500" }],
        micro: ["0.6875rem", { lineHeight: "1.4", letterSpacing: "0.08em", fontWeight: "600" }],
      },
      colors: {
        canvas: {
          DEFAULT: "rgb(var(--tw-canvas) / <alpha-value>)",
          subtle: "rgb(var(--tw-canvas-subtle) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--tw-ink) / <alpha-value>)",
          muted: "rgb(var(--tw-ink-muted) / <alpha-value>)",
          faint: "rgb(var(--tw-ink-faint) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--tw-accent) / <alpha-value>)",
          muted: "rgb(var(--tw-accent-muted) / <alpha-value>)",
        },
        graphite: {
          DEFAULT: "rgb(var(--tw-graphite) / <alpha-value>)",
          600: "#424245",
          700: "#2d2d2f",
        },
        brand: {
          50: "#eff8ff",
          100: "#dff1ff",
          200: "#bce2ff",
          300: "#92d0ff",
          400: "#60b4ff",
          500: "#3a98ff",
          600: "#2877e0",
          700: "#205fbb",
          800: "#1d4f97",
          900: "#1d447b",
        },
        primary: "#6d28d9",
        secondary: "#57516d",
        tertiary: "#7c3aed",
      },
      maxWidth: {
        content: "72rem",
        prose: "40rem",
        narrow: "28rem",
      },
      /** Section rhythm + 4px-aligned scale extensions */
      spacing: {
        section: "5rem",
        "section-sm": "3.5rem",
        18: "4.5rem",
        22: "5.5rem",
      },
      /** Design-system radius names — use with buttons, inputs, small cards */
      borderRadius: {
        "ds-sm": "0.375rem",
        "ds-md": "0.625rem",
        "ds-lg": "1rem",
        "ds-xl": "1.25rem",
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        "soft-lg": "var(--shadow-soft-lg)",
        nav: "var(--shadow-nav)",
        "ds-soft": "var(--shadow-soft)",
        "ds-soft-lg": "var(--shadow-soft-lg)",
        "ds-nav": "var(--shadow-nav)",
        "ds-inner": "var(--shadow-inner)",
      },
      backgroundImage: {
        grain:
          "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.75%22 numOctaves=%223%22 stitchTiles=%22stitch%22/></filter><rect width=%2240%22 height=%2240%22 filter=%22url(%23n)%22 opacity=%220.022%22/></svg>')",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "fade-in-up": "fadeInUp 0.6s var(--ease-out-editorial, cubic-bezier(0.25,0.1,0.25,1)) both",
        "fade-in": "fadeIn 0.45s ease both",
      },
    },
  },
  plugins: [],
};
