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
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["Inter", "system-ui", "sans-serif"],
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
      },
      animation: {
        breathe: "breathe 2.6s ease-in-out infinite",
        listenbar: "listenbar 0.7s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
