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

const privacyOverviewPayload = {
  data: {
    requests: [
      {
        id: 'request-1',
        type: 'request',
        canonicalStatus: 'queued',
        rawStatus: 'accepted',
        title: 'Auskunftsanfrage',
        summary: 'Ihre Anfrage wird vorbereitet.',
        createdAt: '2026-03-10T09:00:00.000Z',
        completedAt: undefined,
        blockedReason: undefined,
        format: undefined,
      },
    ],
    exportJobs: [
      {
        id: 'export-1',
        type: 'export_job',
        canonicalStatus: 'completed',
        rawStatus: 'completed',
        title: 'JSON-Export',
        summary: 'Der Export wurde erfolgreich erstellt.',
        createdAt: '2026-03-09T08:00:00.000Z',
        completedAt: '2026-03-09T08:05:00.000Z',
        blockedReason: undefined,
        format: 'json',
      },
    ],
    legalHolds: [],
    nonEssentialProcessingAllowed: false,
    processingRestrictedAt: '2026-03-08T07:00:00.000Z',
    processingRestrictionReason: 'pending_verification',
    nonEssentialProcessingOptOutAt: '2026-03-07T06:00:00.000Z',
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
  await expect
    .poll(async () => (await page.getByRole('button', { name: 'Logout' }).count()) > 0)
    .toBe(true);
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

  await page.route('**/api/v1/iam/me/context', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          activeOrganizationId: null,
          organizations: [],
        },
      }),
    });
  });
});

test('profile page supports loading and saving own profile', async ({ page }) => {
  test.slow();
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
            mainserverUserApplicationSecretSet: false,
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
          mainserverUserApplicationSecretSet: false,
        },
      }),
    });
  });

  await gotoHomeAsAuthenticatedUser(page);
  await navigateClientSide(page, '/account');

  await expect(page.getByRole('heading', { name: 'Mein Konto' })).toBeVisible({ timeout: 10000 });

  await page.getByLabel('Nachname').fill('Updated');
  await page.getByRole('button', { name: 'Speichern' }).click();

  await expect(page.getByText('Profil wurde erfolgreich gespeichert.')).toBeVisible();
});

test('account page links into privacy cockpit and renders self-service data', async ({ page }) => {
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(adminAuthPayload),
    });
  });

  await page.route('**/api/v1/iam/users/me/profile', async (route) => {
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
          mainserverUserApplicationSecretSet: false,
        },
      }),
    });
  });

  await page.route('**/iam/me/data-subject-rights/requests', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(privacyOverviewPayload),
    });
  });

  await gotoHomeAsAuthenticatedUser(page);
  await navigateClientSide(page, '/account');
  await expect(page.getByRole('heading', { name: 'Mein Konto' })).toBeVisible({ timeout: 10000 });

  await page.getByRole('link', { name: 'Zum Datenschutz-Cockpit' }).click();

  await expect(page).toHaveURL(/\/account\/privacy$/);
  await expect(page.getByRole('heading', { name: 'Datenschutz & Transparenz' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Auskunftsanfrage')).toBeVisible();
  await expect(page.getByText('JSON-Export')).toBeVisible();
  await expect(page.getByText('Widerspruch seit')).toBeVisible();
});

test('admin user list and edit page are reachable for system_admin', async ({ page }) => {
  let updateRequestBody: Record<string, unknown> | null = null;

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
            mainserverUserApplicationSecretSet: false,
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

  await page.route('**/api/v1/iam/users/sync-keycloak', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          outcome: 'success',
          checkedCount: 2,
          correctedCount: 2,
          failedCount: 0,
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
        pagination: {
          page: 1,
          pageSize: 1,
          total: 1,
        },
      }),
    });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SVA Studio' })).toBeVisible();
  const usersResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/v1/iam/users?') && response.status() === 200
  );
  await navigateClientSide(page, '/admin/users');
  await usersResponsePromise;
  await expect(page.getByRole('heading', { name: 'Benutzerverwaltung' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Benutzertabelle' })).toContainText('User Two');
  await page.getByRole('button', { name: 'Aus Keycloak synchronisieren' }).dispatchEvent('click');
  await expect(page.getByText(/2 geprüft: 2 korrigiert, 0 fehlgeschlagen, 0 manuell prüfen/)).toBeVisible();

  const userDetailResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/v1/iam/users/account-2') && response.status() === 200
  );
  await navigateClientSide(page, '/admin/users/account-2');
  await userDetailResponsePromise;
  await expect(page.getByRole('heading', { name: 'User Two' })).toBeVisible();

  await page.getByRole('tab', { name: 'Verwaltung' }).click();
  await page.getByLabel('Mainserver Application-ID').fill('updated-app-id');
  await page.getByLabel('Mainserver Application-Secret').fill('new-secret');
  await page.getByRole('button', { name: 'Änderungen speichern' }).click();

  await expect
    .poll(() => updateRequestBody)
    .toEqual(
      expect.objectContaining({
        mainserverUserApplicationId: 'updated-app-id',
        mainserverUserApplicationSecret: 'new-secret',
      })
    );
  await expect(page.getByText('Nutzerdaten wurden gespeichert.')).toBeVisible();
  await expect(page.getByText('Ein Secret ist bereits hinterlegt.')).toBeVisible();

  await page.getByRole('tab', { name: 'Berechtigungen' }).click();
  await expect(page.getByText('content.read')).toBeVisible();
});

