import { expect, test } from '@playwright/test';

import {
  expectAppShellReady,
  gotoHomeAsAuthenticatedUser,
  navigateClientSide,
  registerSharedIamRoutes,
} from './studio-shell.helpers';

const permissions = [
  'iam.user.read',
  'waste-management.read',
  'waste-management.master-data.manage',
] as const;

test.beforeEach(async ({ page }) => {
  await registerSharedIamRoutes(page);
  await page.route('**/auth/me', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'contextual-help-user',
          name: 'Hilfe Test',
          email: 'help@example.test',
          instanceId: 'de-musterhausen',
          assignedModules: ['waste-management'],
          roles: ['system_admin'],
          permissionActions: permissions,
        },
      }),
    })
  );
  await page.route('**/iam/me/permissions?**', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        instanceId: 'de-musterhausen',
        permissions: permissions.map((action) => ({ action })),
      }),
    })
  );
  await page.route('**/api/studio/documentation/*', async (route) => {
    const id = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1) ?? '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id,
        markdown: `# Hilfe ${id}\n\nKontext für ${id}.`,
        documentationBaseUrl: 'https://docs.example.test/',
        websiteUrl: `https://docs.example.test/pages/${id}/`,
      }),
    });
  });
});

const expectContextualHelp = async (page: import('@playwright/test').Page, id: string) => {
  const openButton = page.getByRole('button', { name: 'Hilfe öffnen' });
  await expect(openButton).toBeVisible();
  await expect
    .poll(() =>
      openButton.evaluate((button) => button.parentElement?.previousElementSibling?.tagName ?? null)
    )
    .toBe('H1');
  await openButton.click();
  await expect(page.getByRole('dialog', { name: 'Hilfe zu dieser Seite' })).toContainText(
    `Hilfe ${id}`
  );
  await page.getByRole('button', { name: 'Hilfe schließen' }).click();
  await expect(openButton).toBeFocused();
};

test('opens matching help for static, admin-detail and free plugin routes', async ({ page }) => {
  await gotoHomeAsAuthenticatedUser(page, 'Hilfe Test');
  await expectAppShellReady(page);
  await expectContextualHelp(page, 'home.overview');

  await navigateClientSide(page, '/admin/users/contextual-help-user');
  await expectAppShellReady(page);
  await expectContextualHelp(page, 'admin.users.detail');
  await expect(page).toHaveURL(/\/admin\/users\/contextual-help-user$/u);

  await navigateClientSide(page, '/plugins/waste-management');
  await expectAppShellReady(page);
  await expectContextualHelp(page, 'waste-management.overview');
  await expect(page).toHaveURL((url) => url.pathname === '/plugins/waste-management');
});

test('keeps the Studio usable when documentation is unavailable', async ({ page }) => {
  await page.unroute('**/api/studio/documentation/*');
  await page.route('**/api/studio/documentation/*', async (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'documentation_unavailable' }),
    })
  );

  await gotoHomeAsAuthenticatedUser(page, 'Hilfe Test');
  await expectAppShellReady(page);
  await page.getByRole('button', { name: 'Hilfe öffnen' }).click();

  await expect(
    page.getByRole('heading', { name: 'Hilfe ist vorübergehend nicht verfügbar' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
  await page.getByRole('button', { name: 'Hilfe schließen' }).click();
  await page.getByRole('link', { name: 'Abfallkalender' }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/plugins/waste-management');
});
