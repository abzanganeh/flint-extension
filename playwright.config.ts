import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    headless: false,
  },
  projects: [
    {
      name: "chromium-extension",
      use: {
        channel: "chromium",
      },
    },
  ],
});
