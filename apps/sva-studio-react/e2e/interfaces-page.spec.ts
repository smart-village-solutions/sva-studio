import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { createEmptyPaginatedDataResponse } from './studio-shell.helpers';

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
      body: createEmptyPaginatedDataResponse(),
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

test('interfaces page uses the real /_server transport for overview load', async ({ page }) => {
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
  await expect(page.getByRole('heading', { name: 'Schnittstellen', exact: true, level: 1 })).toBeVisible({
    timeout: 20_000,
  });

  const loadResponse = serverFnResponses.find((response) => response.method === 'GET');
  expect(loadResponse?.url).toContain('/_server/');
  expect(loadResponse?.body).not.toContain('Only HTML requests are supported here');

  expect(pageErrors).toEqual([]);
});
