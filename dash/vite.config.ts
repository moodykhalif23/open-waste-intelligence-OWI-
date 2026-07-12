import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Env (VITE_*) comes from the single repo-root .env; /api is same-origin,
  // proxied in dev and served by the reverse proxy in production.
  envDir: "..",
  server: {
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
  plugins: [react()],
});
