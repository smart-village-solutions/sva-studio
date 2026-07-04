import { expect, type Page } from '@playwright/test';
import { resolveUserInitials } from '@sva/core';

const escapeForRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
    `${escapeForRegex(expectedUserName)}|${escapeForRegex(resolveUserInitials(expectedUserName))}`
  );

  await gotoShellRoot(page);
  await authMeResponse;
  await expect(page.getByRole('heading', { name: 'SVA Studio' })).toBeVisible();
  await expect(page.getByRole('button', { name: expectedTriggerPattern })).toBeVisible();
};

export const navigateClientSide = async (page: Page, targetPath: string) => {
  const routerAvailable = await page
    .waitForFunction(
      () =>
        Boolean(
          (window as typeof window & {
            __SVA_PLAYWRIGHT_ROUTER__?: { navigate: (options: { to: string }) => Promise<void> | void };
          }).__SVA_PLAYWRIGHT_ROUTER__,
        ),
      undefined,
      { timeout: 5_000 },
    )
    .then(() => true)
    .catch(() => false);

  if (!routerAvailable) {
    await page.goto(targetPath, { waitUntil: 'networkidle' });
    return;
  }

  await page.evaluate(async (path) => {
    const router = (
      window as typeof window & {
        __SVA_PLAYWRIGHT_ROUTER__?: { navigate: (options: { to: string }) => Promise<void> | void };
      }
    ).__SVA_PLAYWRIGHT_ROUTER__;
    if (!router) {
      throw new Error('Playwright router hook fehlt.');
    }
    await router.navigate({ to: path });
  }, targetPath);
};

export const createEmptyPaginatedDataResponse = (pageSize = 0) =>
  JSON.stringify({
    data: [],
    pagination: {
      page: 1,
      pageSize,
      total: 0,
    },
  });

export const registerSharedIamRoutes = async (page: Page, options: { pendingLegalTextsPageSize?: number } = {}) => {
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
      body: createEmptyPaginatedDataResponse(options.pendingLegalTextsPageSize),
    });
  });
  await page.route('**/api/v1/iam/me/context', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { activeOrganizationId: null, organizations: [] } }),
    });
  });
};
