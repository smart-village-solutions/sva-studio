import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

type RecordedServerFnResponse = {
  body: string;
  readonly method: string;
  readonly status: number;
  readonly url: string;
};

const captureServerFnResponses = (page: Page) => {
  const responses: RecordedServerFnResponse[] = [];

  page.on('response', (response) => {
    if (!response.url().includes('/_server/')) {
      return;
    }

    const entry: RecordedServerFnResponse = {
      body: '',
      method: response.request().method(),
      status: response.status(),
      url: response.url(),
    };
    responses.push(entry);

    void response.text().then((body) => {
      entry.body = body;
    }).catch(() => undefined);
  });

  return responses;
};

const mockAuthenticatedInterfacesShell = async (page: Page) => {
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'kc-interface-manager-1',
          name: 'Interface Manager',
          email: 'interfaces@example.com',
          instanceId: 'de-musterhausen',
          assignedModules: [],
          roles: ['interface_manager'],
          permissionActions: [],
        },
      }),
    });
  });

  await page.route('**/iam/me/permissions?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        instanceId: 'de-musterhausen',
        permissions: [],
        subject: {
          actorUserId: 'kc-interface-manager-1',
          effectiveUserId: 'kc-interface-manager-1',
          isImpersonating: false,
        },
        evaluatedAt: '2026-04-13T12:00:00.000Z',
      }),
    });
  });

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
      body: JSON.stringify({ data: [], pagination: { page: 1, pageSize: 0, total: 0 } }),
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
};

test('interfaces page uses the real /_server transport for load and save', async ({ page }) => {
  const pageErrors: string[] = [];
  const serverFnResponses = captureServerFnResponses(page);

  await mockAuthenticatedInterfacesShell(page);
  await page.route('**/_server/**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          instanceId: 'de-musterhausen',
          config: {
            graphqlBaseUrl: 'https://initial.example.org/graphql',
            oauthTokenUrl: 'https://initial.example.org/oauth/token',
            enabled: true,
          },
          status: {
            status: 'connected',
            checkedAt: '2026-03-26T08:45:40.000Z',
          },
        }),
      });
      return;
    }

    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'invalid_config',
        }),
      });
      return;
    }

    await route.continue();
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto('/interfaces');
  await expect
    .poll(
      () => serverFnResponses.find((response) => response.method === 'GET')?.status,
      { timeout: 20_000 }
    )
    .toBe(200);
  await expect(page.getByRole('heading', { name: 'Schnittstellen' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel('GraphQL Basis-URL')).toBeEditable();
  await expect(page.getByLabel('OAuth Token-URL')).toBeEditable();

  const loadResponse = serverFnResponses.find((response) => response.method === 'GET');
  expect(loadResponse?.url).toContain('/_server/');
  expect(loadResponse?.body).not.toContain('Only HTML requests are supported here');

  await page.getByLabel('GraphQL Basis-URL').fill('https://saved.example.org/graphql');
  await page.getByLabel('OAuth Token-URL').fill('https://saved.example.org/oauth/token');
  await expect(page.getByLabel('GraphQL Basis-URL')).toHaveValue('https://saved.example.org/graphql');
  await expect(page.getByLabel('OAuth Token-URL')).toHaveValue('https://saved.example.org/oauth/token');

  await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
  await expect
    .poll(
      () => serverFnResponses.filter((response) => response.method === 'POST').length
    )
    .toBeGreaterThan(0);
  await expect(
    page
      .getByText(
        /(Schnittstellen-Einstellungen konnten nicht gespeichert werden(?: \(HTTP 500\))?\.|Die Sitzung ist nicht mehr gültig\. Bitte erneut anmelden\.|Keine Berechtigung zur Schnittstellenverwaltung\.|Die Mainserver-Konfiguration ist ungültig\.|invalid_config)/
      )
      .first()
  ).toBeVisible();

  const saveResponse = serverFnResponses.find((response) => response.method === 'POST');
  expect(saveResponse?.url).toContain('/_server/');
  expect(saveResponse?.body).not.toContain('Only HTML requests are supported here');
  await expect(page.getByText("Cannot read properties of null (reading 'value')")).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});
