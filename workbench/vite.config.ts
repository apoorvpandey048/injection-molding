import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// The workbench is designed to be served behind a Cloudflare Tunnel during
// collaborative review sessions (see Phase 8 of the implementation plan), so the
// dev server and the production `preview` server both listen on all interfaces
// and accept the rotating *.trycloudflare.com hostnames. Never assume localhost.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: true,
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
