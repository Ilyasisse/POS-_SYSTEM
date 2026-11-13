import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  retries: 0,
  timeout: 90_000,
  outputDir: "test-results/workflows",
  expect: { timeout: 15_000 },
  grep: process.env.CAFE_POS_TEST_SCOPE === "core" ? /@core/ : undefined,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.CAFE_POS_TEST_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    launchOptions: {
      args: ["--host-resolver-rules=EXCLUDE 127.0.0.1, EXCLUDE localhost, MAP * ~NOTFOUND"],
    },
  },
});
