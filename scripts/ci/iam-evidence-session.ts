import type { AcceptanceFailureCode } from './iam-acceptance.ts';

export type Browser = {
  close: () => Promise<void>;
  newContext: () => Promise<BrowserContext>;
};

export type BrowserContext = {
  close: () => Promise<void>;
  newPage: () => Promise<Page>;
  request: {
    get: (
      url: string,
      options?: { failOnStatusCode?: boolean; headers?: Record<string, string> }
    ) => Promise<ApiResponse>;
  };
};

export type ApiResponse = {
  headers: () => Record<string, string>;
  status: () => number;
  text: () => Promise<string>;
};

type Locator = {
  click: () => Promise<void>;
  count: () => Promise<number>;
  fill: (value: string) => Promise<void>;
  first: () => Locator;
  isVisible: () => Promise<boolean>;
};

export type Page = {
  close: () => Promise<void>;
  getByRole: (role: string, options?: { exact?: boolean; name?: string | RegExp }) => Locator;
  getByText: (text: string | RegExp) => Locator;
  goto: (
    url: string,
    options?: { waitUntil?: 'domcontentloaded' | 'load'; timeout?: number }
  ) => Promise<unknown>;
  locator: (selector: string) => Locator;
  screenshot: (options: { fullPage?: boolean; path: string }) => Promise<void>;
  waitForLoadState: (state?: 'domcontentloaded' | 'load' | 'networkidle') => Promise<void>;
  waitForURL: (url: string | RegExp, options?: { timeout?: number }) => Promise<void>;
};

export type Pool = {
  end: () => Promise<void>;
  query: <T>(
    text: string,
    values?: readonly unknown[]
  ) => Promise<{ rowCount: number | null; rows: T[] }>;
};

type AuthMePayload = {
  user?: {
    email?: string;
    id?: string;
    instanceId?: string;
    name?: string;
    roles?: string[];
  };
};
export const READINESS_TIMEOUT_MS = 45_000;

const failRun = (message: string, failureCode: AcceptanceFailureCode): never => {
  throw new Error(`${failureCode}: ${message}`);
};

const countVisible = async (locator: Locator): Promise<number> => {
  const count = await locator.count().catch(() => 0);
  if (count === 0) {
    return 0;
  }
  const first = locator.first();
  return (await first.isVisible().catch(() => false)) ? count : 0;
};

export const hasVisibleText = async (page: Page, text: string | RegExp): Promise<boolean> =>
  (await countVisible(page.getByText(text))) > 0;

const fillIfVisible = async (locator: Locator, value: string): Promise<boolean> => {
  const count = await locator.count().catch(() => 0);
  if (count === 0) {
    return false;
  }

  const first = locator.first();
  if (!(await first.isVisible().catch(() => false))) {
    return false;
  }

  await first.fill(value);
  return true;
};

const clickIfVisible = async (locator: Locator): Promise<boolean> => {
  const count = await locator.count().catch(() => 0);
  if (count === 0) {
    return false;
  }

  const first = locator.first();
  if (!(await first.isVisible().catch(() => false))) {
    return false;
  }

  await first.click();
  return true;
};

const performKeycloakLogin = async (
  page: Page,
  input: { password: string; username: string }
): Promise<void> => {
  const usernameFilled =
    (await fillIfVisible(page.locator('input[name="username"]'), input.username)) ||
    (await fillIfVisible(page.locator('#username'), input.username));
  const passwordFilled =
    (await fillIfVisible(page.locator('input[name="password"]'), input.password)) ||
    (await fillIfVisible(page.locator('#password'), input.password));

  if (!usernameFilled || !passwordFilled) {
    failRun(
      'Die Keycloak-Loginmaske konnte nicht automatisiert bedient werden.',
      'acceptance_login_failed'
    );
  }

  const clicked =
    (await clickIfVisible(page.locator('#kc-login'))) ||
    (await clickIfVisible(page.getByRole('button', { name: /anmelden|sign in|login/i })));
  if (!clicked) {
    failRun('Der Keycloak-Login-Button wurde nicht gefunden.', 'acceptance_login_failed');
  }
};

export const loginAndReadSession = async (input: {
  baseUrl: string;
  browser: Browser;
  name: string;
  password: string;
  username: string;
}): Promise<{
  context: BrowserContext;
  page: Page;
  user: NonNullable<AuthMePayload['user']>;
}> => {
  const context = await input.browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(new URL('/auth/login', input.baseUrl).toString(), {
      timeout: READINESS_TIMEOUT_MS,
      waitUntil: 'domcontentloaded',
    });
    await performKeycloakLogin(page, { username: input.username, password: input.password });
    await page.waitForURL(
      new RegExp(`${input.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/.*`),
      {
        timeout: READINESS_TIMEOUT_MS,
      }
    );
    await page.waitForLoadState('networkidle');

    const meResponse = await context.request.get(new URL('/auth/me', input.baseUrl).toString(), {
      failOnStatusCode: false,
    });
    if (meResponse.status() !== 200) {
      failRun(
        `/auth/me antwortete mit HTTP ${meResponse.status()}.`,
        'acceptance_http_request_failed'
      );
    }

    const mePayload = JSON.parse(await meResponse.text()) as AuthMePayload;
    const user = mePayload.user;
    if (!user?.id || !user.instanceId || !Array.isArray(user.roles)) {
      failRun(
        'Der User-Kontext aus /auth/me ist unvollständig.',
        'acceptance_expected_claim_missing'
      );
    }

    return {
      context,
      page,
      user: user as NonNullable<AuthMePayload['user']>,
    };
  } catch (error) {
    await context.close().catch(() => undefined);
    failRun(error instanceof Error ? error.message : String(error), 'acceptance_login_failed');
  }

  throw new Error('unreachable');
};

export const openUserPermissionsTab = async (page: Page): Promise<void> => {
  const permissionsTab = page.getByRole('tab', { name: /Berechtigungen/i });
  const tabVisible = (await countVisible(permissionsTab)) > 0;
  if (!tabVisible) {
    return;
  }

  await permissionsTab.first().click();
  await page.waitForLoadState('networkidle').catch(() => undefined);
};
