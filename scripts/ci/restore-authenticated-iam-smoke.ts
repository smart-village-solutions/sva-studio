#!/usr/bin/env node
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

type BrowserModule = {
  readonly chromium: {
    launch(options: { headless: boolean }): Promise<{
      close(): Promise<void>;
      newContext(): Promise<{
        close(): Promise<void>;
        newPage(): Promise<{
          goto(
            url: string,
            options: { timeout: number; waitUntil: 'domcontentloaded' }
          ): Promise<unknown>;
          locator(selector: string): {
            fill(value: string): Promise<void>;
            isVisible(): Promise<boolean>;
          };
          getByRole(
            role: 'button',
            options: { name: RegExp }
          ): {
            click(): Promise<void>;
            isVisible(): Promise<boolean>;
          };
          waitForLoadState(state: 'networkidle'): Promise<void>;
          waitForURL(url: RegExp, options: { timeout: number }): Promise<void>;
        }>;
        request: {
          get(
            url: string,
            options: { failOnStatusCode: boolean }
          ): Promise<{
            json(): Promise<unknown>;
            status(): number;
          }>;
        };
      }>;
    }>;
  };
};

type LoginPage = {
  locator(selector: string): {
    fill(value: string): Promise<void>;
    isVisible(): Promise<boolean>;
  };
};

const appRequire = createRequire(
  new URL('../../apps/sva-studio-react/package.json', import.meta.url)
);
const { chromium } = appRequire('@playwright/test') as BrowserModule;

const required = (value: string | undefined, name: string): string => {
  const result = value?.trim();
  if (!result) throw new Error(`restore_iam_smoke_config_missing:${name}`);
  return result;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const getAuthenticatedInstanceId = (authMe: unknown): string => {
  if (!isRecord(authMe) || !isRecord(authMe.user))
    throw new Error('restore_iam_smoke_auth_payload_invalid');
  if (typeof authMe.user.instanceId !== 'string' || authMe.user.instanceId.trim().length === 0)
    throw new Error('restore_iam_smoke_auth_payload_invalid');
  return authMe.user.instanceId;
};

export const validateAuthenticatedIamPayloads = (authMe: unknown, permissions: unknown): void => {
  if (!isRecord(authMe) || !isRecord(authMe.user))
    throw new Error('restore_iam_smoke_auth_payload_invalid');
  if (authMe.user.permissionStatus !== 'ok')
    throw new Error('restore_iam_smoke_permissions_degraded');
  if (!Array.isArray(authMe.user.permissionActions))
    throw new Error('restore_iam_smoke_auth_payload_invalid');
  if (!isRecord(permissions) || !Array.isArray(permissions.permissions))
    throw new Error('restore_iam_smoke_permissions_payload_invalid');
};

const fillVisible = async (
  page: LoginPage,
  selectors: readonly string[],
  value: string
): Promise<boolean> => {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    if (await locator.isVisible().catch(() => false)) {
      await locator.fill(value);
      return true;
    }
  }
  return false;
};

const main = async (): Promise<void> => {
  const baseUrl = required(
    process.env.RESTORE_IAM_SMOKE_BASE_URL,
    'RESTORE_IAM_SMOKE_BASE_URL'
  ).replace(/\/+$/u, '');
  const username = required(process.env.RESTORE_IAM_SMOKE_USERNAME, 'RESTORE_IAM_SMOKE_USERNAME');
  const password = required(process.env.RESTORE_IAM_SMOKE_PASSWORD, 'RESTORE_IAM_SMOKE_PASSWORD');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(new URL('/auth/login', baseUrl).toString(), {
      timeout: 45_000,
      waitUntil: 'domcontentloaded',
    });
    const usernameReady = await fillVisible(
      page,
      ['input[name="username"]', '#username'],
      username
    );
    const passwordReady = await fillVisible(
      page,
      ['input[name="password"]', '#password'],
      password
    );
    if (!usernameReady || !passwordReady) throw new Error('restore_iam_smoke_login_form_missing');
    const loginButton = page.getByRole('button', { name: /anmelden|sign in|login/i });
    if (!(await loginButton.isVisible().catch(() => false)))
      throw new Error('restore_iam_smoke_login_button_missing');
    await loginButton.click();
    await page.waitForURL(new RegExp(`^${baseUrl.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}/`), {
      timeout: 45_000,
    });
    await page.waitForLoadState('networkidle');

    const authMeResponse = await context.request.get(new URL('/auth/me', baseUrl).toString(), {
      failOnStatusCode: false,
    });
    if (authMeResponse.status() !== 200) throw new Error('restore_iam_smoke_auth_http_failed');
    const authMe = await authMeResponse.json();
    const permissionsUrl = new URL('/iam/me/permissions', baseUrl);
    permissionsUrl.searchParams.set('instanceId', getAuthenticatedInstanceId(authMe));
    const permissionsResponse = await context.request.get(permissionsUrl.toString(), {
      failOnStatusCode: false,
    });
    if (permissionsResponse.status() !== 200)
      throw new Error('restore_iam_smoke_permissions_http_failed');
    validateAuthenticatedIamPayloads(authMe, await permissionsResponse.json());
    process.stdout.write('Authentifizierter IAM-Restore-Smoke erfolgreich.\n');
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'restore_iam_smoke_failed');
    process.exitCode = 1;
  });
}
