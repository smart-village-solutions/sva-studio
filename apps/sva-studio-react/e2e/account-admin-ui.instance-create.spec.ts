import { expect, test } from '@playwright/test';

import {
  configureRootAccountAdminTest,
  gotoHomeAsAuthenticatedUser,
  navigateClientSide,
  registerInstanceListRoutes,
  registerPlatformAccountAdminAuthRoute,
} from './account-admin-ui.helpers';

configureRootAccountAdminTest(test);

test('new-realm create uses the four-step flow and opens the shared cockpit', async ({ page }) => {
  let createRequestBody: Record<string, unknown> | null = null;
  const createdInstance = {
    instanceId: 'demo',
    displayName: 'Demo',
    status: 'requested',
    parentDomain: 'studio.example.org',
    primaryHostname: 'demo.studio.example.org',
    realmMode: 'new',
    authRealm: 'demo',
    authClientId: 'tenant-client',
    authClientSecretConfigured: false,
    hostnames: [],
  };
  const instanceDetail = {
    ...createdInstance,
    assignedModules: [],
    provisioningRuns: [],
    keycloakProvisioningRuns: [],
    auditEvents: [],
    provisioningReadiness: {
      state: 'provisioning_waiting',
      capabilities: [],
      nextAction: { action: 'instance.keycloak.execute', retryClass: 'conditional' },
    },
  };

  await registerPlatformAccountAdminAuthRoute(page);
  await registerInstanceListRoutes(page, [instanceDetail]);
  await page.route('**/api/v1/iam/instances/draft-readiness', async (route) => {
    const draft = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          checkedAt: '2026-09-20T12:00:00.000Z',
          contractVersion: '1.0',
          draftFingerprint: 'a'.repeat(64),
          normalizedDraft: {
            instanceId: draft.instanceId,
            primaryHostname: 'demo.studio.example.org',
            realmMode: draft.realmMode,
            authRealm: draft.authRealm,
            authClientId: draft.authClientId,
            authClientSecretConfigured: false,
          },
          createBlockers: [],
          provisioningBlockers: [],
          activationBlockers: [],
          backgroundCapabilities: [],
          preflight: {
            overallStatus: 'ready',
            checkedAt: '2026-09-20T12:00:00.000Z',
            checks: [],
          },
        },
      }),
    });
  });
  await page.route('**/api/v1/iam/instances/demo', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          ...instanceDetail,
          tenantAdminClient: { clientId: 'sva-studio-realm-admin', secretConfigured: true },
          keycloakStatus: {
            realmExists: true,
            clientExists: true,
            tenantAdminClientExists: true,
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
        },
      }),
    });
  });
  await page.route('**/api/v1/iam/instances/demo/keycloak/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          realmExists: true,
          clientExists: true,
          tenantAdminClientExists: true,
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
      }),
    });
  });
  await page.route('**/api/v1/iam/instances', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    createRequestBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ data: createdInstance }),
    });
  });
  await gotoHomeAsAuthenticatedUser(page, 'Root Admin');
  await navigateClientSide(page, '/admin/instances/new');
  await page.locator('#instance-id').fill('demo');
  await page.locator('#instance-display-name').fill('Demo');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByText('Technische Details')).toBeVisible();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.locator('#instance-admin-username').fill('setup-admin');
  await page.locator('#instance-admin-email').fill('admin@example.org');
  await page.locator('#instance-admin-first-name').fill('Setup');
  await page.locator('#instance-admin-last-name').fill('Admin');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByRole('region', { name: 'Vor der Anlage zu beheben' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Wird von Studio eingerichtet' })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Vor der Aktivierung noch erforderlich' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Instanz anlegen' }).click();
  await expect
    .poll(() => createRequestBody)
    .toEqual(
      expect.objectContaining({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'studio.localhost',
        realmMode: 'new',
        authRealm: 'demo',
        authClientId: 'sva-studio-login',
      })
    );
  await expect(page).toHaveURL(/\/admin\/instances\/demo$/u);
  await expect(page.getByRole('heading', { name: 'Instanzdetails' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Provisioning ausführen' })).toBeVisible();
});

test('existing-realm create rejects reserved choices and submits the selected eligible realm', async ({
  page,
}) => {
  let createRequestBody: Record<string, unknown> | null = null;
  await registerPlatformAccountAdminAuthRoute(page);
  await registerInstanceListRoutes(page, []);
  await page.route('**/api/v1/iam/instances/keycloak-realms**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { realm: 'master', status: 'disabled', reasonCode: 'system_realm' },
          { realm: 'occupied', status: 'disabled', reasonCode: 'already_assigned' },
          { realm: 'tenant-existing', status: 'selectable' },
        ],
        pagination: { page: 1, pageSize: 100, total: 3 },
      }),
    });
  });
  await page.route('**/api/v1/iam/instances/draft-readiness', async (route) => {
    const draft = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          checkedAt: '2026-09-20T12:00:00.000Z',
          contractVersion: '1.0',
          draftFingerprint: 'b'.repeat(64),
          normalizedDraft: {
            instanceId: draft.instanceId,
            primaryHostname: 'existing-demo.studio.example.org',
            realmMode: 'existing',
            authRealm: 'tenant-existing',
            authClientId: draft.authClientId,
            authClientSecretConfigured: false,
          },
          createBlockers: [],
          provisioningBlockers: [],
          activationBlockers: [],
          backgroundCapabilities: [],
          preflight: {
            overallStatus: 'ready',
            checkedAt: '2026-09-20T12:00:00.000Z',
            checks: [],
          },
          realmSuitability: {
            classification: 'ready',
            reasonCode: 'studio_artifacts_ready',
            impact: 'activation',
            remediation: 'Keine Realm-Nacharbeit erforderlich.',
            responsibility: 'studio_admin',
            nextCheck: 'draft_readiness',
            plan: {
              contractVersion: '1.0',
              fingerprint: 'c'.repeat(64),
              mode: 'existing',
              overallStatus: 'ready',
              generatedAt: '2026-09-20T12:00:00.000Z',
              driftSummary: 'Kein Drift.',
              steps: [],
            },
          },
        },
      }),
    });
  });
  await page.route('**/api/v1/iam/instances', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    createRequestBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          instanceId: 'existing-demo',
          displayName: 'Existing Demo',
          status: 'requested',
          parentDomain: 'studio.example.org',
          primaryHostname: 'existing-demo.studio.example.org',
          realmMode: 'existing',
          authRealm: 'tenant-existing',
          authClientId: 'sva-studio-login',
          hostnames: [],
        },
      }),
    });
  });

  await gotoHomeAsAuthenticatedUser(page, 'Root Admin');
  await navigateClientSide(page, '/admin/instances/new');
  await page.getByRole('radio', { name: /Bestehender Realm:/u }).check();
  await page.locator('#instance-id').fill('existing-demo');
  await page.locator('#instance-display-name').fill('Existing Demo');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.locator('#instance-auth-realm').click();
  await expect(page.getByRole('option', { name: /master/u })).toHaveAttribute(
    'aria-disabled',
    'true'
  );
  await expect(page.getByRole('option', { name: /occupied/u })).toHaveAttribute(
    'aria-disabled',
    'true'
  );
  await page.getByRole('option', { name: 'tenant-existing' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.locator('#instance-admin-username').fill('existing-admin');
  await page.locator('#instance-admin-email').fill('existing-admin@example.org');
  await page.locator('#instance-admin-first-name').fill('Existing');
  await page.locator('#instance-admin-last-name').fill('Admin');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Instanz anlegen' }).click();

  await expect
    .poll(() => createRequestBody)
    .toEqual(
      expect.objectContaining({
        instanceId: 'existing-demo',
        realmMode: 'existing',
        authRealm: 'tenant-existing',
      })
    );
  await expect(page).toHaveURL(/\/admin\/instances\/existing-demo$/u);
});

