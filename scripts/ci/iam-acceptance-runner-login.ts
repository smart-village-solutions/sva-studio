import type { IdentityListedUser } from '../../packages/auth-runtime/src/identity-provider-port.ts';
import type { KeycloakAdminClient } from '../../packages/auth-runtime/src/keycloak-admin-client/core.ts';
import type { AcceptanceConfig } from './iam-acceptance.ts';
import { assertSingleProvisionedAccount } from './iam-acceptance-runner-database.ts';
import type {
  AcceptanceRecorder,
  Browser,
  BrowserContext,
  Locator,
  Page,
  Pool,
} from './iam-acceptance-runner-runtime.ts';
import { fetchJson } from './iam-acceptance-runner-runtime.ts';

type AuthMePayload = {
  user?: {
    email?: string;
    id?: string;
    instanceId?: string;
    name?: string;
    roles?: string[];
  };
};

export type AcceptanceSession = {
  context: BrowserContext;
  user: NonNullable<AuthMePayload['user']>;
};

const resolveKeycloakUser = async (
  recorder: AcceptanceRecorder,
  client: KeycloakAdminClient,
  username: string,
  name: string
): Promise<IdentityListedUser> => {
  const matches = (await client.listUsers({ username })).filter(
    (entry) => entry.username === username
  );
  if (matches.length === 0) {
    recorder.failStep({
      name: `Preflight ${name}`,
      failureCode: 'acceptance_keycloak_user_missing',
      details: `Keycloak-Testnutzer "${username}" wurde nicht gefunden.`,
    });
  }
  if (matches.length > 1) {
    recorder.failStep({
      name: `Preflight ${name}`,
      failureCode: 'acceptance_keycloak_user_not_unique',
      details: `Keycloak-Testnutzer "${username}" ist nicht eindeutig.`,
      metadata: { matches: matches.map((entry) => entry.externalId) },
    });
  }
  return matches[0] as IdentityListedUser;
};

export const runIdentityPreflight = async (
  recorder: AcceptanceRecorder,
  keycloakAdmin: KeycloakAdminClient,
  config: AcceptanceConfig
): Promise<{ adminIdentity: IdentityListedUser; memberIdentity: IdentityListedUser }> => {
  const adminIdentity = await resolveKeycloakUser(
    recorder,
    keycloakAdmin,
    config.admin.username,
    'Admin-Testnutzer'
  );
  const memberIdentity = await resolveKeycloakUser(
    recorder,
    keycloakAdmin,
    config.member.username,
    'Member-Testnutzer'
  );
  const adminRoleNames = await keycloakAdmin.listUserRoleNames(adminIdentity.externalId);
  for (const expectedRole of config.admin.expectedRoles) {
    if (!adminRoleNames.includes(expectedRole) && expectedRole !== 'system_admin') {
      recorder.failStep({
        name: 'Preflight Admin-Testnutzer',
        failureCode: 'acceptance_expected_role_missing',
        details: `Der Keycloak-Testnutzer "${config.admin.username}" besitzt die Rolle "${expectedRole}" nicht.`,
        metadata: { roles: adminRoleNames },
      });
    }
  }
  recorder.recordStep({
    name: 'Preflight Testnutzer',
    status: 'passed',
    details: 'Keycloak-Testnutzer und Rollenvertrag wurden geprüft.',
    metadata: { adminSubject: adminIdentity.externalId, memberSubject: memberIdentity.externalId },
  });
  return { adminIdentity, memberIdentity };
};

const fillIfVisible = async (locator: Locator, value: string): Promise<boolean> => {
  const count = await locator.count().catch(() => 0);
  if (count === 0) return false;
  const first = locator.first();
  if (!(await first.isVisible().catch(() => false))) return false;
  await first.fill(value);
  return true;
};

