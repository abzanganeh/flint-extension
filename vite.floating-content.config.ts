/**
 * IIFE bundle for the floating panel shell content script (FAB + drawer).
 *
 * Same rationale as vite.content.config.ts: chrome.scripting.executeScript
 * and declarative manifest content_scripts both load classic scripts, so
 * this must build as a self-contained IIFE, not an ES module.
 */
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "content/floating/runner.ts"),
      name: "FlintFloatingShell",
      formats: ["iife"],
      fileName: () => "content/floating-shell.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    target: "esnext",
  },
});
