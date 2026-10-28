import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "..", "");
  const proxy = {
    "/api": { target: env.OWI_API_PROXY || "http://127.0.0.1:8000", changeOrigin: true },
    "/tiles": {
      target: env.OWI_TILES_PROXY || "http://127.0.0.1:8081",
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/tiles/, ""),
    },
  };
  return {
    envDir: "..",
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    server: { proxy },
    preview: { proxy },
    plugins: [vue()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            echarts: ["echarts/core", "echarts/charts", "echarts/components", "echarts/renderers"],
            leaflet: ["leaflet", "protomaps-leaflet"],
          },
        },
      },
    },
  };
});
