import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const appRoot = fileURLToPath(new URL('./', import.meta.url));
const configuredPort = process.env.PLAYWRIGHT_PORT ?? '3000';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${configuredPort}`;
const parsedBaseURL = new URL(baseURL);
const webServerPort = parsedBaseURL.port || (parsedBaseURL.protocol === 'https:' ? '443' : '80');
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === 'true';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  outputDir: './test-results',
  reporter: process.env.CI ? [['html', { open: 'never', outputFolder: 'playwright-report' }], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    // Start Vite directly to avoid nested Nx instability during Playwright startup.
    command: `pnpm exec vite dev --port ${webServerPort}`,
    cwd: appRoot,
    url: baseURL,
    // Reusing arbitrary local processes can hide real failures by attaching to the wrong app.
    reuseExistingServer,
    timeout: 300_000,
  },
});
