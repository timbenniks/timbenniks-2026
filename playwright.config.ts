import { defineConfig, devices } from '@playwright/test';
import { E2E_ADMIN_PASSWORD } from './e2e/constants';

const PORT = Number(process.env.E2E_PORT || 4321);
const BASE_URL = process.env.E2E_BASE_URL || `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      ADMIN_PASSWORD: E2E_ADMIN_PASSWORD,
      // See astro.config.ts — a warm-up full-reload wipes filled form fields.
      E2E_DISABLE_HMR: '1',
      // Avoid accidental publish/discard against a real repo during local runs
      // if the developer has these set in their shell.
      GITHUB_TOKEN: '',
      GITHUB_REPO: '',
    },
  },
});
