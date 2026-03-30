import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

type ServerFnDescriptor = {
  readonly export?: string;
  readonly file?: string;
};

type RecordedServerFnResponse = {
  body: string;
  descriptor: ServerFnDescriptor | null;
  readonly method: string;
  readonly status: number;
  readonly url: string;
};

const readServerFnDescriptor = (url: string): ServerFnDescriptor | null => {
  const encodedDescriptor = new URL(url).pathname.split('/_server/')[1];
  if (!encodedDescriptor) {
    return null;
  }

  try {
    const raw = Buffer.from(encodedDescriptor, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as { export?: unknown; file?: unknown };
    return {
      export: typeof parsed.export === 'string' ? parsed.export : undefined,
      file: typeof parsed.file === 'string' ? parsed.file : undefined,
    };
  } catch {
    return null;
  }
};

const isInterfacesServerFn = (descriptor: ServerFnDescriptor | null, exportName: string) =>
  descriptor?.file?.includes('/src/lib/interfaces-api.ts') && descriptor.export?.includes(exportName);

const captureServerFnResponses = (page: Page) => {
  const responses: RecordedServerFnResponse[] = [];

  page.on('response', (response) => {
    if (!response.url().includes('/_server/')) {
      return;
    }

    const entry: RecordedServerFnResponse = {
      body: '',
      descriptor: readServerFnDescriptor(response.url()),
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

test('interfaces page uses the real /_server transport for load and save', async ({ page }) => {
  const pageErrors: string[] = [];
  const serverFnResponses = captureServerFnResponses(page);

  await page.route('**/_server/**', async (route) => {
    const descriptor = readServerFnDescriptor(route.request().url());

    if (route.request().method() === 'GET' && isInterfacesServerFn(descriptor, 'loadInterfacesOverview')) {
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

    if (route.request().method() === 'POST' && isInterfacesServerFn(descriptor, 'saveSvaMainserverInterfaceSettings')) {
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
      () =>
        serverFnResponses.find(
          (response) => response.method === 'GET' && isInterfacesServerFn(response.descriptor, 'loadInterfacesOverview')
        )?.status,
      { timeout: 20_000 }
    )
    .toBe(200);
  await expect(page.getByRole('heading', { name: 'Schnittstellen' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel('GraphQL Basis-URL')).toBeEditable();
  await expect(page.getByLabel('OAuth Token-URL')).toBeEditable();

  const loadResponse = serverFnResponses.find(
    (response) => response.method === 'GET' && isInterfacesServerFn(response.descriptor, 'loadInterfacesOverview')
  );
  expect(loadResponse?.url).toContain('/_server/');
  expect(loadResponse?.body).not.toContain('Only HTML requests are supported here');

  await page.getByLabel('GraphQL Basis-URL').fill('https://saved.example.org/graphql');
  await page.getByLabel('OAuth Token-URL').fill('https://saved.example.org/oauth/token');
  await expect(page.getByLabel('GraphQL Basis-URL')).toHaveValue('https://saved.example.org/graphql');
  await expect(page.getByLabel('OAuth Token-URL')).toHaveValue('https://saved.example.org/oauth/token');

  await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
  await expect
    .poll(
      () =>
        serverFnResponses.filter(
          (response) => response.method === 'POST' && isInterfacesServerFn(response.descriptor, 'saveSvaMainserverInterfaceSettings')
        ).length
    )
    .toBeGreaterThan(0);
  await expect(
    page
      .getByText(
        /(Schnittstellen-Einstellungen konnten nicht gespeichert werden(?: \(HTTP 500\))?\.|Die Sitzung ist nicht mehr gültig\. Bitte erneut anmelden\.|Keine Berechtigung zur Schnittstellenverwaltung\.|Die Mainserver-Konfiguration ist ungültig\.|invalid_config)/
      )
      .first()
  ).toBeVisible();

  const saveResponse = serverFnResponses.find(
    (response) => response.method === 'POST' && isInterfacesServerFn(response.descriptor, 'saveSvaMainserverInterfaceSettings')
  );
  expect(saveResponse?.url).toContain('/_server/');
  expect(saveResponse?.body).not.toContain('Only HTML requests are supported here');
  await expect(page.getByText("Cannot read properties of null (reading 'value')")).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});
