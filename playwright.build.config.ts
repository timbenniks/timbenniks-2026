import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  testMatch: /(?:cdn-routing|agent-api|geo|mcp-protocol)\.spec\.ts/,
  workers: 1,
  timeout: 60_000,
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4338' },
  webServer: {
    command: 'node scripts/preview-vercel.mjs',
    url: 'http://127.0.0.1:4338',
    reuseExistingServer: false,
  },
});
