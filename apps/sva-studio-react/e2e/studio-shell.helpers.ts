import { expect, type Page } from '@playwright/test';

const escapeForRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const resolveInitials = (value: string) =>
  value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

export const gotoShellRoot = async (page: Page, attempts = 5) => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await page.goto('/');
      return;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('ERR_CONNECTION_REFUSED') || attempt === attempts) {
        throw error;
      }
      await page.waitForTimeout(1_000);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

export const gotoHomeAsAuthenticatedUser = async (page: Page, expectedUserName = 'Editor One') => {
  const authMeResponse = page.waitForResponse(
    (response) => response.request().method() === 'GET' && response.url().includes('/auth/me') && response.status() === 200
  );
  const expectedTriggerPattern = new RegExp(
    `${escapeForRegex(expectedUserName)}|${escapeForRegex(resolveInitials(expectedUserName))}`
  );

  await gotoShellRoot(page);
  await authMeResponse;
  await expect(page.getByRole('heading', { name: 'SVA Studio' })).toBeVisible();
  await expect(page.getByRole('button', { name: expectedTriggerPattern })).toBeVisible();
};

export const createEmptyPaginatedDataResponse = () =>
  JSON.stringify({
    data: [],
    pagination: {
      page: 1,
      pageSize: 0,
      total: 0,
    },
  });
