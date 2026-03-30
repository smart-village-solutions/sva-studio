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

const isExternalAuthRedirect = (location: string | null | undefined) =>
  Boolean(location?.match(/(\/protocol\/openid-connect\/auth\?|accounts\.google\.com\/(signin\/oauth\/error|o\/oauth2\/v2\/auth))/));

test('GET / returns 200 and renders app shell', async ({ page }) => {
  const response = await page.goto('/');
  expect(response).not.toBeNull();
  expect(response!.status()).toBeLessThan(400);
  await expect(page.getByRole('heading', { name: 'SVA Studio' })).toBeVisible();
});

test('GET /demo returns 200', async ({ page }) => {
  const response = await page.goto('/demo');
  expect(response).not.toBeNull();
  expect(response!.status()).toBeLessThan(400);
  await expect(page.getByText('TanStack Start Demos')).toBeVisible();
});

test('GET /plugins/example returns 200', async ({ page }) => {
  const response = await page.goto('/plugins/example');
  expect(response).not.toBeNull();
  expect(response!.status()).toBeLessThan(400);
  await expect(page.getByRole('heading', { name: 'Plugin Example' })).toBeVisible();
});

test('GET /auth/login returns redirect response', async ({ request }) => {
  const response = await request.get('/auth/login', {
    maxRedirects: 0,
  });

  if ([302, 303, 307, 308].includes(response.status())) {
    expect(isExternalAuthRedirect(response.headers().location)).toBe(true);
    return;
  }

  expect(response.status()).toBe(500);
  await expect(response.json()).resolves.toMatchObject({
    error: 'internal_error',
  });
});

test('demo server function uses the real /_server transport', async ({ page }) => {
  const pageErrors: string[] = [];
  const serverFnResponses = captureServerFnResponses(page);

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto('/demo/start/server-funcs');
  await expect(page.locator('html')).toHaveAttribute('data-theme', /.+/);
  await expect(page.getByPlaceholder('Dein Name')).toBeVisible();

  await page.getByPlaceholder('Dein Name').fill('Debug');
  await page.getByRole('button', { name: 'Server Function ausführen' }).click();
  await expect(page.getByText('Hallo Debug!')).toBeVisible();
  await expect
    .poll(() => serverFnResponses.find((response) => response.method === 'POST')?.status)
    .toBe(200);

  const response = serverFnResponses.find((entry) => entry.method === 'POST');
  expect(response?.url).toContain('/_server/');
  expect(response?.body).not.toContain('Only HTML requests are supported here');
  expect(pageErrors).toEqual([]);
});
