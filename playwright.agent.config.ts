import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4337';
export default defineConfig({
  testDir: 'e2e',
  testMatch: /(?:agent-api|geo|mcp-protocol)\.spec\.ts/,
  workers: 1,
  timeout: 60_000,
  use: { ...devices['Desktop Chrome'], baseURL },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 4337',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ASTRO_DEV_BACKGROUND: '0', E2E_DISABLE_HMR: '1' },
  },
});
