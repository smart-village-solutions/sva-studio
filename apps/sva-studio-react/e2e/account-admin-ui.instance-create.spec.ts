import { expect, test } from '@playwright/test';

import {
  configureRootAccountAdminTest,
  gotoHomeAsAuthenticatedUser,
  navigateClientSide,
  registerInstanceListRoutes,
  registerPlatformAccountAdminAuthRoute,
} from './account-admin-ui.helpers';

configureRootAccountAdminTest(test);

test('instance create flow bootstraps tenant admin structure with selected modules', async ({ page }) => {
  let createRequestBody: Record<string, unknown> | null = null;
  let bootstrapRequestBody: Record<string, unknown> | null = null;
  const createdInstance = { instanceId: 'demo', displayName: 'Demo', status: 'requested', parentDomain: 'studio.example.org', primaryHostname: 'demo.studio.example.org', realmMode: 'new', authRealm: 'demo', authClientId: 'tenant-client', authClientSecretConfigured: false, hostnames: [] };
  const bootstrappedInstance = { ...createdInstance, assignedModules: ['news', 'events'], provisioningRuns: [], keycloakProvisioningRuns: [], auditEvents: [] };

  await registerPlatformAccountAdminAuthRoute(page);
  await registerInstanceListRoutes(page, [bootstrappedInstance]);
  await page.route('**/api/v1/iam/instances/demo', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { ...bootstrappedInstance, tenantAdminClient: { clientId: 'sva-studio-realm-admin', secretConfigured: true }, keycloakStatus: { realmExists: true, clientExists: true, tenantAdminClientExists: true, tenantAdminExists: true, tenantAdminHasSystemAdmin: true, tenantAdminHasInstanceRegistryAdmin: false, redirectUrisMatch: true, logoutUrisMatch: true, webOriginsMatch: true, clientSecretConfigured: true, tenantClientSecretReadable: true, clientSecretAligned: true, tenantAdminClientSecretConfigured: true, tenantAdminClientSecretReadable: true, tenantAdminClientSecretAligned: true, runtimeSecretSource: 'tenant' } } }) });
  });
  await page.route('**/api/v1/iam/instances/demo/keycloak/status', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { realmExists: true, clientExists: true, tenantAdminClientExists: true, tenantAdminExists: true, tenantAdminHasSystemAdmin: true, tenantAdminHasInstanceRegistryAdmin: false, redirectUrisMatch: true, logoutUrisMatch: true, webOriginsMatch: true, clientSecretConfigured: true, tenantClientSecretReadable: true, clientSecretAligned: true, tenantAdminClientSecretConfigured: true, tenantAdminClientSecretReadable: true, tenantAdminClientSecretAligned: true, runtimeSecretSource: 'tenant' } }) });
  });
  await page.route('**/api/v1/iam/instances', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    createRequestBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: createdInstance }) });
  });
  await page.route('**/api/v1/iam/instances/demo/modules/bootstrap-admin-structure', async (route) => {
    bootstrapRequestBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: bootstrappedInstance }) });
  });

  await gotoHomeAsAuthenticatedUser(page, 'Root Admin');
  await navigateClientSide(page, '/admin/instances/new');
  await page.locator('#instance-id').fill('demo');
  await page.locator('#instance-display-name').fill('Demo');
  await page.locator('#instance-parent-domain').fill('studio.example.org');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.locator('#instance-auth-realm').fill('demo');
  await page.locator('#instance-auth-client-id').fill('tenant-client');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.locator('#instance-admin-username').fill('setup-admin');
  await page.locator('#instance-admin-email').fill('admin@example.org');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Instanz anlegen' }).click();
  await expect.poll(() => createRequestBody).toEqual(expect.objectContaining({ instanceId: 'demo', displayName: 'Demo', parentDomain: 'studio.example.org', authRealm: 'demo', authClientId: 'tenant-client' }));
  await page.getByRole('link', { name: 'Setup abschließen' }).click();
  await page.getByRole('checkbox', { name: /News/u }).check();
  await page.getByRole('checkbox', { name: /Events/u }).check();
  await page.getByRole('button', { name: 'Tenant-Admin-Struktur jetzt anlegen' }).click();
  await expect.poll(() => bootstrapRequestBody).toEqual({ moduleIds: ['news', 'events'] });
});
