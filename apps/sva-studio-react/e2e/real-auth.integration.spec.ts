import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
  ROOT_AUTH_SESSION_FILE,
  hasDeMusterhausenAuthSetupCredentials,
  hasRootAuthSetupCredentials,
  getRootPlaywrightBaseUrl,
  loadPlaywrightEnv,
  resolveAuthSessionFile,
} from '../src/lib/playwright-auth-session-config';

const appRoot = fileURLToPath(new URL('../', import.meta.url));

loadPlaywrightEnv(appRoot);

const hasRootRealAuthSetup = hasRootAuthSetupCredentials(process.env);
const hasTenantRealAuthSetup = hasDeMusterhausenAuthSetupCredentials(process.env);

const expectStudioShellReady = async (page: Page) => {
  await expect(page.getByRole('complementary', { name: 'Seitenleiste' })).toBeVisible();
  await expect(page.getByRole('banner')).toBeVisible();
};

const expectContentOverviewReady = async (page: Page) => {
  await expect(page).toHaveURL(/\/admin\/content(?:\?.*)?$/);
  await expect(
    page
      .getByRole('heading', { name: 'Inhalte' })
      .or(page.getByRole('table', { name: 'Inhalte' }))
      .or(page.getByText('Noch keine Inhalte vorhanden'))
      .first()
  ).toBeVisible();
};

const expectInstancesOverviewReady = async (page: Page) => {
  await expect(page).toHaveURL(/\/admin\/instances(?:\?.*)?$/);
  await Promise.any([
    page.getByRole('heading', { name: 'Instanzen' }).waitFor({ state: 'visible' }),
    page.getByRole('link', { name: 'Instanz anlegen' }).waitFor({ state: 'visible' }),
    page.getByText('Es sind aktuell keine Instanzen vorhanden.').waitFor({ state: 'visible' }),
  ]);
};

test.describe('tenant real auth', () => {
  test.skip(
    !hasTenantRealAuthSetup,
    'Real tenant auth E2E requires PLAYWRIGHT_DE_MUSTERHAUSEN_* credentials.'
  );

  test('tenant content overview loads with a real authenticated session', async ({ page }) => {
    await page.goto('/admin/content');
    await expectContentOverviewReady(page);
    await expectStudioShellReady(page);
  });

  test('tenant session loss redirects to the tenant login', async ({ page }) => {
    await page.goto('/admin/content');
    await expectContentOverviewReady(page);
    await page.waitForLoadState('networkidle');

    await page.context().clearCookies();
    await page.reload({ waitUntil: 'networkidle' });

    await expect(page).toHaveURL(/\/realms\/de-musterhausen\/protocol\/openid-connect\/auth\?/);
    await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
  });

  test('tenant content overview shows a robust error state when the content list request fails', async ({
    page,
  }) => {
    await page.route('**/api/v1/iam/contents**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'database_unavailable', error: 'database_unavailable' }),
      });
    });

    await page.goto('/admin/content');

    await expect(page.getByRole('heading', { name: 'Inhalte' })).toBeVisible();
    await expectStudioShellReady(page);
    await expect(
      page
        .getByRole('alert')
        .getByText(
          'Die Inhaltsdaten konnten wegen eines Datenbankproblems nicht verarbeitet werden.'
        )
    ).toBeVisible();
  });
});

test.describe('root control plane', () => {
  test.skip(!hasRootRealAuthSetup, 'Real root auth E2E requires PLAYWRIGHT_ROOT_* credentials.');

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
