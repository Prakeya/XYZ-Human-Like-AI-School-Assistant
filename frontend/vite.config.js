import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// XYZ AI frontend (Phase 4). Talks to the existing FastAPI backend from
// Phases 1-3 over HTTP -- see src/api.js for the single client that wraps it.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
