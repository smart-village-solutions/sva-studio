import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
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
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes('/auth/me') &&
      response.status() === 200
  );
  const expectedTriggerPattern = new RegExp(
    `${escapeForRegex(expectedUserName)}|${escapeForRegex(resolveUserInitials(expectedUserName))}`
  );

  await gotoShellRoot(page);
  await authMeResponse;
  await expect(page.getByRole('heading', { name: 'SVA Studio' })).toBeVisible();
  await expect(page.getByRole('button', { name: expectedTriggerPattern })).toBeVisible();
};

export const establishServerReadableAuthSession = async (context: BrowserContext, page: Page) => {
  const origin = new URL(page.url()).origin;
  const response = await context.request.post(
    new URL('/auth/dev-login?returnTo=%2F', origin).toString(),
    {
      headers: {
        Origin: origin,
        'X-Requested-With': 'XMLHttpRequest',
      },
      maxRedirects: 0,
    }
  );

  // Credential-free suites use the server's Playwright-only dev-auth mode.
  // With real auth credentials the endpoint stays disabled and the persisted
  // Keycloak session already belongs to this browser context.
  expect([302, 404]).toContain(response.status());
};

export const expectAppShellReady = async (page: Page, timeout = 20_000) => {
  const mainContent = page.locator('main#main-content');
  await expect(mainContent).toBeVisible({ timeout });
  await expect(mainContent).toHaveAttribute('aria-busy', 'false', { timeout });
};

export const navigateClientSide = async (page: Page, targetPath: string) => {
  const routerAvailable = await page
    .waitForFunction(
      () =>
        Boolean(
          (
            window as typeof window & {
              __SVA_PLAYWRIGHT_ROUTER__?: {
                navigate: (options: { to: string }) => Promise<void> | void;
              };
            }
          ).__SVA_PLAYWRIGHT_ROUTER__
        ),
      undefined,
      { timeout: 5_000 }
    )
    .then(() => true)
    .catch(() => false);

  if (!routerAvailable) {
    await page.goto(targetPath, { waitUntil: 'domcontentloaded' });
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

export const registerSharedIamRoutes = async (
  page: Page | BrowserContext,
  options: { pendingLegalTextsPageSize?: number } = {}
) => {
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
      body: JSON.stringify({
        data: {
          activeOrganizationId: null,
          organizations: [],
          personalMainserverReadiness: 'ready',
        },
      }),
    });
  });
  await page.route('**/api/v1/iam/contents/*', async (route) => {
    const contentId = new URL(route.request().url()).pathname.split('/').at(-1);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: contentId,
          credentialSource: 'user',
          sourceDataProviderName: 'Editor One',
        },
      }),
    });
  });
};

/** Capture existing flows in a fixed locale/theme/viewport matrix. */
export const captureStudioDesignState = async (page: Page, name: string, scope = 'main') => {
  for (const mode of ['light', 'dark'] as const) {
    if ((await page.locator('html').getAttribute('data-theme-mode')) !== mode) {
      const label = mode === 'dark' ? 'Dunklen Modus aktivieren' : 'Hellen Modus aktivieren';
      const openLayer = await page
        .locator('[role=dialog], [role=combobox][aria-expanded=true]')
        .count();
      if (!openLayer && (await page.getByRole('button', { name: label }).count())) {
        await page.getByRole('button', { name: label }).click();
      } else {
        // Invoke the real handler for visual state setup when a modal or search must stay open,
        // keeping the user's open form, focus and dialog state intact.
        await page.getByRole('button', { name: label, includeHidden: true }).evaluate((element) => {
          if (element instanceof HTMLButtonElement) element.click();
        });
      }
    }
    for (const width of [320, 390, 768, 1024, 1280, 1728]) {
      await page.setViewportSize({ width, height: 900 });
      const openSearch = page.locator('[role=combobox][aria-expanded=true]');
      const hasOpenSearch = (await openSearch.count()) > 0;
      if (hasOpenSearch) {
        await page.locator('[aria-haspopup=listbox][aria-expanded=true]').scrollIntoViewIfNeeded();
        await expect(openSearch.first()).toBeInViewport();
        await openSearch.first().click({ trial: true });
      } else {
        await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
      }
      await expect(page.locator('html')).toHaveAttribute('data-theme-mode', mode);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width);
      expect(await page.locator('form form, button button, a button, button a').count()).toBe(0);
      if (width === 1280) {
        const result = await new AxeBuilder({ page }).include(scope).analyze();
        expect(
          result.violations.filter((entry) => ['serious', 'critical'].includes(entry.impact ?? ''))
        ).toEqual([]);
      }
      await page.screenshot({
        path: test.info().outputPath(`${name}-${mode}-${width}.png`),
        fullPage: !hasOpenSearch,
      });
    }
  }
  await page
    .getByRole('button', { name: 'Hellen Modus aktivieren', includeHidden: true })
    .evaluate((element) => {
      if (element instanceof HTMLButtonElement) element.click();
    });
  await page.setViewportSize({ width: 1280, height: 900 });
};
