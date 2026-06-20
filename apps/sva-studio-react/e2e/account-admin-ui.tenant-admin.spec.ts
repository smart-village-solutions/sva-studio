import { expect, test } from '@playwright/test';

import {
  adminAuthPayload,
  configureRootAccountAdminTest,
  gotoHomeAsAuthenticatedUser,
  navigateClientSide,
} from './account-admin-ui.helpers';

configureRootAccountAdminTest(test);

test('tenant admin mutations fail closed in the browser when the admin client contract is missing', async ({ page }) => {
  const registryAdminAuthPayload = { user: { ...adminAuthPayload.user, roles: ['system_admin', 'instance_registry_admin'] } };
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(registryAdminAuthPayload) });
  });
  await page.route('**/api/v1/iam/instances/demo', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { instanceId: 'demo', displayName: 'Demo', status: 'requested', parentDomain: 'studio.example.org', primaryHostname: 'demo.studio.example.org', realmMode: 'existing', authRealm: 'demo', authClientId: 'sva-studio', authClientSecretConfigured: true, tenantAdminClient: { clientId: 'sva-studio-admin', secretConfigured: true }, hostnames: [], provisioningRuns: [], auditEvents: [], tenantAdminBootstrap: { username: 'demo-admin', email: 'demo@example.org' }, keycloakPreflight: { overallStatus: 'ready', checkedAt: '2026-04-12T10:00:00.000Z', generatedAt: '2026-04-12T10:00:00.000Z', checks: [] }, keycloakPlan: { mode: 'existing', overallStatus: 'ready', generatedAt: '2026-04-12T10:00:00.000Z', driftSummary: 'Kein Drift.', steps: [] }, keycloakProvisioningRuns: [], keycloakStatus: { realmExists: true, clientExists: true, tenantAdminClientExists: true, tenantAdminExists: true, tenantAdminHasSystemAdmin: true, tenantAdminHasInstanceRegistryAdmin: false, redirectUrisMatch: true, logoutUrisMatch: true, webOriginsMatch: true, clientSecretConfigured: true, tenantClientSecretReadable: true, clientSecretAligned: true, tenantAdminClientSecretConfigured: true, tenantAdminClientSecretReadable: true, tenantAdminClientSecretAligned: true, runtimeSecretSource: 'tenant' }, latestKeycloakProvisioningRun: null } }) });
  });
  await page.route('**/api/v1/iam/instances/demo/keycloak/preflight', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { overallStatus: 'ready', checkedAt: '2026-04-12T10:00:00.000Z', generatedAt: '2026-04-12T10:00:00.000Z', checks: [] } }) });
  });
  await page.route('**/api/v1/iam/instances/demo/keycloak/status', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { realmExists: true, clientExists: true, tenantAdminClientExists: true, tenantAdminExists: true, tenantAdminHasSystemAdmin: true, tenantAdminHasInstanceRegistryAdmin: false, redirectUrisMatch: true, logoutUrisMatch: true, webOriginsMatch: true, clientSecretConfigured: true, tenantClientSecretReadable: true, clientSecretAligned: true, tenantAdminClientSecretConfigured: true, tenantAdminClientSecretReadable: true, tenantAdminClientSecretAligned: true, runtimeSecretSource: 'tenant' } }) });
  });
  await page.route('**/api/v1/iam/roles', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'role-2', roleName: 'editor', isSystemRole: false, roleLevel: 10, memberCount: 2, permissions: [] }], pagination: { page: 1, pageSize: 1, total: 1 } }) });
  });
  await page.route('**/api/v1/iam/groups', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], pagination: { page: 1, pageSize: 0, total: 0 } }) });
  });
  await page.route('**/api/v1/iam/users/account-2', async (route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: { code: 'tenant_admin_client_not_configured', message: 'Für diese Instanz ist noch kein Tenant-Admin-Client hinterlegt.' } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'account-2', keycloakSubject: 'kc-user-2', displayName: 'User Two', email: 'user2@example.com', status: 'active', roles: [{ roleId: 'role-2', roleName: 'editor', roleLevel: 10 }], groups: [], permissions: ['content.read'], permissionTrace: [], mainserverUserApplicationSecretSet: false } }) });
  });

  await gotoHomeAsAuthenticatedUser(page);
  await navigateClientSide(page, '/admin/instances/demo');
  await expect(page.getByRole('heading', { name: 'Instanzdetails' })).toBeVisible({ timeout: 10000 });
  await page.getByRole('tab', { name: 'Einstellungen' }).click();
  await navigateClientSide(page, '/admin/users/account-2');
  await page.getByRole('tab', { name: 'Verwaltung' }).click();
  await page.getByLabel('Mainserver Application-ID').fill('updated-app-id');
  await page.getByRole('button', { name: 'Änderungen speichern' }).click();
  await expect(page.getByText('Für diese Instanz ist noch kein Tenant-Admin-Client hinterlegt. Bitte zuerst den Instanzvertrag abgleichen.')).toBeVisible();
});
