import { expect, test } from '@playwright/test';

import {
  configureRootAccountAdminTest,
  gotoHomeAsAuthenticatedUser,
  navigateClientSide,
} from './account-admin-ui.helpers';

configureRootAccountAdminTest(test, { mockAdminAuth: true });

test('admin user list and edit page are reachable for system_admin', async ({ page }) => {
  let updateRequestBody: Record<string, unknown> | null = null;
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
            mainserverUserApplicationSecretSet: false,
          },
        ],
        pagination: { page: 1, pageSize: 25, total: 1 },
      }),
    });
  });
  await page.route('**/api/v1/iam/users/sync-keycloak', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          outcome: 'success',
          checkedCount: 2,
          correctedCount: 2,
          manualReviewCount: 0,
          importedCount: 1,
          updatedCount: 1,
          skippedCount: 0,
          totalKeycloakUsers: 2,
        },
      }),
    });
  });
  await page.route('**/api/v1/iam/users/account-2', async (route) => {
    if (route.request().method() === 'PATCH') {
      updateRequestBody = route.request().postDataJSON() as Record<string, unknown>;
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
            permissions: ['content.read'],
            mainserverUserApplicationId: 'updated-app-id',
            mainserverUserApplicationSecretSet: true,
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
          mainserverUserApplicationId: 'existing-app-id',
          mainserverUserApplicationSecretSet: true,
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
        pagination: { page: 1, pageSize: 1, total: 1 },
      }),
    });
  });

  await gotoHomeAsAuthenticatedUser(page);
  const usersResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/v1/iam/users?') && response.status() === 200
  );
  await navigateClientSide(page, '/admin/users');
  await usersResponsePromise;
  await expect(page.getByRole('heading', { name: 'Benutzerverwaltung' })).toBeVisible();
  await page.getByRole('button', { name: 'Aus Keycloak synchronisieren' }).dispatchEvent('click');
  await expect(page.getByText(/2 geprüft: 2 korrigiert, 0 manuell prüfen/)).toBeVisible();

  await navigateClientSide(page, '/admin/users/account-2');
  await expect(page.getByRole('heading', { name: 'User Two' })).toBeVisible();
  await page.getByRole('tab', { name: 'Verwaltung' }).click();
  await page.getByLabel('Mainserver Application-ID').fill('updated-app-id');
  await page.getByLabel('Mainserver Application-Secret').fill('new-secret');
  await page.getByRole('button', { name: 'Änderungen speichern' }).last().click();
  await expect
    .poll(() => updateRequestBody)
    .toEqual(
      expect.objectContaining({
        mainserverUserApplicationId: 'updated-app-id',
        mainserverUserApplicationSecret: 'new-secret',
      })
    );
  await expect(page.getByRole('button', { name: 'Gespeichert' }).last()).toBeVisible();
  await page.getByRole('tab', { name: 'Berechtigungen' }).click();
  await expect(page.getByText('content.read')).toBeVisible();
});

test('read-only user detail blocks implicit submit and a direct mutation remains forbidden', async ({
  page,
}) => {
  let patchRequests = 0;
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'kc-reader-1',
          name: 'IAM Reader',
          email: 'reader@example.com',
          instanceId: '11111111-1111-1111-8111-111111111111',
          roles: ['system_admin'],
          permissionActions: ['iam.user.read'],
        },
      }),
    });
  });
  await page.route('**/iam/me/permissions?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        instanceId: '11111111-1111-1111-8111-111111111111',
        permissions: [{ action: 'iam.user.read', resourceType: 'iam.user', accessScope: 'all' }],
        snapshotVersion: 'reader-snapshot-1',
      }),
    });
  });
  await page.route('**/api/v1/iam/users/account-2', async (route) => {
    if (route.request().method() === 'PATCH') {
      patchRequests += 1;
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'forbidden', message: 'permission_missing' } }),
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
          roles: [],
          permissions: ['content.read'],
          mainserverUserApplicationSecretSet: false,
        },
      }),
    });
  });
  await page.route('**/api/v1/iam/roles', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], pagination: { page: 1, pageSize: 0, total: 0 } }),
    });
  });

  await gotoHomeAsAuthenticatedUser(page, 'IAM Reader');
  await navigateClientSide(page, '/admin/users/account-2');
  await expect(page.getByRole('heading', { name: 'User Two' })).toBeVisible();
  await page.getByRole('tab', { name: 'Verwaltung' }).click();
  await expect(page.locator('form[aria-readonly="true"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Änderungen speichern' })).toBeDisabled();
  await page.getByLabel('Mainserver Application-ID').press('Enter');
  expect(patchRequests).toBe(0);

  const directMutationStatus = await page.evaluate(
    async () =>
      (
        await fetch('/api/v1/iam/users/account-2', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify({ firstName: 'Forbidden' }),
        })
      ).status
  );
  expect(directMutationStatus).toBe(403);
  expect(patchRequests).toBe(1);
});

