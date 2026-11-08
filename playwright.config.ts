import { randomUUID } from "node:crypto";
import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start -- --port 3100",
    url: `${baseURL}/login`,
    env: {
      SESSION_COOKIE_SECURE: "false",
      REDIS_URL: process.env.REDIS_URL ?? "",
      REPORT_CACHE_NAMESPACE: `inventory-lab-e2e-${randomUUID()}`,
    },
  },
});
