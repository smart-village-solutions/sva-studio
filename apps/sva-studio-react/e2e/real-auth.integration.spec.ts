import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
  ROOT_AUTH_SESSION_FILE,
  getRootPlaywrightBaseUrl,
  loadPlaywrightEnv,
  resolveAuthSessionFile,
} from '../src/lib/playwright-auth-session-config';

const appRoot = fileURLToPath(new URL('../', import.meta.url));

loadPlaywrightEnv(appRoot);

const expectStudioShellReady = async (page: Page) => {
  await expect(page.getByRole('complementary', { name: 'Seitenleiste' })).toBeVisible();
  await expect(page.getByRole('banner')).toBeVisible();
};

const expectContentOverviewReady = async (page: Page) => {
  await expect(page).toHaveURL(/\/admin\/content(?:\?.*)?$/);
  await Promise.any([
    page.getByRole('heading', { name: 'Inhalte' }).waitFor({ state: 'visible' }),
    page.getByRole('table', { name: 'Inhalte' }).waitFor({ state: 'visible' }),
    page.getByText('Noch keine Inhalte vorhanden').waitFor({ state: 'visible' }),
  ]);
};

const expectInstancesOverviewReady = async (page: Page) => {
  await expect(page).toHaveURL(/\/admin\/instances(?:\?.*)?$/);
  await Promise.any([
    page.getByRole('heading', { name: 'Instanzen' }).waitFor({ state: 'visible' }),
    page.getByRole('link', { name: 'Instanz anlegen' }).waitFor({ state: 'visible' }),
    page.getByText('Es sind aktuell keine Instanzen vorhanden.').waitFor({ state: 'visible' }),
  ]);
};

test('tenant content overview loads with a real authenticated session', async ({ page }) => {
  await page.goto('/admin/content');
  await expectContentOverviewReady(page);
  await expectStudioShellReady(page);
});

test.describe('root control plane', () => {
  test.use({
    baseURL: getRootPlaywrightBaseUrl(process.env),
    storageState: resolveAuthSessionFile(appRoot, ROOT_AUTH_SESSION_FILE),
  });

  test('root instances overview loads with a real authenticated session', async ({ page }) => {
    await page.goto('/admin/instances');
    await expectInstancesOverviewReady(page);
    await expectStudioShellReady(page);
  });
});

test('tenant session loss redirects to the session-expired notice', async ({ page }) => {
  await page.goto('/admin/content');
  await expectContentOverviewReady(page);

  await page.context().clearCookies();
  await page.reload({ waitUntil: 'networkidle' });

  await expect(page).toHaveURL(/\/(?:\?auth=session-expired(?:&|$).*)?$/);
  await expect(page.getByText('Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Erneut anmelden' })).toBeVisible();
});

test('tenant content overview shows a robust error state when the content list request fails', async ({ page }) => {
  await page.route('**/api/v1/mainserver/events**', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'database_unavailable', error: 'database_unavailable' }),
    });
  });

  await page.goto('/admin/content');

  await expect(page.getByRole('heading', { name: 'Inhalte' })).toBeVisible();
  await expectStudioShellReady(page);
  await expect(page.getByText('Inhalte konnten nicht geladen werden.')).toBeVisible();
});
