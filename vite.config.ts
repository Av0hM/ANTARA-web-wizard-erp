import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const reactPdfRequire = createRequire(require.resolve("react-pdf"));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{
      find: /^antara-pdf-worker\?url$/,
      replacement: reactPdfRequire.resolve("pdfjs-dist/build/pdf.worker.min.mjs") + "?url",
    }],
  },
  server: {
    proxy: {
      "/api": "http://localhost:8787",
      "/uploads": "http://localhost:8787",
      "/frames": "http://localhost:8787",
      "/robots.txt": "http://localhost:8787",
      "/sitemap.xml": "http://localhost:8787",
    },
  },
  base: "/",
  build: {
    outDir: "dist",
  },
});
