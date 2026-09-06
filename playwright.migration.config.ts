import { defineConfig, devices } from '@playwright/test';

if (!process.env.E2E_BASE_URL) {
  throw new Error('Set E2E_BASE_URL to a production build or preview deployment (not astro dev).');
}

export default defineConfig({
  testDir: 'e2e',
  testMatch: /migration\.spec\.ts/,
  workers: 2,
  timeout: 60_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.E2E_BASE_URL,
    screenshot: 'only-on-failure',
  },
});
