/**
 * IIFE bundle for the autofill content script on application pages.
 */
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "content/autofill/runner.ts"),
      name: "FlintAutofillRunner",
      formats: ["iife"],
      fileName: () => "content/autofill-runner.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    target: "esnext",
  },
});
