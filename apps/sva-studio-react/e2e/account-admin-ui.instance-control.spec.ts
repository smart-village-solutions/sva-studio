import { expect, test } from '@playwright/test';

import {
  configureRootAccountAdminTest,
  gotoHomeAsAuthenticatedUser,
  navigateClientSide,
  registerInstanceListRoutes,
  registerPlatformAccountAdminAuthRoute,
} from './account-admin-ui.helpers';

configureRootAccountAdminTest(test);

test('root control plane exposes tenant IAM reconcile for platform admins', async ({ page }) => {
  const instanceDetail = { instanceId: 'demo', displayName: 'Demo', status: 'requested', parentDomain: 'studio.example.org', primaryHostname: 'demo.studio.example.org', realmMode: 'existing', authRealm: 'demo', authClientId: 'sva-studio', authClientSecretConfigured: true, tenantAdminClient: { clientId: 'sva-studio-admin', secretConfigured: true }, hostnames: [], assignedModules: ['news'], provisioningRuns: [], auditEvents: [], tenantAdminBootstrap: { username: 'demo-admin', email: 'demo@example.org' }, keycloakPreflight: { overallStatus: 'ready', checkedAt: '2026-06-05T10:00:00.000Z', generatedAt: '2026-06-05T10:00:00.000Z', checks: [] }, keycloakPlan: { mode: 'existing', overallStatus: 'ready', generatedAt: '2026-06-05T10:00:00.000Z', driftSummary: 'Tenant-IAM-Reconcile empfohlen.', steps: [] }, keycloakProvisioningRuns: [], keycloakStatus: { realmExists: true, clientExists: true, tenantAdminClientExists: true, tenantAdminExists: true, tenantAdminHasSystemAdmin: true, tenantAdminHasInstanceRegistryAdmin: false, redirectUrisMatch: true, logoutUrisMatch: true, webOriginsMatch: true, clientSecretConfigured: true, tenantClientSecretReadable: true, clientSecretAligned: true, tenantAdminClientSecretConfigured: true, tenantAdminClientSecretReadable: true, tenantAdminClientSecretAligned: true, runtimeSecretSource: 'tenant' }, latestKeycloakProvisioningRun: { id: 'kc-run-1', intent: 'reconcile', mode: 'existing', overallStatus: 'planned', driftSummary: 'Legacy-Admin-Artefakte müssen bereinigt werden.', requestId: 'req-reconcile-1', steps: [] }, tenantIamStatus: { configuration: { status: 'ready', summary: 'Tenant-IAM-Struktur ist vollständig vorhanden.', source: 'registry' }, access: { status: 'ready', summary: 'Tenant-IAM-Zugriff ist verifiziert.', source: 'access_probe' }, reconcile: { status: 'degraded', summary: '1 Legacy-Admin-Artefakt erfordert manuelle Bereinigung.', source: 'role_reconcile' }, overall: { status: 'degraded', summary: 'Tenant-IAM ist eingeschränkt.', source: 'role_reconcile' } } };
  await registerPlatformAccountAdminAuthRoute(page);
  await registerInstanceListRoutes(page, [{ instanceId: 'demo', displayName: 'Demo', status: 'requested', parentDomain: 'studio.example.org', primaryHostname: 'demo.studio.example.org', realmMode: 'existing', authRealm: 'demo', authClientId: 'sva-studio', hostnames: [] }]);
  await page.route('**/api/v1/iam/instances/demo', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: instanceDetail }) });
  });
  await page.route('**/api/v1/iam/instances/demo/keycloak/status', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: instanceDetail.keycloakStatus }) });
  });

  await gotoHomeAsAuthenticatedUser(page, 'Root Admin');
  await navigateClientSide(page, '/admin/instances/demo');
  await expect(page.getByRole('heading', { name: 'Instanzdetails' })).toBeVisible({ timeout: 10000 });
  await page.getByRole('tab', { name: 'Einstellungen' }).click();
  await expect(page.locator('#detail-auth-client-id')).toHaveValue('sva-studio');
});