test('authoritative create blockers keep the final action disabled', async ({ page }) => {
  let createRequested = false;
  await registerPlatformAccountAdminAuthRoute(page);
  await registerInstanceListRoutes(page, []);
  await page.route('**/api/v1/iam/instances/draft-readiness', async (route) => {
    const draft = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          checkedAt: '2026-09-20T12:00:00.000Z',
          contractVersion: '1.0',
          draftFingerprint: 'd'.repeat(64),
          normalizedDraft: {
            instanceId: draft.instanceId,
            primaryHostname: 'blocked-demo.studio.example.org',
            realmMode: 'new',
            authRealm: draft.authRealm,
            authClientId: draft.authClientId,
            authClientSecretConfigured: false,
          },
          createBlockers: [
            {
              checkKey: 'keycloak_admin_access',
              title: 'Technischer Keycloak-Zugriff',
              status: 'blocked',
              summary: 'Keycloak ist für die verbindliche Anlageprüfung nicht erreichbar.',
              details: {
                reasonCode: 'keycloak_unavailable',
                remediation: 'Keycloak-Verbindung prüfen und erneut prüfen.',
              },
            },
          ],
          provisioningBlockers: [],
          activationBlockers: [],
          backgroundCapabilities: [],
          preflight: {
            overallStatus: 'blocked',
            checkedAt: '2026-09-20T12:00:00.000Z',
            checks: [],
          },
        },
      }),
    });
  });
  await page.route('**/api/v1/iam/instances', async (route) => {
    if (route.request().method() === 'POST') createRequested = true;
    await route.fallback();
  });

  await gotoHomeAsAuthenticatedUser(page, 'Root Admin');
  await navigateClientSide(page, '/admin/instances/new');
  await page.locator('#instance-id').fill('blocked-demo');
  await page.locator('#instance-display-name').fill('Blocked Demo');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.locator('#instance-admin-username').fill('blocked-admin');
  await page.locator('#instance-admin-email').fill('blocked-admin@example.org');
  await page.locator('#instance-admin-first-name').fill('Blocked');
  await page.locator('#instance-admin-last-name').fill('Admin');
  await page.getByRole('button', { name: 'Weiter' }).click();

  const createBlockers = page.getByRole('region', { name: 'Vor der Anlage zu beheben' });
  await expect(createBlockers.getByText('Technischer Keycloak-Zugriff')).toBeVisible();
  await expect(
    createBlockers.getByText('Die serverseitige Prüfung blockiert den nächsten Schritt.')
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Instanz anlegen' })).toBeDisabled();
  expect(createRequested).toBe(false);
});
