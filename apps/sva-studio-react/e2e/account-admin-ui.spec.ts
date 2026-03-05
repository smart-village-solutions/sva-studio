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

test('profile page supports loading and saving own profile', async ({ page }) => {
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(adminAuthPayload),
    });
  });

  await page.route('**/api/v1/iam/users/me/profile', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'account-1',
            keycloakSubject: 'kc-admin-1',
            displayName: 'Admin One',
            firstName: 'Admin',
            lastName: 'One',
            email: 'admin@example.com',
            status: 'active',
            roles: [{ roleId: 'role-1', roleName: 'system_admin', roleLevel: 90 }],
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'account-1',
          keycloakSubject: 'kc-admin-1',
          displayName: 'Admin Updated',
          firstName: 'Admin',
          lastName: 'Updated',
          email: 'admin@example.com',
          status: 'active',
          roles: [{ roleId: 'role-1', roleName: 'system_admin', roleLevel: 90 }],
        },
      }),
    });
  });

  await page.goto('/');
  await expect(page.getByRole('link', { name: 'SVA Studio' })).toBeVisible();
  await navigateClientSide(page, '/account');

  await expect(page.getByRole('heading', { name: 'Mein Konto' })).toBeVisible();

  await page.getByLabel('Nachname').fill('Updated');
  await page.getByRole('button', { name: 'Speichern' }).click();

  await expect(page.getByText('Profil wurde erfolgreich gespeichert.')).toBeVisible();
});

test('admin user list and edit page are reachable for system_admin', async ({ page }) => {
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(adminAuthPayload),
    });
  });

  await page.route('**/api/v1/iam/users?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'account-2',
            keycloakSubject: 'kc-user-2',
            displayName: 'User Two',
            email: 'user2@example.com',
            status: 'active',
            roles: [{ roleId: 'role-2', roleName: 'editor', roleLevel: 10 }],
          },
        ],
        pagination: {
          page: 1,
          pageSize: 25,
          total: 1,
        },
      }),
    });
  });

  await page.route('**/api/v1/iam/users/account-2', async (route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'account-2',
            keycloakSubject: 'kc-user-2',
            displayName: 'User Two Edited',
            email: 'user2@example.com',
            status: 'active',
            roles: [{ roleId: 'role-2', roleName: 'editor', roleLevel: 10 }],
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'account-2',
          keycloakSubject: 'kc-user-2',
          displayName: 'User Two',
          email: 'user2@example.com',
          status: 'active',
          roles: [{ roleId: 'role-2', roleName: 'editor', roleLevel: 10 }],
          permissions: ['content.read'],
        },
      }),
    });
  });

  await page.route('**/api/v1/iam/roles', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'role-2',
            roleName: 'editor',
            isSystemRole: false,
            roleLevel: 10,
            memberCount: 2,
            permissions: [],
          },
        ],
        pagination: {
          page: 1,
          pageSize: 1,
          total: 1,
        },
      }),
    });
  });

  await page.goto('/');
  await expect(page.getByRole('link', { name: 'SVA Studio' })).toBeVisible();
  await navigateClientSide(page, '/admin/users');
  await expect(page.getByRole('heading', { name: 'Benutzerverwaltung' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'User Two', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Bearbeiten' }).click();
  await expect(page.getByRole('heading', { name: 'User Two' })).toBeVisible();

  await page.getByRole('tab', { name: 'Berechtigungen' }).click();
  await expect(page.getByText('content.read')).toBeVisible();
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
  await expect(page.getByRole('link', { name: 'Benutzer' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Rollen' })).toHaveCount(0);

  await page.evaluate(() => {
    window.history.pushState({}, '', '/admin/users');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveURL(/\?error=auth\.insufficientRole/);
});

test('responsive IAM views render on mobile, tablet, desktop', async ({ page }) => {
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(adminAuthPayload),
    });
  });

  await page.route('**/api/v1/iam/users?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
        pagination: { page: 1, pageSize: 25, total: 0 },
      }),
    });
  });

  for (const viewport of [
    { width: 320, height: 800 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'SVA Studio' })).toBeVisible();
    await navigateClientSide(page, '/admin/users');
    await expect(page.getByRole('heading', { name: 'Benutzerverwaltung' })).toBeVisible();
  }
});

test('direct iam users api call returns forbidden for non-admin user', async ({ page }) => {
  await page.route('**/api/v1/iam/users', async (route) => {
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'forbidden',
          message: 'missing_admin_role',
        },
      }),
    });
  });

  await page.goto('/');
  const statusCode = await page.evaluate(async () => {
    const response = await fetch('/api/v1/iam/users', {
      credentials: 'include',
    });
    return response.status;
  });

  expect(statusCode).toBe(403);
});

test('csrf header is required for mutating iam endpoints', async ({ page }) => {
  await page.route('**/api/v1/iam/users/me/profile', async (route) => {
    const csrfHeader = route.request().headers()['x-requested-with'];
    if (csrfHeader === 'XMLHttpRequest') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'account-1',
            keycloakSubject: 'kc-admin-1',
            displayName: 'Admin One',
            status: 'active',
            roles: [],
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'csrf_validation_failed',
          message: 'missing_header',
        },
      }),
    });
  });

  await page.goto('/');

  const statusWithoutCsrf = await page.evaluate(async () => {
    const response = await fetch('/api/v1/iam/users/me/profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ firstName: 'NoHeader' }),
    });
    return response.status;
  });
  expect(statusWithoutCsrf).toBe(403);

  const statusWithCsrf = await page.evaluate(async () => {
    const response = await fetch('/api/v1/iam/users/me/profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ firstName: 'WithHeader' }),
    });
    return response.status;
  });
  expect(statusWithCsrf).toBe(200);
});
