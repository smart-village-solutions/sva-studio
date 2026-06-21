import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test as setup } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
  DE_MUSTERHAUSEN_AUTH_SESSION_FILE,
  ROOT_AUTH_SESSION_FILE,
  getDeMusterhausenAuthSetupEnv,
  getRootAuthSetupEnv,
  hasDeMusterhausenAuthSetupCredentials,
  hasRootAuthSetupCredentials,
  loadPlaywrightEnv,
  resolveAuthSessionFile,
  unauthenticatedStorageState,
} from '../src/lib/playwright-auth-session-config';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
loadPlaywrightEnv(appRoot);

const waitForVisibleSelector = async (page: Page, selectors: readonly string[], timeout = 15_000) => {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    try {
      await locator.waitFor({ state: 'visible', timeout });
      return locator;
    } catch {
      continue;
    }
  }

  const snapshot = await page.evaluate(() => ({
    bodyText: (document.body?.innerText ?? '').slice(0, 1_200),
    buttons: Array.from(document.querySelectorAll('button,input[type="submit"]'))
      .map((element) =>
        (element.textContent || element.getAttribute('value') || element.getAttribute('aria-label') || '').trim()
      )
      .filter(Boolean)
      .slice(0, 20),
    links: Array.from(document.querySelectorAll('a'))
      .map((element) => ({
        href: element.getAttribute('href'),
        text: (element.textContent || '').trim(),
      }))
      .filter((entry) => entry.href || entry.text)
      .slice(0, 20),
    title: document.title,
    url: window.location.href,
  }));

  throw new Error(
    `Playwright auth setup could not find any visible field for selectors: ${selectors.join(', ')}\nSnapshot: ${JSON.stringify(snapshot)}`
  );
};

const fillRequiredField = async (page: Page, selectors: readonly string[], value: string) => {
  const locator = await waitForVisibleSelector(page, selectors);
  await locator.fill(value);
};

const loginFieldSelectors = {
  password: ['input[name="password"]', '#password', 'input[type="password"]'] as const,
  username: ['input[name="username"]', '#username', 'input[type="email"]'] as const,
};

const hasVisibleSelector = async (page: Page, selectors: readonly string[]) => {
  for (const selector of selectors) {
    if (await page.locator(selector).first().isVisible().catch(() => false)) {
      return true;
    }
  }

  return false;
};

const clickFirstVisible = async (
  page: Page,
  selectors: readonly ({ kind: 'css'; value: string } | { kind: 'role'; value: RegExp })[]
) => {
  for (const selector of selectors) {
    const locator =
      selector.kind === 'css'
        ? page.locator(selector.value).first()
        : page.getByRole('button', { name: selector.value }).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click();
      return;
    }
  }

  throw new Error('Playwright auth setup could not find a visible login submit control.');
};

const authenticateAndPersistBrowserState = async (
  page: Page,
  input: {
    readonly authFile: string;
    readonly baseUrl: string;
    readonly password: string;
    readonly username: string;
  }
) => {
  await mkdir(new URL('../playwright/.auth/', import.meta.url), { recursive: true });
  await page.goto(new URL('/auth/login', input.baseUrl).toString(), { waitUntil: 'domcontentloaded' });

  if (!(await hasVisibleSelector(page, loginFieldSelectors.username))) {
    const loginLink = page.getByRole('link', { name: /login|anmelden|erneut anmelden/i }).first();
    if (await loginLink.isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForURL(/(?:\/auth\/login|openid-connect\/auth)/, { timeout: 15_000 }),
        loginLink.click(),
      ]);
      await waitForVisibleSelector(page, loginFieldSelectors.username);
    }
  }

  await fillRequiredField(page, loginFieldSelectors.username, input.username);
  await fillRequiredField(page, loginFieldSelectors.password, input.password);
  const authResponsePromise = page.waitForResponse(
    (response) => response.request().method() === 'GET' && response.url().includes('/auth/me') && response.status() === 200,
    { timeout: 60_000 }
  );
  await clickFirstVisible(page, [
    { kind: 'css', value: '#kc-login' },
    { kind: 'role', value: /anmelden|sign in|log in|login/i },
  ]);

  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(new RegExp(`^${input.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:/|\\?|$)`));

  const authResponse = await authResponsePromise;
  expect(authResponse.ok()).toBe(true);

  await page.context().storageState({ path: input.authFile });
};

const persistUnauthenticatedStorageState = async (authFile: string) => {
  await writeFile(authFile, `${JSON.stringify(unauthenticatedStorageState, null, 2)}\n`, 'utf8');
};

setup('authenticate root and de-musterhausen sessions once and persist browser state', async ({ browser }) => {
  setup.setTimeout(120_000);
  await mkdir(new URL('../playwright/.auth/', import.meta.url), { recursive: true });

  const rootAuthFile = resolveAuthSessionFile(appRoot, ROOT_AUTH_SESSION_FILE);
  const tenantAuthFile = resolveAuthSessionFile(appRoot, DE_MUSTERHAUSEN_AUTH_SESSION_FILE);

  if (hasRootAuthSetupCredentials(process.env)) {
    const rootContext = await browser.newContext();
    const rootPage = await rootContext.newPage();

    try {
      await authenticateAndPersistBrowserState(rootPage, {
        ...getRootAuthSetupEnv(process.env),
        authFile: rootAuthFile,
      });
    } finally {
      await rootContext.close();
    }
  } else {
    await persistUnauthenticatedStorageState(rootAuthFile);
  }

  if (hasDeMusterhausenAuthSetupCredentials(process.env)) {
    const tenantContext = await browser.newContext();
    const tenantPage = await tenantContext.newPage();

    try {
      await authenticateAndPersistBrowserState(tenantPage, {
        ...getDeMusterhausenAuthSetupEnv(process.env),
        authFile: tenantAuthFile,
      });
    } finally {
      await tenantContext.close();
    }
  } else {
    await persistUnauthenticatedStorageState(tenantAuthFile);
  }
});
