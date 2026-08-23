import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--ma-bg) / <alpha-value>)",
        surface: "rgb(var(--ma-surface) / <alpha-value>)",
        "surface-muted": "rgb(var(--ma-surface-muted) / <alpha-value>)",
        ink: "rgb(var(--ma-ink) / <alpha-value>)",
        "ink-soft": "rgb(var(--ma-muted) / <alpha-value>)",
        line: "rgb(var(--ma-line) / <alpha-value>)",
        accent: "rgb(var(--ma-accent) / <alpha-value>)",
        "accent-strong": "rgb(var(--ma-accent-strong) / <alpha-value>)",
        "accent-soft": "rgb(var(--ma-accent-soft) / <alpha-value>)",
        ok: "rgb(var(--ma-ok) / <alpha-value>)",
        warn: "rgb(var(--ma-warn) / <alpha-value>)",
        danger: "rgb(var(--ma-danger) / <alpha-value>)",
        night: "rgb(var(--ma-night) / <alpha-value>)",
        "night-card": "rgb(var(--ma-night-card) / <alpha-value>)",
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        soft: "0 1px 2px rgb(28 25 23 / 0.04), 0 4px 16px rgb(28 25 23 / 0.06)",
        lift: "0 2px 4px rgb(28 25 23 / 0.05), 0 12px 32px rgb(28 25 23 / 0.10)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 0.3s ease-out both",
        "scale-in": "scale-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both",
        "pulse-soft": "pulse-soft 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
