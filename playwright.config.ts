import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/smoke",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:3100",
    channel: "chrome",
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    env: { STATIC_SITE_ORIGIN: "https://static.example.test" },
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "phone", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "small-phone", use: { viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true } },
  ],
});
