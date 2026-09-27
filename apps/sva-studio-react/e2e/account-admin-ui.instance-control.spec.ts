import { expect, test } from '@playwright/test';
import { DEFAULT_ACCOUNT_INVITATION_TEMPLATE } from '@sva/core';

import {
  configureRootAccountAdminTest,
  gotoHomeAsAuthenticatedUser,
  navigateClientSide,
  registerInstanceListRoutes,
  registerPlatformAccountAdminAuthRoute,
} from './account-admin-ui.helpers';

configureRootAccountAdminTest(test);
test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/iam/instances/*/plugin-readiness', (route) =>
    route.fulfill({ json: { data: [] } })
  );
  await page.route('**/api/v1/iam/instances/*/audit', (route) =>
    route.fulfill({ json: { data: null } })
  );
});

const baseInstanceDetail = {
  instanceId: 'demo',
  displayName: 'Demo',
  status: 'requested',
  parentDomain: 'studio.example.org',
  primaryHostname: 'demo.studio.example.org',
  realmMode: 'existing',
  authRealm: 'demo',
  authClientId: 'sva-studio',
  authClientSecretConfigured: true,
  tenantAdminClient: { clientId: 'sva-studio-admin', secretConfigured: true },
  hostnames: [],
  effectiveAccountInvitationTemplate: {
    ...DEFAULT_ACCOUNT_INVITATION_TEMPLATE,
    revision: 0,
  },
  accountInvitationTemplateSource: 'sva_default',
  serverAccountInvitationTemplateRevision: 0,
  assignedModules: ['news'],
  moduleActivations: [
    {
      instanceId: 'demo',
      moduleId: 'news',
      activationPolicy: 'automatic',
      activationOrigin: 'policy_reconcile',
      effectiveActive: true,
      manualOverride: null,
      manifestVersion: 1,
      policyRevision: 'news:1:automatic',
      stateRevision: 1,
      reconcileId: 'reconcile-news-1',
      reconciledAt: '2026-06-05T10:00:00.000Z',
      createdAt: '2026-06-05T10:00:00.000Z',
      updatedAt: '2026-06-05T10:00:00.000Z',
    },
  ],
  provisioningRuns: [],
  auditEvents: [],
  tenantAdminBootstrap: { username: 'demo-admin', email: 'demo@example.org' },
  keycloakPreflight: {
    overallStatus: 'ready',
    checkedAt: '2026-06-05T10:00:00.000Z',
    generatedAt: '2026-06-05T10:00:00.000Z',
    checks: [],
  },
  keycloakPlan: {
    mode: 'existing',
    overallStatus: 'ready',
    generatedAt: '2026-06-05T10:00:00.000Z',
    driftSummary: 'Tenant-IAM-Reconcile empfohlen.',
    steps: [],
  },
  keycloakProvisioningRuns: [],
  keycloakStatus: {
    realmExists: true,
    clientExists: true,
    tenantAdminClientExists: true,
    systemAdminRoleExists: true,
    tenantAdminExists: true,
    tenantAdminHasSystemAdmin: true,
    tenantAdminHasInstanceRegistryAdmin: false,
    redirectUrisMatch: true,
    logoutUrisMatch: true,
    webOriginsMatch: true,
    clientSecretConfigured: true,
    tenantClientSecretReadable: true,
    clientSecretAligned: true,
    tenantAdminClientSecretConfigured: true,
    tenantAdminClientSecretReadable: true,
    tenantAdminClientSecretAligned: true,
    runtimeSecretSource: 'tenant',
  },
  latestKeycloakProvisioningRun: {
    id: 'kc-run-1',
    intent: 'reconcile',
    mode: 'existing',
    overallStatus: 'planned',
    driftSummary: 'Legacy-Admin-Artefakte müssen bereinigt werden.',
    requestId: 'req-reconcile-1',
    steps: [],
  },
  tenantIamStatus: {
    configuration: {
      status: 'ready',
      summary: 'Tenant-IAM-Struktur ist vollständig vorhanden.',
      source: 'registry',
      serviceIdentity: 'sva-studio-provisioner',
      classification: 'ready',
    },
    access: {
      status: 'ready',
      summary: 'Tenant-IAM-Zugriff ist verifiziert.',
      source: 'access_probe',
      serviceIdentity: 'sva-studio-tenant-iam',
      classification: 'ready',
    },
    reconcile: {
      status: 'degraded',
      summary: '1 Legacy-Admin-Artefakt erfordert manuelle Bereinigung.',
      source: 'role_reconcile',
      serviceIdentity: 'sva-studio-tenant-iam',
      classification: 'misconfigured',
    },
    overall: {
      status: 'degraded',
      summary: 'Tenant-IAM ist eingeschränkt.',
      source: 'role_reconcile',
    },
  },
};
test('root control plane exposes tenant IAM reconcile for platform admins', async ({ page }) => {
  const instanceDetail = baseInstanceDetail;
  await registerPlatformAccountAdminAuthRoute(page);
  await registerInstanceListRoutes(page, [
    {
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'requested',
      parentDomain: 'studio.example.org',
      primaryHostname: 'demo.studio.example.org',
      realmMode: 'existing',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      hostnames: [],
    },
  ]);
  await page.route('**/api/v1/iam/instances/demo', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: instanceDetail }),
    });
  });
  await page.route('**/api/v1/iam/instances/demo/keycloak/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: instanceDetail.keycloakStatus }),
    });
  });

  await gotoHomeAsAuthenticatedUser(page, 'Root Admin');
  await navigateClientSide(page, '/admin/instances/demo');
  await expect(page.getByRole('heading', { name: 'Demo', exact: true })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByRole('tab', { name: 'Betrieb' })).toBeVisible();
  const newsModuleRow = page.getByRole('region', { name: 'news', exact: true });
  await newsModuleRow.getByText('Technische Details', { exact: true }).click();
  await expect(newsModuleRow).toContainText('Aktiv');
  await expect(newsModuleRow).toContainText('Automatisch');
  await expect(newsModuleRow).toContainText('Richtlinienabgleich');
  const doctorTab = page.getByRole('tab', { name: 'Doctor' });
  await doctorTab.focus();
  await doctorTab.press('Enter');
  await expect(doctorTab).toHaveAttribute('data-state', 'active');
  const doctorOverview = page.getByTestId('instance-doctor-overview');
  await expect(doctorOverview).toHaveRole('list');
  expect(await doctorOverview.getByRole('listitem').count()).toBeGreaterThanOrEqual(3);
  for (const summary of await doctorOverview.locator('summary').all()) await summary.click();
  await expect(doctorOverview).toContainText('Service: sva-studio-tenant-iam');
  await expect(doctorOverview).toContainText('Befund: Konfiguration fehlerhaft');
  await expect(doctorOverview).toContainText(
    'Prüfen Sie die tenantgebundene Konfiguration von sva-studio-tenant-iam'
  );
  await page.getByRole('tab', { name: 'Einstellungen' }).click();
  await page.getByText('Nutzer-Datenbank und Clients · demo', { exact: true }).click();
  await expect(page.locator('#detail-auth-client-id')).toHaveValue('sva-studio');
  await page.locator('#detail-auth-realm').fill('invalid realm');
  await page.getByText('Nutzer-Datenbank und Clients · demo', { exact: true }).click();
  await page.getByRole('button', { name: 'Instanz speichern' }).click();
  await page.getByRole('link', { name: /gültiges Auth-Realm/ }).click();
  await expect(page.locator('#detail-auth-realm')).toBeFocused();
  await page.locator('#detail-auth-realm').fill('unsaved-realm');
  await page.locator('#detail-display-name').fill('Unsaved name');
  let templatePayload: Record<string, unknown> | undefined;
  await page.route('**/api/v1/iam/instances/demo', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    templatePayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ json: { data: instanceDetail } });
  });
  await page.getByRole('button', { name: 'Account-Einladung anpassen' }).click();
  await page.getByRole('button', { name: 'Vorlage speichern' }).click();
  await expect
    .poll(() => templatePayload)
    .toMatchObject({
      displayName: 'Demo',
      authRealm: 'demo',
      accountInvitationTemplateRevision: 0,
    });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Account-Einladung anpassen' })).toBeFocused();
  await expect(page.locator('#detail-display-name')).toHaveValue('Unsaved name');
  await expect(page.locator('#detail-auth-realm')).toHaveValue('unsaved-realm');
});

