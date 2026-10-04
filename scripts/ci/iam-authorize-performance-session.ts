export type Browser = {
  close: () => Promise<void>;
  newContext: () => Promise<BrowserContext>;
};

export type BrowserContext = {
  close: () => Promise<void>;
  newPage: () => Promise<Page>;
  request: {
    get: (url: string, options?: { failOnStatusCode?: boolean }) => Promise<ApiResponse>;
    post: (
      url: string,
      options: {
        data: unknown;
        failOnStatusCode?: boolean;
        headers?: Record<string, string>;
      }
    ) => Promise<ApiResponse>;
  };
};

type ApiResponse = {
  json: () => Promise<unknown>;
  status: () => number;
};

type Locator = {
  click: () => Promise<void>;
  count: () => Promise<number>;
  fill: (value: string) => Promise<void>;
  first: () => Locator;
  isVisible: () => Promise<boolean>;
};

type Page = {
  close: () => Promise<void>;
  getByRole: (role: string, options?: { exact?: boolean; name?: string | RegExp }) => Locator;
  goto: (
    url: string,
    options?: { waitUntil?: 'domcontentloaded' | 'load'; timeout?: number }
  ) => Promise<unknown>;
  locator: (selector: string) => Locator;
  waitForLoadState: (state?: 'domcontentloaded' | 'load' | 'networkidle') => Promise<void>;
  waitForURL: (url: string | RegExp, options?: { timeout?: number }) => Promise<void>;
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
const LOGIN_TIMEOUT_MS = 45_000;

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
    throw new Error('Die Keycloak-Loginmaske konnte nicht automatisiert bedient werden.');
  }

  const clicked =
    (await clickIfVisible(page.locator('#kc-login'))) ||
    (await clickIfVisible(page.getByRole('button', { name: /anmelden|sign in|login/i })));

  if (!clicked) {
    throw new Error('Der Keycloak-Login-Button wurde nicht gefunden.');
  }
};

export const loginAndReadSession = async (input: {
  readonly baseUrl: string;
  readonly browser: Browser;
  readonly password: string;
  readonly username: string;
}): Promise<{
  readonly context: BrowserContext;
  readonly user: NonNullable<AuthMePayload['user']>;
}> => {
  const context = await input.browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(new URL('/auth/login', input.baseUrl).toString(), {
      timeout: LOGIN_TIMEOUT_MS,
      waitUntil: 'domcontentloaded',
    });
    await performKeycloakLogin(page, { username: input.username, password: input.password });
    await page.waitForURL(
      new RegExp(`${input.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/.*`),
      {
        timeout: LOGIN_TIMEOUT_MS,
      }
    );
    await page.waitForLoadState('networkidle');

    const meResponse = await context.request.get(new URL('/auth/me', input.baseUrl).toString(), {
      failOnStatusCode: false,
    });
    if (meResponse.status() !== 200) {
      throw new Error(`/auth/me antwortete mit HTTP ${meResponse.status()}.`);
    }

    const mePayload = (await meResponse.json()) as AuthMePayload;
    const user = mePayload.user;
    if (!user?.id || !user.instanceId || !Array.isArray(user.roles)) {
      throw new Error('Der User-Kontext aus /auth/me ist unvollständig.');
    }

    await page.close().catch(() => undefined);
    return {
      context,
      user: user as NonNullable<AuthMePayload['user']>,
    };
  } catch (error) {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    throw error;
  }
};
