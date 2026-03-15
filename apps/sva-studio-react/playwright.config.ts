import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const appRoot = fileURLToPath(new URL('./', import.meta.url));

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  outputDir: './test-results',
  reporter: process.env.CI ? [['html', { open: 'never', outputFolder: 'playwright-report' }], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    // Nested Nx inside Playwright's webServer was unstable in local dev and could
    // terminate the app mid-suite. Start the app-local dev script directly instead.
    command: 'pnpm dev',
    cwd: appRoot,
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
