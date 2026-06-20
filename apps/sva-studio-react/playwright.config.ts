import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

import {
  DE_MUSTERHAUSEN_AUTH_SESSION_FILE,
  getDeMusterhausenPlaywrightBaseUrl,
  loadPlaywrightEnv,
  resolveAuthSessionFile,
} from './src/lib/playwright-auth-session-config';

const appRoot = fileURLToPath(new URL('./', import.meta.url));
loadPlaywrightEnv(appRoot);

const baseURL = getDeMusterhausenPlaywrightBaseUrl(process.env);
const webServerReadyURL = new URL('/@vite/client', baseURL).toString();
const parsedBaseURL = new URL(baseURL);
const webServerPort = parsedBaseURL.port || (parsedBaseURL.protocol === 'https:' ? '443' : '80');
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === 'true';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  // The dev SSR server is a single shared process; concurrent cold navigations
  // can abort requests during Nitro startup and make the suite flaky.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  outputDir: './test-results',
  reporter: process.env.CI ? [['html', { open: 'never', outputFolder: 'playwright-report' }], ['list']] : 'list',
  globalSetup: './e2e/global-setup.ts',
  projects: [
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      dependencies: ['auth-setup'],
      testIgnore: /auth\.setup\.ts/,
      use: {
        storageState: resolveAuthSessionFile(appRoot, DE_MUSTERHAUSEN_AUTH_SESSION_FILE),
      },
    },
    {
      name: 'firefox-smoke',
      dependencies: ['auth-setup'],
      testMatch: /real-auth\.cross-browser\.spec\.ts/,
      use: {
        browserName: 'firefox',
        storageState: resolveAuthSessionFile(appRoot, DE_MUSTERHAUSEN_AUTH_SESSION_FILE),
      },
    },
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    // Start Vite directly to avoid nested Nx instability during Playwright startup.
    command: `sh ./scripts/playwright-webserver.sh ${webServerPort}`,
    cwd: appRoot,
    // Probe a Vite-served asset first; app-route readiness is gated in global setup
    // to avoid hitting Nitro SSR before Vite has initialized its dev environment.
    url: webServerReadyURL,
    // Reusing arbitrary local processes can hide real failures by attaching to the wrong app.
    reuseExistingServer,
    timeout: 300_000,
  },
});
