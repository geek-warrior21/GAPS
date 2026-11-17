import { defineConfig, devices } from "@playwright/test";

const DEV_TOOLS_SPEC = /(dev-tools|open-topic)\.spec\.ts/;
// Next allows dev-server assets only from its own origin, which is localhost.
const DEV_SERVER_URL = "http://localhost:3101";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  projects: [
    // Student journeys run against the production build.
    {
      name: "Desktop Chrome",
      testIgnore: DEV_TOOLS_SPEC,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile Chrome",
      testIgnore: DEV_TOOLS_SPEC,
      use: { ...devices["Pixel 7"] },
    },
    // Developer tools are disabled in the production build, so their journeys
    // run against a development server with the tools explicitly enabled.
    // Pages and routes compile on first use there, hence the longer timeouts.
    {
      name: "Dev Server (developer tools, open topics)",
      testMatch: DEV_TOOLS_SPEC,
      timeout: 120000,
      expect: { timeout: 30000 },
      use: { ...devices["Desktop Chrome"], baseURL: DEV_SERVER_URL },
    },
  ],
  webServer: [
    {
      command: "PORT=3100 node .next/standalone/apps/web/server.js",
      url: "http://127.0.0.1:3100/api/v1/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
      env: {
        PLAYWRIGHT_TEST: "1",
      },
    },
    {
      command: "pnpm exec next dev --port 3101",
      url: `${DEV_SERVER_URL}/api/v1/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        DEV_TOOLS_ENABLED: "true",
        // Open-topic journeys use the mock provider here. It proves the wiring
        // and the player, not that a real model can teach.
        LLM_PROVIDER: "mock",
        AI_ZDR_CONFIRMED: "true",
        // The student-facing any-topic entry is off by default. It is switched
        // on here so its consent controls can be exercised in a browser.
        OPEN_TOPIC_STUDENT_ENTRY: "true",
      },
    },
  ],
});
