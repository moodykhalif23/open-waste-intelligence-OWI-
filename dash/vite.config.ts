import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Env (VITE_*) comes from the single repo-root .env. The API runs in Docker and
  // this frontend does not, so /api is proxied here in dev and preview; deployed
  // builds either sit behind a proxy or set VITE_API_URL to the API origin.
  const env = loadEnv(mode, "..", "");
  const proxy = {
    "/api": { target: env.OWI_API_PROXY || "http://127.0.0.1:8000", changeOrigin: true },
  };
  return {
    envDir: "..",
    server: { proxy },
    preview: { proxy },
    plugins: [react()],
  };
});
