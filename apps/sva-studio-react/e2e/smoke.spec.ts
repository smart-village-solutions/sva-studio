import { expect, test } from '@playwright/test';

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

  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', /.+/);
  await page.getByRole('link', { name: 'Schnittstellen' }).click();
  await expect(page).toHaveURL(/\/interfaces$/);
  await expect(page.getByRole('heading', { name: 'Schnittstellen' })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
