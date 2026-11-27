import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
  gotoHomeAsAuthenticatedUser,
  navigateClientSide,
  registerSharedIamRoutes,
} from './studio-shell.helpers';

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

    void response
      .text()
      .then((body) => {
        entry.body = body;
      })
      .catch(() => undefined);
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
          permissionActions: ['integration.manage'],
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
        permissions: [{ action: 'integration.manage', resourceType: 'integration' }],
        subject: {
          actorUserId: 'kc-interface-manager-1',
          effectiveUserId: 'kc-interface-manager-1',
          isImpersonating: false,
        },
        evaluatedAt: '2026-04-13T12:00:00.000Z',
      }),
    });
  });

  await registerSharedIamRoutes(page);
};

for (const outcome of ['success', 'unavailable', 'forbidden'] as const) {
  test(`interfaces retains the correct rows over /_server on ${outcome}`, async ({ page }) => {
    const pageErrors: string[] = [];
    const serverFnResponses = captureServerFnResponses(page);
    let returning = false;
    let backgroundRead = false;
    let retryRequested = false;
    let releaseRefresh: () => void = () => undefined;
    const refresh = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });

    await mockAuthenticatedInterfacesShell(page);
    await page.route('**/_server/**', async (route) => {
      if (route.request().method() === 'GET') {
        const refreshRead = returning;
        if (refreshRead) {
          backgroundRead = true;
          await refresh;
          if (outcome !== 'success' && !retryRequested) {
            const statusCode = outcome === 'forbidden' ? 403 : 503;
            await route.fulfill({
              json: { error: { message: outcome, statusCode } },
            });
            return;
          }
        }
        await route.fulfill({
          status: 200,
          json: {
            result: {
              instanceId: 'de-musterhausen',
              availableTypes: ['mainserver'],
              entries: [
                {
                  id: 'mainserver-1',
                  instanceId: 'de-musterhausen',
                  name: refreshRead ? 'Mainserver aktualisiert' : 'Mainserver vorher',
                  type: 'mainserver',
                  config: {
                    graphqlBaseUrl: 'https://initial.example.org/graphql',
                    oauthTokenUrl: 'https://initial.example.org/oauth/token',
                  },
                  enabled: true,
                  status: 'connected',
                  createdAt: '2026-03-26T08:45:40.000Z',
                  updatedAt: '2026-03-26T08:45:40.000Z',
                },
              ],
            },
          },
        });
        return;
      }

      await route.continue();
    });

    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await gotoHomeAsAuthenticatedUser(page, 'Interface Manager');
    await navigateClientSide(page, '/interfaces');
    await expect
      .poll(() => serverFnResponses.find((response) => response.method === 'GET')?.status, {
        timeout: 20_000,
      })
      .toBe(200);
    await expect(
      page.getByRole('heading', { name: 'Schnittstellen', exact: true, level: 1 })
    ).toBeVisible({
      timeout: 20_000,
    });

    const loadResponse = serverFnResponses.find((response) => response.method === 'GET');
    expect(loadResponse?.url).toContain('/_server/');
    expect(loadResponse?.body).not.toContain('Only HTML requests are supported here');
    try {
      await expect(page.getByRole('row', { name: /Mainserver vorher/ })).toBeVisible();
      await page.getByRole('complementary').getByRole('link', { name: 'Übersicht' }).click();
      await expect(page.getByRole('heading', { name: 'SVA Studio' })).toBeVisible();
      returning = true;
      await page.goBack();
      await expect.poll(() => backgroundRead).toBe(true);
      await expect(page.getByRole('row', { name: /Mainserver vorher/ })).toBeVisible();
      releaseRefresh();
      if (outcome === 'forbidden') {
        await expect(page.getByRole('alert')).toBeVisible();
        await expect(page.getByRole('row', { name: /Mainserver vorher/ })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Bearbeiten', exact: true })).toHaveCount(0);
      } else {
        if (outcome === 'unavailable') {
          await expect(page.getByRole('alert')).toBeVisible();
          await expect(page.getByRole('row', { name: /Mainserver vorher/ })).toBeVisible();
          retryRequested = true;
          await page.getByRole('button', { name: 'Neu laden' }).click();
        }
        await expect(page.getByRole('row', { name: /Mainserver aktualisiert/ })).toBeVisible();
      }
    } finally {
      releaseRefresh();
    }
    expect(pageErrors).toEqual([]);
  });
}
