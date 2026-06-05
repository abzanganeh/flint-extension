import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: "manifest.json", dest: "." },
        { src: "content/jd-selectors.json", dest: "content" },
        { src: "icons/*", dest: "icons" },
        { src: "popup/popup.css", dest: "popup" },
      ],
    }),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup/index.html"),
        "service-worker": resolve(__dirname, "background/service-worker.ts"),
        "jd-extractor": resolve(__dirname, "content/jd-extractor.ts"),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "service-worker") return "background/service-worker.js";
          if (chunk.name === "jd-extractor") return "content/jd-extractor.js";
          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: (asset) => {
          if (asset.name?.endsWith(".css")) return "popup/popup.css";
          return "assets/[name][extname]";
        },
      },
    },
    // Service workers must not be chunked.
    target: "esnext",
  },
  define: {
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify(
      process.env.VITE_API_BASE_URL ?? "http://localhost:8000",
    ),
  },
});
