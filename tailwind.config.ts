import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      /* ── Colour palette ─────────────────────────────────── */
      colors: {
        ink: "#050507",         // page background
        panel: "#08080c",       // card / code-block inner bg
      },

      /* ── Font stacks (loaded via next/font in layout.tsx) ─ */
      fontFamily: {
        sans:  ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-instrument-serif)", "Georgia", "serif"],
        mono:  ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },

      /* ── Box shadow ─────────────────────────────────────── */
      boxShadow: {
        glow:      "0 0 80px -20px rgba(99,102,241,0.4)",
        "glow-sm": "0 0 40px -10px rgba(99,102,241,0.3)",
        "glow-cta": "0 0 50px -5px rgba(255,255,255,0.6)",
      },

      /* ── Keyframes ──────────────────────────────────────── */
      keyframes: {
        reveal: {
          "0%":   { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%":      { transform: "translateY(-12px)" },
        },
        "pulse-ring": {
          "0%":   { transform: "scale(0.9)", opacity: "0.7" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        flow: {
          to: { strokeDashoffset: "0" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "glitch-fracture": {
          "0%": { transform: "translate(0)", opacity: "1" },
          "20%": { transform: "translate(-2px, 1px)", opacity: "0.9" },
          "40%": { transform: "translate(2px, -1px)", opacity: "0.8", filter: "hue-rotate(90deg)" },
          "60%": { transform: "translate(-1px, 2px)", opacity: "0.9", filter: "hue-rotate(-90deg)" },
          "80%": { transform: "translate(1px, -2px)", opacity: "0.8" },
          "100%": { transform: "translate(0)", opacity: "1" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.5", filter: "brightness(1)" },
          "50%": { opacity: "1", filter: "brightness(1.3)" },
        }
      },

      /* ── Animations ─────────────────────────────────────── */
      animation: {
        reveal:      "reveal 1s cubic-bezier(0.16,1,0.3,1) forwards",
        float:       "float 6s ease-in-out infinite",
        "pulse-ring": "pulse-ring 3s cubic-bezier(0.4,0,0.6,1) infinite",
        flow:        "flow 1s linear infinite",
        shimmer:     "shimmer 2s infinite",
        "glitch-fracture": "glitch-fracture 0.4s ease-in-out",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
