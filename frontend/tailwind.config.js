/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#14213D",
          light: "#24344F",
          text: "#1B2130",
        },
        paper: {
          DEFAULT: "#F4F2ED",
          alt: "#EAE7DE",
        },
        marigold: {
          DEFAULT: "#E6A23C",
          deep: "#C97F1E",
        },
        line: "#DAD5C8",
        muted: "#6B7280",
        success: "#3F7D58",
        danger: "#B23A48",
        role: {
          student: "#3E7CB1",
          parent: "#A65D3E",
          teacher: "#4F6F52",
          principal: "#5B4B8A",
        },
      },
      // Each Noto Sans <Script> family only contains glyphs for that one
      // script, so listing all of them is safe: for any given character the
      // browser walks the stack and uses the first font that actually has a
      // glyph for it. English text still renders in Fraunces/Inter (the
      // Noto fonts are simply skipped, since they have no Latin glyphs of
      // their own to prefer); Hindi/Marathi resolve to Noto Sans Devanagari,
      // Tamil to Noto Sans Tamil, Urdu to Noto Sans Arabic, etc. -- so every
      // language gets consistently shaped native glyphs instead of an
      // unpredictable OS fallback.
      fontFamily: {
        display: [
          "Fraunces",
          "Noto Sans Devanagari", "Noto Sans Tamil", "Noto Sans Telugu",
          "Noto Sans Bengali", "Noto Sans Gujarati", "Noto Sans Gurmukhi",
          "Noto Sans Kannada", "Noto Sans Malayalam", "Noto Sans Arabic",
          "serif",
        ],
        body: [
          "Inter",
          "Noto Sans Devanagari", "Noto Sans Tamil", "Noto Sans Telugu",
          "Noto Sans Bengali", "Noto Sans Gujarati", "Noto Sans Gurmukhi",
          "Noto Sans Kannada", "Noto Sans Malayalam", "Noto Sans Arabic",
          "system-ui", "sans-serif",
        ],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      keyframes: {
        breathe: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.06)" },
        },
        listenbar: {
          "0%, 100%": { transform: "scaleY(0.3)" },
          "50%": { transform: "scaleY(1)" },
        },
        mouthtalk: {
          "0%, 100%": { transform: "scaleY(0.35)" },
          "25%": { transform: "scaleY(1)" },
          "50%": { transform: "scaleY(0.55)" },
          "75%": { transform: "scaleY(0.9)" },
        },
        eyeshift: {
          "0%, 100%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(2px)" },
        },
        errorshake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-2px)" },
          "40%": { transform: "translateX(2px)" },
          "60%": { transform: "translateX(-2px)" },
          "80%": { transform: "translateX(2px)" },
        },
      },
      animation: {
        breathe: "breathe 2.6s ease-in-out infinite",
        listenbar: "listenbar 0.7s ease-in-out infinite",
        mouthtalk: "mouthtalk 0.42s ease-in-out infinite",
        eyeshift: "eyeshift 3.2s ease-in-out infinite",
        errorshake: "errorshake 0.5s ease-in-out 1",
      },
    },
  },
  plugins: [],
};