test('mixed setup evidence preserves Keycloak success and only retries the safe parent run', async ({
  page,
}) => {
  let retryRequests = 0;
  const instanceDetail = {
    ...baseInstanceDetail,
    status: 'failed',
    latestKeycloakProvisioningRun: {
      ...baseInstanceDetail.latestKeycloakProvisioningRun,
      overallStatus: 'succeeded',
    },
    tenantIamStatus: {
      ...baseInstanceDetail.tenantIamStatus,
      reconcile: {
        ...baseInstanceDetail.tenantIamStatus.reconcile,
        status: 'blocked',
        summary: 'Lokale IAM-Datenbank nicht erreichbar.',
        classification: 'unavailable',
      },
      overall: {
        status: 'blocked',
        source: 'registry',
        summary: 'Lokale IAM-Datenbank nicht erreichbar.',
      },
    },
    provisioningReadiness: {
      state: 'provisioning_blocked',
      capabilities: [],
      nextAction: {
        action: 'instance.provisioning.retry',
        retryClass: 'safe',
        runId: 'parent-run',
      },
    },
    provisioningRuns: [
      {
        id: 'parent-run',
        instanceId: 'demo',
        operation: 'create',
        status: 'failed',
        idempotencyKey: 'existing-key',
        snapshotVersion: '3.0',
        desiredSnapshot: { automationMode: 'kassel-traefik-file' },
        attemptCount: 1,
        createdAt: '2026-06-05T10:00:00.000Z',
        updatedAt: '2026-06-05T10:00:00.000Z',
        terminalEvidence: {},
      },
    ],
  };
  await registerPlatformAccountAdminAuthRoute(page);
  await registerInstanceListRoutes(page, [instanceDetail]);
  await page.route('**/api/v1/iam/instances/demo', (route) =>
    route.fulfill({ json: { data: instanceDetail } })
  );
  await page.route('**/api/v1/iam/instances/demo/keycloak/status', (route) =>
    route.fulfill({ json: { data: instanceDetail.keycloakStatus } })
  );
  await page.route('**/api/v1/iam/instances/demo/provisioning/retry', async (route) => {
    retryRequests += 1;
    await route.fulfill({ status: 202, json: { data: { accepted: true } } });
  });
  await gotoHomeAsAuthenticatedUser(page, 'Root Admin');
  await navigateClientSide(page, '/admin/instances/demo');
  const progress = page.getByRole('list', { name: 'Technische Teilschritte' });
  await expect(progress).toContainText('Keycloak');
  await expect(progress).toContainText('Erledigt');
  await expect(
    page.getByText('Lokale IAM-Datenbank nicht erreichbar.', { exact: true }).first()
  ).toBeVisible();
  await page.getByRole('button', { name: 'Mandanten-Provisionierung erneut starten' }).click();
  await expect.poll(() => retryRequests).toBe(1);
  await expect(page.getByRole('tab', { name: 'Betrieb' })).toHaveAttribute('data-state', 'active');
  await expect(page.locator('#instance-current-task')).not.toContainText('Betriebsbereit');
});

