import { expect, test } from '@playwright/test';

import { assertRequiredServicesReady } from './service-readiness';

test.beforeAll(async () => {
  await assertRequiredServicesReady();
});

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

  expect([302, 303, 307, 308]).toContain(response.status());

  const location = response.headers().location;
  expect(location).toBeTruthy();
});
