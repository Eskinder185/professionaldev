/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:"#eff8ff",100:"#dff1ff",200:"#bce2ff",300:"#92d0ff",
          400:"#60b4ff",500:"#3a98ff",600:"#2877e0",700:"#205fbb",
          800:"#1d4f97",900:"#1d447b"
        },
        primary: "#f97316",
        secondary: "#3b82f6",
        tertiary: "#a855f7"
      },
      borderRadius: {
        xl: "1rem",
        '2xl': "1.25rem"
      },
      boxShadow: {
        'glass': "0 10px 30px rgba(0,0,0,.25)",
        'inner-glow': "inset 0 0 0 1px rgba(255,255,255,.08)"
      },
      backgroundImage: {
        'grain': "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/></filter><rect width=%2240%22 height=%2240%22 filter=%22url(%23n)%22 opacity=%220.06%22/></svg>')"
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "fade-in-up": "fadeInUp 0.8s ease-out forwards",
        "fade-in": "fadeIn 0.8s ease-out forwards",
      },
    },
  },
  plugins: [],
}
