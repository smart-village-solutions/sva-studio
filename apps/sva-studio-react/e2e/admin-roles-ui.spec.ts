import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const adminAuthPayload = {
  user: {
    id: 'kc-admin-1',
    name: 'Admin One',
    email: 'admin@example.com',
    instanceId: '11111111-1111-1111-8111-111111111111',
    roles: ['system_admin'],
  },
};

const navigateClientSide = async (page: Page, targetPath: string) => {
  await page.evaluate((path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, targetPath);
};

const gotoHomeAsAuthenticatedUser = async (page: Page) => {
  const authMeResponse = page.waitForResponse(
    (response) => response.request().method() === 'GET' && response.url().includes('/auth/me') && response.status() === 200
  );

  await page.goto('/');
  await authMeResponse;
  await expect(page.getByRole('heading', { name: 'SVA Studio' })).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  await page.route('**/iam/authorize', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ allowed: true, reason: 'mocked_authorize' }),
    });
  });

  await page.route('**/iam/me/legal-texts/pending', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
        pagination: { page: 1, pageSize: 0, total: 0 },
      }),
    });
  });
});

test('role create page opens and submits successfully', async ({ page }) => {
  const roles = [
    {
      id: 'role-1',
      roleKey: 'editor',
      roleName: 'editor',
      externalRoleName: 'editor',
      managedBy: 'studio',
      description: 'Editorial role',
      isSystemRole: false,
      roleLevel: 20,
      memberCount: 3,
      syncState: 'synced',
      permissions: [{ id: 'perm-1', permissionKey: 'content.write', description: null }],
    },
  ];

  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(adminAuthPayload),
    });
  });

  await page.route('**/api/v1/iam/roles', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: roles,
        }),
      });
      return;
    }

    roles.push({
      id: 'role-new',
      roleKey: 'team_lead',
      roleName: 'team_lead',
      externalRoleName: 'team_lead',
      managedBy: 'studio',
      description: 'Team lead',
      isSystemRole: false,
      roleLevel: 42,
      memberCount: 0,
      syncState: 'pending',
      permissions: [],
    });

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'role-new',
          roleKey: 'team_lead',
          roleName: 'team_lead',
          externalRoleName: 'team_lead',
          managedBy: 'studio',
          description: 'Team lead',
          isSystemRole: false,
          roleLevel: 42,
          memberCount: 0,
          syncState: 'pending',
          permissions: [],
        },
      }),
    });
  });

  await gotoHomeAsAuthenticatedUser(page);
  await navigateClientSide(page, '/admin/roles');

  await expect(page.getByRole('heading', { name: 'Rollenverwaltung' })).toBeVisible({ timeout: 10000 });

  await page.getByRole('link', { name: 'Rolle anlegen' }).click();

  await expect(page).toHaveURL(/\/admin\/roles\/new$/);
  await expect(page.getByRole('heading', { name: 'Neue Rolle erstellen' })).toBeVisible();

  const roleKeyInput = page.getByLabel('Technischer Rollenschlüssel');
  await roleKeyInput.fill('Team Lead');
  await expect(roleKeyInput).toHaveValue('Team Lead');

  await page.getByLabel('Anzeigename').fill('Team Lead');
  await page.getByLabel('Beschreibung').fill('Verantwortlich für Teamkoordination');
  await page.getByLabel('Rollenlevel').fill('42');
  await page.getByRole('button', { name: 'Rolle anlegen' }).click();

  await expect(page).toHaveURL(/\/admin\/roles\/role-new$/);
});
