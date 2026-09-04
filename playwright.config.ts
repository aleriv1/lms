import { defineConfig } from "@playwright/test";

import { serverEnv } from "./e2e/global-setup";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  retries: 0,
  use: {
    browserName: "chromium",
    baseURL: "http://localhost:5273",
    trace: "retain-on-failure",
    screenshot: "off",
    video: "off",
  },
  webServer: [
    {
      command: "node server/dist/index.js",
      port: 4100,
      env: serverEnv,
      reuseExistingServer: false,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      command: "npm run dev -w client -- --port 5273 --strictPort",
      url: "http://localhost:5273",
      env: { VITE_API_URL: "http://localhost:4100/api" },
      reuseExistingServer: false,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
});
