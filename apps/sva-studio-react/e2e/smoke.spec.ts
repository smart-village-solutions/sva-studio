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

const isExternalAuthRedirect = (location: string | null | undefined) =>
  Boolean(location?.match(/(\/protocol\/openid-connect\/auth\?|accounts\.google\.com\/(signin\/oauth\/error|o\/oauth2\/v2\/auth))/));

test('GET / returns 200 and renders app shell', async ({ page }) => {
  const response = await page.goto('/');
  expect(response).not.toBeNull();
  if (!response) {
    throw new Error('Antwort für GET / erwartet.');
  }
  expect(response.status()).toBeLessThan(400);
  await expect(page.getByRole('heading', { name: 'SVA Studio' })).toBeVisible();
});

test('GET /interfaces returns 200', async ({ page }) => {
  const response = await page.goto('/interfaces');
  expect(response).not.toBeNull();
  if (!response) {
    throw new Error('Antwort für GET /interfaces erwartet.');
  }
  expect(response.status()).toBeLessThan(400);
  await expect(page.getByRole('heading', { name: 'Schnittstellen' })).toBeVisible();
});

test('interfaces page uses the real /_server transport during overview load', async ({ page }) => {
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

    await route.continue();
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto('/interfaces');
  await expect(page.getByRole('heading', { name: 'Schnittstellen' })).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(
      () =>
        serverFnResponses.find(
          (response) => response.method === 'GET' && isInterfacesServerFn(response.descriptor, 'loadInterfacesOverview')
        )?.status,
      { timeout: 20_000 }
    )
    .toBe(200);

  const loadResponse = serverFnResponses.find(
    (response) => response.method === 'GET' && isInterfacesServerFn(response.descriptor, 'loadInterfacesOverview')
  );
  expect(loadResponse?.url).toContain('/_server/');
  expect(loadResponse?.body).not.toContain('Only HTML requests are supported here');
  expect(pageErrors).toEqual([]);
});

test('GET /plugins/example returns 200', async ({ page }) => {
  const response = await page.goto('/plugins/example');
  expect(response).not.toBeNull();
  if (!response) {
    throw new Error('Antwort für GET /plugins/example erwartet.');
  }
  expect(response.status()).toBeLessThan(400);
  await expect(page.getByRole('heading', { name: 'Plugin-Beispiel' })).toBeVisible();
});

test('GET /auth/login returns redirect response', async ({ request }) => {
  const response = await request.get('/auth/login', {
    maxRedirects: 0,
  });

  if ([302, 303, 307, 308].includes(response.status())) {
    expect(isExternalAuthRedirect(response.headers().location)).toBe(true);
    return;
  }

  expect(response.status()).toBe(503);
  await expect(response.json()).resolves.toMatchObject({
    error: 'internal_error',
  });
});

test('tenant-host login fails closed when canonical auth redirect prerequisites are unavailable', async ({ request }) => {
  const tenantLoginUrl = process.env.PLAYWRIGHT_TENANT_LOGIN_URL ?? 'http://hb.studio.lvh.me:4173/auth/login?returnTo=%2Fadmin%2Finstances';
  const parsedTenantLoginUrl = new URL(tenantLoginUrl);
  const requestUrl =
    parsedTenantLoginUrl.hostname === 'hb.studio.lvh.me'
      ? new URL(`${parsedTenantLoginUrl.pathname}${parsedTenantLoginUrl.search}`, 'http://127.0.0.1:4173').toString()
      : tenantLoginUrl;

  const response = await request.get(requestUrl, {
    headers:
      parsedTenantLoginUrl.hostname === 'hb.studio.lvh.me'
        ? {
            host: parsedTenantLoginUrl.host,
          }
        : undefined,
    maxRedirects: 0,
  });

  expect(response.status()).toBe(503);
  await expect(response.json()).resolves.toMatchObject({
    error: 'internal_error',
  });
});

test('router keeps the shell active during client-side navigation', async ({ page }) => {
  const pageErrors: string[] = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto('/plugins/example');
  await expect(page.locator('html')).toHaveAttribute('data-theme', /.+/);
  await expect(page.getByRole('heading', { name: 'Plugin-Beispiel' })).toBeVisible();
  await page.evaluate(async () => {
    const router = (
      window as typeof window & {
        __SVA_PLAYWRIGHT_ROUTER__?: {
          navigate: (options: { to: string }) => Promise<void> | void;
        };
      }
    ).__SVA_PLAYWRIGHT_ROUTER__;

    if (!router) {
      throw new Error('Playwright router hook fehlt.');
    }

    await router.navigate({ to: '/interfaces' });
  });
  await expect(page).toHaveURL(/\/interfaces$/);
  await expect(page.getByRole('heading', { name: 'Schnittstellen' })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
