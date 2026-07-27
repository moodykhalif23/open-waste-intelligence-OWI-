import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// HTTPS in dev: camera and geolocation are blocked in insecure contexts,
// and phone-on-LAN testing is the whole point of this spike.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "..", "");
  // Same-origin /api avoids mixed-content blocking (HTTPS page → HTTP API) and
  // keeps the API reachable while it runs in Docker and this app does not.
  // Preview gets the same proxy: no reverse proxy fronts the built app anymore.
  const proxy = {
    "/api": { target: env.OWI_API_PROXY || "http://127.0.0.1:8000", changeOrigin: true },
  };
  return {
    envDir: "..",
    server: { proxy },
    preview: { proxy },
    plugins: [
      react(),
      basicSsl(),
      VitePWA({
        registerType: "autoUpdate",
        // We register the SW ourselves (guarded) so an untrusted-cert failure on a
        // LAN pilot degrades to "no offline" instead of an uncaught SecurityError.
        injectRegister: false,
        manifest: {
          name: "OpenWaste Intelligence",
          short_name: "OWI",
          description: "Collector field app",
          theme_color: "#101828",
          background_color: "#ffffff",
          display: "standalone",
          icons: [
            { src: "icon.svg", sizes: "any", type: "image/svg+xml" },
            { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
            { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
      }),
    ],
  };
});
