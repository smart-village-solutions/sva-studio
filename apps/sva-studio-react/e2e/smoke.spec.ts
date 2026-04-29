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

const expectInterfacesShellReady = async (page: Page, timeout = 20_000) => {
  await expect
    .poll(
      async () => {
        const headingVisible = await page
          .getByRole('heading', { name: 'Schnittstellen' })
          .isVisible()
          .catch(() => false);
        if (headingVisible) {
          return true;
        }

        return page
          .getByText('Schnittstellen werden geladen ...')
          .isVisible()
          .catch(() => false);
      },
      { timeout }
    )
    .toBe(true);
};

const mockAuthenticatedPluginShell = async (page: Page) => {
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'kc-editor-1',
          name: 'Editor One',
          email: 'editor@example.com',
          instanceId: 'de-musterhausen',
          assignedModules: ['news', 'events', 'poi'],
          roles: ['editor'],
          permissionActions: [
            'news.read',
            'news.create',
            'news.update',
            'news.delete',
            'events.read',
            'events.create',
            'events.update',
            'events.delete',
            'poi.read',
            'poi.create',
            'poi.update',
            'poi.delete',
          ],
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
        permissions: [
          { action: 'news.read', resourceType: 'news' },
          { action: 'news.create', resourceType: 'news' },
          { action: 'news.update', resourceType: 'news' },
          { action: 'news.delete', resourceType: 'news' },
          { action: 'events.read', resourceType: 'events' },
          { action: 'events.create', resourceType: 'events' },
          { action: 'events.update', resourceType: 'events' },
          { action: 'events.delete', resourceType: 'events' },
          { action: 'poi.read', resourceType: 'poi' },
          { action: 'poi.create', resourceType: 'poi' },
          { action: 'poi.update', resourceType: 'poi' },
          { action: 'poi.delete', resourceType: 'poi' },
        ],
        subject: {
          actorUserId: 'kc-editor-1',
          effectiveUserId: 'kc-editor-1',
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

  await page.route('**/api/v1/mainserver/news**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
        pagination: {
          page: 1,
          pageSize: 25,
          hasNextPage: false,
        },
      }),
    });
  });
};

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
  await expectInterfacesShellReady(page);
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

const navigateWithPlaywrightRouter = async (page: Page, to: string) => {
  await page.evaluate(async (target) => {
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

    await router.navigate({ to: target });
  }, to);
};

test('authenticated client navigation to /admin/news renders the host-owned content route', async ({ page }) => {
  await mockAuthenticatedPluginShell(page);

  const response = await page.goto('/interfaces');
  expect(response).not.toBeNull();
  expect(response?.status()).toBeLessThan(400);
  await expectInterfacesShellReady(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', /.+/);
  await navigateWithPlaywrightRouter(page, '/admin/news');
  await expect(page).toHaveURL(/\/admin\/news(?:\?page=1&pageSize=25)?$/);
  await expect(page.getByRole('heading', { name: 'News', exact: true })).toBeVisible();
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

  await mockAuthenticatedPluginShell(page);

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto('/interfaces');
  await expectInterfacesShellReady(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', /.+/);
  await navigateWithPlaywrightRouter(page, '/admin/news');
  await expect(page.getByRole('heading', { name: 'News', exact: true })).toBeVisible();
  await navigateWithPlaywrightRouter(page, '/interfaces');
  await expect(page).toHaveURL(/\/interfaces$/);
  await expectInterfacesShellReady(page);
  expect(pageErrors).toEqual([]);
});
