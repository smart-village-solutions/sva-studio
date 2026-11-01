import { captureStudioDesignState } from './studio-shell.helpers';
import { expect, test } from '@playwright/test';

import {
  ROOT_AUTH_SESSION_FILE,
  appRoot,
  getRootPlaywrightBaseUrl,
  gotoHomeAsAuthenticatedUser,
  loadPlaywrightEnv,
  navigateClientSide,
  registerAccountAdminAuthRoute,
  registerSharedAccountAdminRoutes,
  resolveAuthSessionFile,
  unauthenticatedStorageState,
} from './account-admin-ui.helpers';

loadPlaywrightEnv(appRoot);

test.use({
  baseURL: getRootPlaywrightBaseUrl(process.env),
  storageState: resolveAuthSessionFile(appRoot, ROOT_AUTH_SESSION_FILE),
});

test.beforeEach(async ({ page }) => {
  await registerSharedAccountAdminRoutes(page);
});

test('admin links are hidden for non-admin user and route guard redirects', async ({ page }) => {
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'kc-editor-1',
          name: 'Editor User',
          email: 'editor@example.com',
          instanceId: '11111111-1111-1111-8111-111111111111',
          roles: ['editor'],
        },
      }),
    });
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: /Editor User/ })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('link', { name: 'Benutzer' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Rollen' })).toHaveCount(0);

  await navigateClientSide(page, '/admin/users');
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: /SVA Studio/i })).toBeVisible();
});

test.describe('unauthenticated admin access', () => {
  test.use({ storageState: unauthenticatedStorageState });

  test('direct access to admin users redirects unauthenticated clients to login', async ({
    request,
  }) => {
    const response = await request.get('/admin/users', { maxRedirects: 0 });
    if ([302, 303, 307, 308].includes(response.status())) {
      expect(response.headers().location).toMatch(
        /(\/\?auth=login&returnTo=%2Fadmin%2Fusers|\/auth\/login\?returnTo=%2Fadmin%2Fusers|\/protocol\/openid-connect\/auth(?:\?|$)|accounts\.google\.com\/(signin\/oauth\/error|o\/oauth2\/v2\/auth)|\/\?auth=(?:mock-login|dev-login)(?:$|&))/
      );
      return;
    }

    expect(response.status()).toBe(200);
    await expect(response.text()).resolves.toContain('Benutzerverwaltung');
  });
});

test('responsive IAM views render on mobile, tablet, desktop', async ({ page }) => {
  test.setTimeout(120_000);
  await registerAccountAdminAuthRoute(page);
  await page.route('**/api/v1/iam/users?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'account-2',
            keycloakSubject: 'kc-user-2',
            displayName: 'Redaktion für kommunale Dienstleistungen und Veranstaltungen',
            email: 'redaktion@example.test',
            status: 'active',
            roles: [{ roleId: 'role-2', roleName: 'editor', roleLevel: 10 }],
            mainserverUserApplicationSecretSet: false,
          },
        ],
        pagination: { page: 1, pageSize: 25, total: 1 },
      }),
    });
  });

  await gotoHomeAsAuthenticatedUser(page);
  await navigateClientSide(page, '/admin/users');
  await expect(page.getByRole('heading', { name: 'Benutzerverwaltung' })).toBeVisible();
  await captureStudioDesignState(page, 'admin-users');
});

test('direct iam users api call returns forbidden for non-admin user', async ({ page }) => {
  await page.route('**/api/v1/iam/users', async (route) => {
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'forbidden', message: 'missing_admin_role' } }),
    });
  });

  await page.goto('/');
  const statusCode = await page.evaluate(
    async () => (await fetch('/api/v1/iam/users', { credentials: 'include' })).status
  );
  expect(statusCode).toBe(403);
});

test('csrf header is required for mutating iam endpoints', async ({ page }) => {
  await page.route('**/api/v1/iam/users/me/profile', async (route) => {
    const csrfHeader = route.request().headers()['x-requested-with'];
    await route.fulfill({
      status: csrfHeader === 'XMLHttpRequest' ? 200 : 403,
      contentType: 'application/json',
      body: JSON.stringify(
        csrfHeader === 'XMLHttpRequest'
          ? {
              data: {
                id: 'account-1',
                keycloakSubject: 'kc-admin-1',
                displayName: 'Admin One',
                status: 'active',
                roles: [],
                mainserverUserApplicationSecretSet: false,
              },
            }
          : { error: { code: 'csrf_validation_failed', message: 'missing_header' } }
      ),
    });
  });

  await page.goto('/');
  const statusWithoutCsrf = await page.evaluate(
    async () =>
      (
        await fetch('/api/v1/iam/users/me/profile', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firstName: 'NoHeader' }),
        })
      ).status
  );
  const statusWithCsrf = await page.evaluate(
    async () =>
      (
        await fetch('/api/v1/iam/users/me/profile', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify({ firstName: 'WithHeader' }),
        })
      ).status
  );
  expect(statusWithoutCsrf).toBe(403);
  expect(statusWithCsrf).toBe(200);
});

test('organization form keeps field spacing across semantic fieldsets', async ({ page }) => {
  test.setTimeout(120_000);
  await registerAccountAdminAuthRoute(page);
  const organization = {
    id: 'org-spacing',
    organizationKey: 'landkreis-beispiel',
    displayName: 'Landkreis Beispiel',
    organizationType: 'county',
    contentAuthorPolicy: 'org_only',
    mainserverApplicationId: 'synthetic-application-id',
    mainserverApplicationSecretSet: true,
    mainserverProvisioning: { status: 'ready', attemptCount: 1, operationInProgress: false },
    isActive: true,
    depth: 0,
    hierarchyPath: ['Landkreis Beispiel'],
    childCount: 0,
    membershipCount: 0,
    metadata: {},
    memberships: [],
  };
  await page.route('**/api/v1/iam/organizations?**', (route) =>
    route.fulfill({
      json: { data: [organization], pagination: { page: 1, pageSize: 100, total: 1 } },
    })
  );
  await page.route('**/api/v1/iam/organizations/org-spacing', (route) =>
    route.fulfill({ json: { data: organization } })
  );
  await gotoHomeAsAuthenticatedUser(page);
  await navigateClientSide(page, '/admin/organizations/org-spacing?tab=organization');
  const form = page.locator('form').filter({ has: page.locator('#organization-key') });
  await expect(form.locator('#organization-name')).toHaveValue('Landkreis Beispiel');
  const assertFieldGap = async (previousId: string, nextId: string) => {
    const previous = await form.locator(`#${previousId}`).boundingBox();
    const nextLabel = await form.locator(`label[for="${nextId}"]`).boundingBox();
    expect(previous).not.toBeNull();
    expect(nextLabel).not.toBeNull();
    const gap = nextLabel!.y - (previous!.y + previous!.height);
    expect(gap).toBeGreaterThanOrEqual(15.5);
    expect(gap).toBeLessThanOrEqual(16.5);
  };
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await assertFieldGap('organization-key', 'organization-name');
    await assertFieldGap('organization-name', 'organization-type');
    await assertFieldGap('organization-parent', 'organization-mainserver-app-id');
    await assertFieldGap('organization-mainserver-app-id', 'organization-mainserver-app-secret');
    if (width < 768) await assertFieldGap('organization-type', 'organization-policy');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    );
  }
  await captureStudioDesignState(page, 'organization-form-spacing');
  await expect(form.locator('#organization-mainserver-app-secret')).toHaveValue('');
  await expect(form.locator('input, select')).toHaveCount(7);
});
