import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

type RecordedServerFnResponse = {
  readonly body: string;
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

    void response.text().then((body) => {
      responses.push({
        body,
        method: response.request().method(),
        status: response.status(),
        url: response.url(),
      });
    });
  });

  return responses;
};

test('interfaces page uses the real /_server transport for load and save', async ({ page }) => {
  const pageErrors: string[] = [];
  const serverFnResponses = captureServerFnResponses(page);

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto('/interfaces');
  await expect(page.getByRole('heading', { name: 'Schnittstellen' })).toBeVisible();
  await expect
    .poll(() => serverFnResponses.find((response) => response.method === 'GET')?.status)
    .toBe(200);

  const loadResponse = serverFnResponses.find((response) => response.method === 'GET');
  expect(loadResponse?.url).toContain('/_server/');
  expect(loadResponse?.body).not.toContain('Only HTML requests are supported here');

  await page.getByLabel('GraphQL Basis-URL').fill('https://saved.example.org/graphql');
  await page.getByLabel('OAuth Token-URL').fill('https://saved.example.org/oauth/token');
  await expect(page.getByLabel('GraphQL Basis-URL')).toHaveValue('https://saved.example.org/graphql');
  await expect(page.getByLabel('OAuth Token-URL')).toHaveValue('https://saved.example.org/oauth/token');

  await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
  await expect(page.getByText('Die Sitzung ist nicht mehr gültig. Bitte erneut anmelden.').first()).toBeVisible();
  await expect
    .poll(() => serverFnResponses.filter((response) => response.method === 'POST').length)
    .toBeGreaterThan(0);

  const saveResponse = serverFnResponses.find((response) => response.method === 'POST');
  expect(saveResponse?.url).toContain('/_server/');
  expect(saveResponse?.body).not.toContain('Only HTML requests are supported here');
  await expect(page.getByText("Cannot read properties of null (reading 'value')")).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});
