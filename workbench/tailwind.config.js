/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        // Neutral engineering surface palette (slate-based, dark).
        panel: {
          DEFAULT: "#0f1419",
          raised: "#161c24",
          inset: "#0a0e13",
          border: "#232c38",
        },
        // Subsystem classification palette (Phase 6).
        sub: {
          hydraulic: "#3b82f6", // Blue
          screw: "#f97316", // Orange  (ScrewCheckRing)
          drive: "#22c55e", // Green
          heaters: "#eab308", // Yellow
          mold: "#a855f7", // Purple
          unknown: "#9ca3af", // Gray
        },
      },
    },
  },
  plugins: [],
};
