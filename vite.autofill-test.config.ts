/**
 * IIFE bundle for Playwright autofill e2e — exposes fillGreenhouse on window.
 */
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    outDir: "tests/e2e/generated",
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "content/autofill/browser-harness.ts"),
      name: "FlintAutofillTest",
      formats: ["iife"],
      fileName: () => "autofill-test-harness.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    target: "esnext",
  },
});
