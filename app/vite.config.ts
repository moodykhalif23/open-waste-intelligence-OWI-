import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// HTTPS by default for phone testing over LAN; localhost can use HTTP for previews.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "..", "");
  const httpPreview = mode === "preview-http";
  const proxy = {
    "/api": { target: env.OWI_API_PROXY || "http://127.0.0.1:8000", changeOrigin: true },
  };
  return {
    envDir: "..",
    server: { proxy },
    preview: { proxy },
    plugins: [
      react(),
      ...(!httpPreview ? [basicSsl()] : []),
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
