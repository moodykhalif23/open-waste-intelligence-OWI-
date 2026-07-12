import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// HTTPS in dev: camera and geolocation are blocked in insecure contexts,
// and phone-on-LAN testing is the whole point of this spike.
export default defineConfig({
  envDir: "..",
  server: {
    // Same-origin /api avoids mixed-content blocking (HTTPS page → HTTP API)
    // and mirrors production, where one reverse proxy serves both.
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
  plugins: [
    react(),
    basicSsl(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "OpenWaste Intelligence",
        short_name: "OWI",
        description: "Collector field app",
        theme_color: "#15803d",
        background_color: "#ffffff",
        display: "standalone",
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml" }],
      },
    }),
  ],
});