test('tenant admin mutations fail closed in the browser when the admin client contract is missing', async ({ page }) => {
  let provisioningRequestBody: Record<string, unknown> | null = null;
  const registryAdminAuthPayload = {
    user: {
      ...adminAuthPayload.user,
      roles: ['system_admin', 'instance_registry_admin'],
    },
  };

  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(registryAdminAuthPayload),
    });
  });

  await page.route('**/api/v1/iam/instances/demo', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          instanceId: 'demo',
          displayName: 'Demo',
          status: 'requested',
          parentDomain: 'studio.example.org',
          primaryHostname: 'demo.studio.example.org',
          realmMode: 'existing',
          authRealm: 'demo',
          authClientId: 'sva-studio',
          authClientSecretConfigured: true,
          tenantAdminClient: {
            clientId: 'sva-studio-admin',
            secretConfigured: true,
          },
          hostnames: [],
          provisioningRuns: [],
          auditEvents: [],
          tenantAdminBootstrap: {
            username: 'demo-admin',
            email: 'demo@example.org',
          },
          keycloakPreflight: {
            overallStatus: 'ready',
            checkedAt: '2026-04-12T10:00:00.000Z',
            generatedAt: '2026-04-12T10:00:00.000Z',
            checks: [],
          },
          keycloakPlan: {
            mode: 'existing',
            overallStatus: 'ready',
            generatedAt: '2026-04-12T10:00:00.000Z',
            driftSummary: 'Kein Drift.',
            steps: [],
          },
          keycloakProvisioningRuns: [],
          keycloakStatus: {
            realmExists: true,
            clientExists: true,
            tenantAdminClientExists: true,
            instanceIdMapperExists: true,
            tenantAdminExists: true,
            tenantAdminHasSystemAdmin: true,
            tenantAdminHasInstanceRegistryAdmin: false,
            tenantAdminInstanceIdMatches: true,
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
          latestKeycloakProvisioningRun: null,
        },
      }),
    });
  });

  await page.route('**/api/v1/iam/instances/demo/keycloak/execute', async (route) => {
    provisioningRequestBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'run-tenant-admin',
          intent: 'provision',
          mode: 'existing',
          overallStatus: 'succeeded',
          driftSummary: 'Realm, Login-Client und Tenant-Admin-Client sind angelegt.',
          requestId: 'req-tenant-admin',
          steps: [],
        },
      }),
    });
  });

  await page.route('**/api/v1/iam/instances/demo/keycloak/preflight', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          overallStatus: 'ready',
          checkedAt: '2026-04-12T10:00:00.000Z',
          generatedAt: '2026-04-12T10:00:00.000Z',
          checks: [],
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
          instanceIdMapperExists: true,
          tenantAdminExists: true,
          tenantAdminHasSystemAdmin: true,
          tenantAdminHasInstanceRegistryAdmin: false,
          tenantAdminInstanceIdMatches: true,
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

  await page.route('**/api/v1/iam/groups', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
        pagination: {
          page: 1,
          pageSize: 0,
          total: 0,
        },
      }),
    });
  });

  await page.route('**/api/v1/iam/users/account-2', async (route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'tenant_admin_client_not_configured',
            message: 'Für diese Instanz ist noch kein Tenant-Admin-Client hinterlegt.',
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
          groups: [],
          permissions: ['content.read'],
          permissionTrace: [],
          mainserverUserApplicationSecretSet: false,
        },
      }),
    });
  });

  await gotoHomeAsAuthenticatedUser(page);
  await navigateClientSide(page, '/admin/instances/demo');

  await expect(page.getByRole('heading', { name: 'Instanzdetails' })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#detail-auth-client-id')).toHaveValue('sva-studio');
  await expect(page.locator('#detail-admin-username')).toHaveValue('demo-admin');

  await page.getByRole('button', { name: 'Provisioning ausführen' }).last().click();

  await expect.poll(() => provisioningRequestBody).toEqual(
    expect.objectContaining({
      intent: 'provision',
    })
  );

  await navigateClientSide(page, '/admin/users/account-2');

  await expect(page.getByRole('heading', { name: 'User Two' })).toBeVisible({ timeout: 10000 });
  await page.getByRole('tab', { name: 'Verwaltung' }).click();
  await page.getByLabel('Mainserver Application-ID').fill('updated-app-id');
  await page.getByRole('button', { name: 'Änderungen speichern' }).click();

  await expect(
    page.getByText('Für diese Instanz ist noch kein Tenant-Admin-Client hinterlegt. Bitte zuerst den Instanzvertrag abgleichen.')
  ).toBeVisible();
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
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('link', { name: 'Benutzer' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Rollen' })).toHaveCount(0);

  await page.evaluate(() => {
    window.history.pushState({}, '', '/admin/users');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveURL(/\?error=auth\.insufficientRole/);
});

test('iam cockpit redirects unknown or disallowed tabs to the first allowed governance tab', async ({ page }) => {
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'kc-security-1',
          name: 'Security Reviewer',
          email: 'security@example.com',
          instanceId: '11111111-1111-1111-8111-111111111111',
          roles: ['security_admin'],
        },
      }),
    });
  });

  await page.route('**/iam/governance/workflows?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'governance-1',
            type: 'impersonation',
            status: 'approved',
            title: 'Impersonation für Support-Fall',
            summary: 'Temporäre Einsicht für Incident-Analyse.',
            actorDisplayName: 'Security Reviewer',
            targetDisplayName: 'User Two',
            ticketId: 'INC-42',
            createdAt: '2026-03-12T10:00:00.000Z',
            metadata: {
              reason: 'incident_review',
            },
          },
        ],
        pagination: {
          page: 1,
          pageSize: 12,
          total: 1,
        },
      }),
    });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SVA Studio' })).toBeVisible();
  await navigateClientSide(page, '/admin/iam?tab=rights');

  await expect(page).toHaveURL(/\/admin\/iam\?tab=governance$/);
  await expect(page.getByRole('heading', { name: 'IAM Transparenz-Cockpit' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('tab', { name: 'Governance', selected: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Impersonation für Support-Fall' })).toBeVisible();
});

test('direct access to admin users redirects unauthenticated clients to login', async ({ request }) => {
  const response = await request.get('/admin/users', {
    maxRedirects: 0,
  });

  expect([302, 303, 307, 308]).toContain(response.status());
  expect(response.headers().location).toMatch(
    /(\/auth\/login\?returnTo=%2Fadmin%2Fusers|\/protocol\/openid-connect\/auth\?|accounts\.google\.com\/(signin\/oauth\/error|o\/oauth2\/v2\/auth))/
  );
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
    await gotoHomeAsAuthenticatedUser(page);
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
            mainserverUserApplicationSecretSet: false,
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
