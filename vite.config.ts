import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8787",
      "/uploads": "http://localhost:8787",
      "/frames": "http://localhost:8787",
      "/journey.mp4": "http://localhost:8787",
      "/robots.txt": "http://localhost:8787",
      "/sitemap.xml": "http://localhost:8787",
    },
  },
  base: "/",
  build: {
    outDir: "dist",
  },
});
