import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const chromiumExecutablePath =
  process.env.CHROMIUM_EXECUTABLE_PATH ?? (existsSync("/snap/bin/chromium") ? "/snap/bin/chromium" : undefined);

export default defineConfig({
  testDir: "tests/playwright",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:5177",
    trace: "retain-on-failure"
  },
  webServer: [
    {
      command: "rm -f .run/playwright-api-state.json && PORT=4301 SPATIAL_SPRAY_DATA_FILE=.run/playwright-api-state.json pnpm serve:api",
      url: "http://127.0.0.1:4301/health",
      reuseExistingServer: !process.env.CI,
      timeout: 20_000
    },
    {
      command: "VITE_API_URL=http://127.0.0.1:4301 pnpm serve:web",
      url: "http://127.0.0.1:5177",
      reuseExistingServer: !process.env.CI,
      timeout: 20_000
    }
  ],
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : undefined
      }
    }
  ]
});
