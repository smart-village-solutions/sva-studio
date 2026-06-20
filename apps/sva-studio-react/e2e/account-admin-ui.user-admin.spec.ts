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
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'account-2', keycloakSubject: 'kc-user-2', displayName: 'User Two', email: 'user2@example.com', status: 'active', roles: [{ roleId: 'role-2', roleName: 'editor', roleLevel: 10 }], mainserverUserApplicationSecretSet: false }], pagination: { page: 1, pageSize: 25, total: 1 } }) });
  });
  await page.route('**/api/v1/iam/users/sync-keycloak', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { outcome: 'success', checkedCount: 2, correctedCount: 2, manualReviewCount: 0, importedCount: 1, updatedCount: 1, skippedCount: 0, totalKeycloakUsers: 2 } }) });
  });
  await page.route('**/api/v1/iam/users/account-2', async (route) => {
    if (route.request().method() === 'PATCH') {
      updateRequestBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'account-2', keycloakSubject: 'kc-user-2', displayName: 'User Two Edited', email: 'user2@example.com', status: 'active', roles: [{ roleId: 'role-2', roleName: 'editor', roleLevel: 10 }], permissions: ['content.read'], mainserverUserApplicationId: 'updated-app-id', mainserverUserApplicationSecretSet: true } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'account-2', keycloakSubject: 'kc-user-2', displayName: 'User Two', email: 'user2@example.com', status: 'active', roles: [{ roleId: 'role-2', roleName: 'editor', roleLevel: 10 }], permissions: ['content.read'], mainserverUserApplicationId: 'existing-app-id', mainserverUserApplicationSecretSet: true } }) });
  });
  await page.route('**/api/v1/iam/roles', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'role-2', roleName: 'editor', isSystemRole: false, roleLevel: 10, memberCount: 2, permissions: [] }], pagination: { page: 1, pageSize: 1, total: 1 } }) });
  });

  await gotoHomeAsAuthenticatedUser(page);
  const usersResponsePromise = page.waitForResponse((response) => response.url().includes('/api/v1/iam/users?') && response.status() === 200);
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
  await page.getByRole('button', { name: 'Änderungen speichern' }).click();
  await expect.poll(() => updateRequestBody).toEqual(expect.objectContaining({ mainserverUserApplicationId: 'updated-app-id', mainserverUserApplicationSecret: 'new-secret' }));
  await expect(page.getByText('Nutzerdaten wurden gespeichert.')).toBeVisible();
  await page.getByRole('tab', { name: 'Berechtigungen' }).click();
  await expect(page.getByText('content.read')).toBeVisible();
});