test('Keycloak roles can be assigned to an unmapped App user without changing Studio roles', async ({
  page,
}) => {
  const roleMutations: Array<Record<string, unknown>> = [];
  let newsRoleDirect = false;

  await page.route('**/api/v1/iam/users?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'keycloak:app-user-1',
            keycloakSubject: 'app-user-1',
            displayName: 'App User One',
            email: 'app-user@example.com',
            status: 'active',
            mappingStatus: 'unmapped',
            editability: 'read_only',
            roles: [],
            keycloakRoles: [],
            mainserverUserApplicationSecretSet: false,
          },
        ],
        pagination: { page: 1, pageSize: 25, total: 1 },
      }),
    });
  });
  await page.route(
    (url) => url.pathname.endsWith('/keycloak-roles'),
    async (route) => {
      if (route.request().method() === 'PATCH') {
        const payload = route.request().postDataJSON() as {
          roleName: string;
          operation: 'assign' | 'remove';
        };
        roleMutations.push(payload);
        newsRoleDirect = payload.operation === 'assign';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              userRef: 'keycloak:app-user-1',
              roleName: payload.roleName,
              operation: payload.operation,
              direct: newsRoleDirect,
              status: 'confirmed',
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
            userRef: 'keycloak:app-user-1',
            mappingStatus: 'unmapped',
            roles: [
              {
                id: 'news-role',
                roleName: 'news_editor',
                composite: false,
                managedBy: 'external',
                category: 'assignable',
                assignable: true,
                direct: newsRoleDirect,
                effective: newsRoleDirect,
                origin: newsRoleDirect ? 'direct' : 'unassigned',
              },
              {
                id: 'event-role',
                roleName: 'event_editor',
                composite: false,
                managedBy: 'external',
                category: 'assignable',
                assignable: true,
                direct: false,
                effective: true,
                origin: 'composite',
              },
              {
                id: 'builtin-role',
                roleName: 'offline_access',
                composite: false,
                managedBy: 'keycloak_builtin',
                category: 'keycloak_builtin',
                assignable: false,
                direct: true,
                effective: true,
                origin: 'direct',
                reasonCode: 'keycloak_builtin_role',
              },
            ],
          },
        }),
      });
    }
  );

  await gotoHomeAsAuthenticatedUser(page);
  await navigateClientSide(page, '/admin/users');
  await expect(page.getByRole('heading', { name: 'Benutzerverwaltung' })).toBeVisible();

  await page.getByRole('button', { name: 'Keycloak-Rollen für App User One öffnen' }).click();
  await expect(page.getByRole('dialog')).toContainText('Keycloak-Rollen für App User One');
  await expect(page.getByText('Geerbt', { exact: true })).toBeVisible();
  await expect(page.getByLabel(/offline_access/i)).toBeDisabled();

  const newsRole = page.getByLabel(/news_editor/i);
  await newsRole.focus();
  await newsRole.press('Space');
  await expect
    .poll(() => roleMutations)
    .toEqual([{ roleName: 'news_editor', operation: 'assign' }]);
  await expect(page.getByText('Die Rolle news_editor wurde direkt zugewiesen.')).toBeVisible();
  await expect(newsRole).toBeChecked();

  await newsRole.press('Space');
  await expect
    .poll(() => roleMutations)
    .toEqual([
      { roleName: 'news_editor', operation: 'assign' },
      { roleName: 'news_editor', operation: 'remove' },
    ]);
  await expect(
    page.getByText('Die direkte Zuweisung der Rolle news_editor wurde entfernt.')
  ).toBeVisible();
  await expect(newsRole).not.toBeChecked();
});

test('Keycloak role assignment errors remain visible and do not imply success', async ({
  page,
}) => {
  await page.route('**/api/v1/iam/users?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'keycloak:app-user-1',
            keycloakSubject: 'app-user-1',
            displayName: 'App User One',
            status: 'active',
            mappingStatus: 'unmapped',
            editability: 'read_only',
            roles: [],
            mainserverUserApplicationSecretSet: false,
          },
        ],
        pagination: { page: 1, pageSize: 25, total: 1 },
      }),
    });
  });
  await page.route(
    (url) => url.pathname.endsWith('/keycloak-roles'),
    async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'keycloak_role_assignment_reconciliation_required',
              message: 'Die Zuweisung konnte nicht bestätigt werden.',
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
            userRef: 'keycloak:app-user-1',
            mappingStatus: 'unmapped',
            roles: [
              {
                id: 'news-role',
                roleName: 'news_editor',
                composite: false,
                managedBy: 'external',
                category: 'assignable',
                assignable: true,
                direct: false,
                effective: false,
                origin: 'unassigned',
              },
            ],
          },
        }),
      });
    }
  );

  await gotoHomeAsAuthenticatedUser(page);
  await navigateClientSide(page, '/admin/users');
  await page.getByRole('button', { name: 'Keycloak-Rollen für App User One öffnen' }).click();
  await page.getByLabel(/news_editor/i).click();

  await expect(page.getByRole('alert')).toContainText(
    'Die Keycloak-Rollen konnten nicht geladen oder geändert werden.'
  );
  await expect(
    page.getByText('Die Rolle news_editor wurde direkt zugewiesen.', { exact: true })
  ).toHaveCount(0);
  await expect(page.getByLabel(/news_editor/i)).not.toBeChecked();
});
