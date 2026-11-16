import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const port = Number(env.VITE_DEV_PORT || 5173);
  const proxyTarget = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:4000";
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("VITE_DEV_PORT must be a valid port");
  if (!["http:", "https:"].includes(new URL(proxyTarget).protocol)) throw new Error("VITE_API_PROXY_TARGET must use HTTP(S)");
  return {
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["recharts"],
          forms: ["zod", "react-hook-form"],
          requests: ["axios", "@tanstack/react-query"],
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    proxy: {
      "/api": proxyTarget,
    },
  },
  };
});