const clickIfVisible = async (locator: Locator): Promise<boolean> => {
  const count = await locator.count().catch(() => 0);
  if (count === 0) return false;
  const first = locator.first();
  if (!(await first.isVisible().catch(() => false))) return false;
  await first.click();
  return true;
};

const performKeycloakLogin = async (
  recorder: AcceptanceRecorder,
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
    recorder.failStep({
      name: 'OIDC Login',
      failureCode: 'acceptance_login_failed',
      details: 'Die Keycloak-Loginmaske konnte nicht automatisiert bedient werden.',
    });
  }
  const clicked =
    (await clickIfVisible(page.locator('#kc-login'))) ||
    (await clickIfVisible(page.getByRole('button', { name: /anmelden|sign in|login/i })));
  if (!clicked) {
    recorder.failStep({
      name: 'OIDC Login',
      failureCode: 'acceptance_login_failed',
      details: 'Der Keycloak-Login-Button wurde nicht gefunden.',
    });
  }
};

const loginAndReadSession = async (
  recorder: AcceptanceRecorder,
  input: { baseUrl: string; browser: Browser; name: string; password: string; username: string }
): Promise<AcceptanceSession> => {
  const context = await input.browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(new URL('/auth/login', input.baseUrl).toString(), {
      timeout: 45_000,
      waitUntil: 'domcontentloaded',
    });
    await performKeycloakLogin(recorder, page, input);
    await page.waitForURL(
      new RegExp(`${input.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/.*`),
      {
        timeout: 45_000,
      }
    );
    await page.waitForLoadState('networkidle');
    const meResponse = await context.request.get(new URL('/auth/me', input.baseUrl).toString(), {
      failOnStatusCode: false,
    });
    if (meResponse.status() !== 200) {
      recorder.failStep({
        name: `${input.name} /auth/me`,
        failureCode: 'acceptance_http_request_failed',
        details: `/auth/me antwortete mit HTTP ${meResponse.status()}.`,
      });
    }
    const mePayload = await fetchJson<AuthMePayload>(meResponse);
    const user = mePayload.user;
    if (!user?.id || !user.instanceId || !Array.isArray(user.roles)) {
      recorder.failStep({
        name: `${input.name} Claims`,
        failureCode: 'acceptance_expected_claim_missing',
        details: 'Der User-Kontext aus /auth/me ist unvollständig.',
        metadata: { payload: mePayload },
      });
    }
    return { context, user: user as NonNullable<AuthMePayload['user']> };
  } catch (error) {
    await context.close().catch(() => undefined);
    recorder.failStep({
      name: `${input.name} Login`,
      failureCode: 'acceptance_login_failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

const expectAdminClaims = (
  recorder: AcceptanceRecorder,
  input: {
    expectedInstanceId: string;
    expectedRoles: readonly string[];
    user: AcceptanceSession['user'];
  }
): void => {
  if (
    !input.user.id ||
    !input.user.instanceId ||
    input.user.instanceId !== input.expectedInstanceId
  ) {
    recorder.failStep({
      name: 'OIDC Login Claims',
      failureCode: 'acceptance_expected_claim_missing',
      details:
        !input.user.id || !input.user.instanceId
          ? 'Der User-Kontext enthält nicht die Claims `sub` und `instanceId`.'
          : `Erwartete instanceId "${input.expectedInstanceId}", erhalten "${input.user.instanceId}".`,
      metadata: { user: input.user },
    });
  }
  for (const expectedRole of input.expectedRoles) {
    if (!input.user.roles?.includes(expectedRole)) {
      recorder.failStep({
        name: 'OIDC Login Claims',
        failureCode: 'acceptance_expected_role_missing',
        details: `Die erwartete Rolle "${expectedRole}" fehlt im User-Kontext.`,
        metadata: { roles: input.user.roles },
      });
    }
  }
};

export const runLoginAndJitChecks = async (
  recorder: AcceptanceRecorder,
  input: { browser: Browser; config: AcceptanceConfig; pool: Pool }
): Promise<{
  adminSession: AcceptanceSession;
  memberAccountId: string;
  memberUser: AcceptanceSession['user'];
}> => {
  const adminFirstLogin = await loginAndReadSession(recorder, {
    baseUrl: input.config.baseUrl,
    browser: input.browser,
    name: 'Admin Erstlogin',
    password: input.config.admin.password,
    username: input.config.admin.username,
  });
  expectAdminClaims(recorder, {
    expectedInstanceId: input.config.instanceId,
    expectedRoles: input.config.admin.expectedRoles,
    user: adminFirstLogin.user,
  });
  const firstAdminAccount = await assertSingleProvisionedAccount(recorder, {
    instanceId: input.config.instanceId,
    keycloakSubject: adminFirstLogin.user.id as string,
    name: 'Admin Erstlogin',
    pool: input.pool,
  });
  recorder.recordStep({
    name: 'OIDC Login Claims',
    status: 'passed',
    details: 'Admin-Login liefert `sub`, `instanceId` und die erwarteten Rollen.',
    metadata: {
      instanceId: adminFirstLogin.user.instanceId,
      roles: adminFirstLogin.user.roles,
      sub: adminFirstLogin.user.id,
    },
  });
  recorder.recordStep({
    name: 'Admin JIT-Provisioning Erstlogin',
    status: 'passed',
    details: 'Der erste Admin-Login erzeugt den IAM-Account-Kontext deterministisch.',
    metadata: { accountId: firstAdminAccount.accountId, keycloakSubject: adminFirstLogin.user.id },
  });
  await adminFirstLogin.context.close();

  const memberFirstLogin = await loginAndReadSession(recorder, {
    baseUrl: input.config.baseUrl,
    browser: input.browser,
    name: 'Member Erstlogin',
    password: input.config.member.password,
    username: input.config.member.username,
  });
  const memberAccount = await assertSingleProvisionedAccount(recorder, {
    instanceId: input.config.instanceId,
    keycloakSubject: memberFirstLogin.user.id as string,
    name: 'Member Erstlogin',
    pool: input.pool,
  });
  recorder.recordStep({
    name: 'Member JIT-Provisioning Erstlogin',
    status: 'passed',
    details: 'Der Member-Login erzeugt den benötigten Membership-Zielaccount.',
    metadata: { accountId: memberAccount.accountId, keycloakSubject: memberFirstLogin.user.id },
  });
  await memberFirstLogin.context.close();

  const adminSecondLogin = await loginAndReadSession(recorder, {
    baseUrl: input.config.baseUrl,
    browser: input.browser,
    name: 'Admin Zweitlogin',
    password: input.config.admin.password,
    username: input.config.admin.username,
  });
  const secondAdminAccount = await assertSingleProvisionedAccount(recorder, {
    instanceId: input.config.instanceId,
    keycloakSubject: adminSecondLogin.user.id as string,
    name: 'Admin Zweitlogin',
    pool: input.pool,
  });
  if (firstAdminAccount.accountId !== secondAdminAccount.accountId) {
    recorder.failStep({
      name: 'Admin JIT-Provisioning Zweitlogin',
      failureCode: 'acceptance_database_query_failed',
      details: 'Der zweite Login hat keinen stabilen Account-Kontext wiederverwendet.',
      metadata: {
        firstAccountId: firstAdminAccount.accountId,
        secondAccountId: secondAdminAccount.accountId,
      },
    });
  }
  recorder.recordStep({
    name: 'Admin JIT-Provisioning Zweitlogin',
    status: 'passed',
    details: 'Der zweite Admin-Login verwendet den bestehenden Account ohne Duplikatbildung.',
    metadata: { accountId: secondAdminAccount.accountId },
  });
  return {
    adminSession: adminSecondLogin,
    memberAccountId: memberAccount.accountId,
    memberUser: memberFirstLogin.user,
  };
};