test('an active tenant with degraded IAM remains in Betrieb at narrow width and zoom', async ({
  page,
}) => {
  const instanceDetail = { ...baseInstanceDetail, status: 'active' };
  await registerPlatformAccountAdminAuthRoute(page);
  await registerInstanceListRoutes(page, [instanceDetail]);
  await page.route('**/api/v1/iam/instances/demo', (route) =>
    route.fulfill({ json: { data: instanceDetail } })
  );
  await page.route('**/api/v1/iam/instances/demo/keycloak/status', (route) =>
    route.fulfill({ json: { data: instanceDetail.keycloakStatus } })
  );
  await gotoHomeAsAuthenticatedUser(page, 'Root Admin');
  await navigateClientSide(page, '/admin/instances/demo');
  await expect(page.getByRole('tab', { name: 'Betrieb' })).toHaveAttribute('data-state', 'active');
  await expect(page.locator('#instance-setup-heading')).toHaveCount(0);
  for (const [width, zoom] of [
    [320, '1'],
    [1280, '2'],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate((value) => {
      document.documentElement.style.zoom = value;
    }, zoom);
    await page.getByRole('tab', { name: 'Doctor' }).click();
    await expect(page.getByTestId('instance-doctor-overview')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.getByRole('tab', { name: 'Betrieb' }).click();
  }
});
