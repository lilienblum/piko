import { defineConfig } from "@playwright/test";
import { assertIsolatedE2E } from "./scripts/e2e-config";
assertIsolatedE2E(process.env);
export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/setup.ts",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: process.env.PIKO_DASHBOARD_URL,
    headless: true,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
});
