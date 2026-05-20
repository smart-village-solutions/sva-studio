import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:3002';

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/*.e2e.ts'],
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never', outputFolder: 'playwright-report' }], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm exec vite dev --host 0.0.0.0 --port 3002 --strictPort',
    cwd: '.',
    url: `${baseURL}/@vite/client`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
