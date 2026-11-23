import { defineConfig, devices } from "@playwright/test";

// End-to-end suite: a production build on port 3200 with its own freshly
// seeded database (data/e2e.db), driven through the locally installed Chrome.
// Chat tests call the real LLM configured in .env, so they run one at a time.
const PORT = 3200;

export default defineConfig({
  testDir: "e2e",
  timeout: 150_000,
  expect: { timeout: 60_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `npx tsx scripts/seed.ts --fresh && npx next build --webpack && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 600_000,
    stdout: "pipe",
    env: { COLLEGE_DB_PATH: "data/e2e.db", NEXT_DIST_DIR: ".next-e2e", ADMIN_PASSCODE: "" },
  },
});
