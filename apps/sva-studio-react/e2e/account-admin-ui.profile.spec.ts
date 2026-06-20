import { expect, test } from '@playwright/test';

import {
  configureRootAccountAdminTest,
  deletionRulesPayload,
  gotoHomeAsAuthenticatedUser,
  navigateClientSide,
  privacyDetailPayload,
  privacyOverviewPayload,
} from './account-admin-ui.helpers';

configureRootAccountAdminTest(test, { mockAdminAuth: true });

test('profile page supports loading and saving own profile', async ({ page }) => {
  test.slow();
  await page.route('**/api/v1/iam/users/me/profile', async (route) => {
    const data = route.request().method() === 'GET'
      ? { id: 'account-1', keycloakSubject: 'kc-admin-1', displayName: 'Admin One', firstName: 'Admin', lastName: 'One', email: 'admin@example.com', status: 'active', roles: [{ roleId: 'role-1', roleName: 'system_admin', roleLevel: 90 }], mainserverUserApplicationSecretSet: false }
      : { id: 'account-1', keycloakSubject: 'kc-admin-1', displayName: 'Admin Updated', firstName: 'Admin', lastName: 'Updated', email: 'admin@example.com', status: 'active', roles: [{ roleId: 'role-1', roleName: 'system_admin', roleLevel: 90 }], mainserverUserApplicationSecretSet: false };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
  });

  await gotoHomeAsAuthenticatedUser(page);
  await navigateClientSide(page, '/account');
  await expect(page.getByRole('heading', { name: 'Mein Konto' })).toBeVisible({ timeout: 10000 });
  await page.getByLabel('Nachname').fill('Updated');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Profil wurde erfolgreich gespeichert.')).toBeVisible();
});

test('header menu opens privacy cockpit, detail view, and account rules', async ({ page }) => {
  await page.route('**/api/v1/iam/users/me/profile', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'account-1', keycloakSubject: 'kc-admin-1', displayName: 'Admin One', firstName: 'Admin', lastName: 'One', email: 'admin@example.com', status: 'active', roles: [{ roleId: 'role-1', roleName: 'system_admin', roleLevel: 90 }], mainserverUserApplicationSecretSet: false } }) });
  });
  await page.route('**/iam/me/data-subject-rights/requests', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(privacyOverviewPayload) });
  });
  await page.route('**/iam/me/data-subject-rights/cases/*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(privacyDetailPayload) });
  });
  await page.route('**/iam/me/deletion-rules', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(deletionRulesPayload) });
  });

  await gotoHomeAsAuthenticatedUser(page);
  await page.getByRole('button', { name: /Admin One/ }).click();
  await page.getByRole('menuitem', { name: 'Datenschutz' }).click();
  await expect(page).toHaveURL(/\/account\/privacy$/);
  await expect(page.getByRole('heading', { name: 'Datenschutz & Transparenz' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('table', { name: 'Datenschutzvorgänge' })).toBeVisible();
  await page.getByRole('link', { name: 'Details' }).first().click();
  await expect(page).toHaveURL(/\/account\/privacy\/request-1$/);
  await page.getByRole('button', { name: 'Zurück zur Datenschutzübersicht' }).click();
  await page.getByRole('button', { name: /Admin One/ }).click();
  await page.getByRole('menuitem', { name: 'Kontoregeln' }).click();
  await expect(page).toHaveURL(/\/account\/rules$/);
  await expect(page.getByRole('heading', { name: 'Kontoregeln' })).toBeVisible();
});
