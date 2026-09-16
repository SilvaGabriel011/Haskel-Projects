import { defineConfig } from "@playwright/test";

/**
 * End-to-end role separation.
 *
 * These exist because the role split had been verified by hand at every phase
 * but nothing kept it verified. The unit tests in tests/*.test.ts check the
 * query layer directly; these check what a browser actually receives, which is
 * the thing that matters if a page ever renders something the query withheld.
 *
 * Chromium is preinstalled at /opt/pw-browsers, so nothing is downloaded.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // they share one seeded database
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 45_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3111",
    trace: "retain-on-failure",
  },
});
