import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/pwa', testMatch: '*.spec.ts', workers: 1, fullyParallel: false,
  timeout: 60_000, expect: { timeout: 10_000 }, outputDir: '.qa/pwa-results',
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4180', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1080 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: { command: 'node tests/pwa/server.mjs', url: 'http://127.0.0.1:4180', reuseExistingServer: false },
});
