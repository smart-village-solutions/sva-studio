import AxeBuilder from '@axe-core/playwright';
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

  await gotoHomeAsAuthenticatedUser(page, 'Interface Manager');
  await navigateClientSide(page, '/interfaces');
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

for (const width of [1280, 390]) {
  test(`app configuration preview keeps edits local at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockAuthenticatedInterfacesShell(page);
    let readingPreview = false;
    const previewRequests: string[] = [];
    const writeRequests: string[] = [];
    await page.route('**/_server/**', async (route) => {
      if (route.request().method() !== 'GET') {
        writeRequests.push(route.request().method());
        await route.abort();
        return;
      }
      if (!readingPreview) {
        await route.fulfill({
          json: { result: { instanceId: 'de-musterhausen', entries: [], availableTypes: [] } },
        });
        return;
      }
      previewRequests.push(route.request().method());
      await route.fulfill({
        json: {
          result: {
            status: 'loaded',
            instanceId: 'de-musterhausen',
            requestedVersion: '5.0.0',
            record: { id: '17', name: 'globalSettings', version: '4.0.0' },
            fallback: true,
            fields: {
              alternativeLocation: { state: 'value', value: false },
              tileTitleLines: { state: 'value', value: 3 },
            },
          },
        },
      });
    });
    await gotoHomeAsAuthenticatedUser(page, 'Interface Manager');
    await navigateClientSide(page, '/interfaces');
    await page.getByRole('button', { name: 'App-Konfiguration öffnen' }).click();
    await expect(
      page.getByRole('heading', { name: 'App-Konfiguration', exact: true })
    ).toBeVisible();
    await page.getByLabel('Gewünschte App-Version').fill('5.0.0');
    await page.getByLabel('Gewünschte App-Version').focus();
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('button', { name: 'Konfiguration laden', exact: true })
    ).toBeFocused();
    readingPreview = true;
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Alternative Standortwahl anzeigen')).toHaveValue('false');
    await expect(page.getByText(/andere Variante als angefragt/)).toBeVisible();
    await expect(page.getByText('4.0.0', { exact: true })).toBeVisible();
    await page.getByLabel('Alternative Standortwahl anzeigen').selectOption('true');
    await page.getByLabel('Zeilen für Service-Kacheltitel').fill('5');
    const preview = page.getByRole('table', { name: 'Lokale Änderungsvorschau' });
    await expect(preview.getByRole('cell', { name: 'Ja', exact: true })).toBeVisible();
    await expect(preview.getByRole('cell', { name: '5', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /speichern/i })).toHaveCount(0);
    expect(previewRequests).toEqual(['GET']);
    expect(writeRequests).toEqual([]);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    if (width === 1280) {
      const result = await new AxeBuilder({ page })
        .include('#app-configuration-preview')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(result.violations).toEqual([]);
    }
    await page
      .locator('#app-configuration-preview')
      .screenshot({ path: test.info().outputPath(`app-configuration-${width}.png`) });
    await page.getByRole('button', { name: 'Änderungen verwerfen' }).click();
    await expect(page.getByLabel('Alternative Standortwahl anzeigen')).toHaveValue('false');
    await expect(page.getByLabel('Zeilen für Service-Kacheltitel')).toHaveValue('3');
    expect(previewRequests).toEqual(['GET']);
    expect(writeRequests).toEqual([]);
  });
}
