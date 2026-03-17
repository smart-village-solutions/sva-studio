import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import type { IdentityListedUser } from '../../packages/auth/src/identity-provider-port.ts';
import {
  KeycloakAdminClient,
  type KeycloakAdminClientConfig,
} from '../../packages/auth/src/keycloak-admin-client/core.ts';
import {
  buildAcceptanceReport,
  createAcceptanceReportFileBase,
  parseAcceptanceConfig,
  type AcceptanceFailureCode,
  type AcceptanceStepRecord,
  writeAcceptanceReports,
} from './iam-acceptance.ts';

type BrowserModule = {
  chromium: {
    launch: (options?: { headless?: boolean }) => Promise<Browser>;
  };
};

type Browser = {
  close: () => Promise<void>;
  newContext: () => Promise<BrowserContext>;
};

type BrowserContext = {
  close: () => Promise<void>;
  newPage: () => Promise<Page>;
  request: {
    delete: (
      url: string,
      options?: { failOnStatusCode?: boolean; headers?: Record<string, string> }
    ) => Promise<ApiResponse>;
    get: (url: string, options?: { failOnStatusCode?: boolean; headers?: Record<string, string> }) => Promise<ApiResponse>;
    patch: (
      url: string,
      options: {
        data: unknown;
        failOnStatusCode?: boolean;
        headers?: Record<string, string>;
      }
    ) => Promise<ApiResponse>;
    post: (
      url: string,
      options: {
        data?: unknown;
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
  context: () => BrowserContext;
  getByLabel: (text: string) => Locator;
  getByRole: (role: string, options?: { exact?: boolean; name?: string | RegExp }) => Locator;
  getByText: (text: string | RegExp) => Locator;
  goto: (url: string, options?: { waitUntil?: 'domcontentloaded' | 'load'; timeout?: number }) => Promise<unknown>;
  locator: (selector: string) => Locator;
  waitForLoadState: (state?: 'domcontentloaded' | 'load' | 'networkidle') => Promise<void>;
  waitForURL: (url: string | RegExp, options?: { timeout?: number }) => Promise<void>;
};

type PgModule = {
  Pool: new (options: { connectionString: string }) => Pool;
};

type Pool = {
  connect: () => Promise<PoolClient>;
  end: () => Promise<void>;
  query: <T>(text: string, values?: readonly unknown[]) => Promise<{ rowCount: number | null; rows: T[] }>;
};

type PoolClient = {
  query: <T>(text: string, values?: readonly unknown[]) => Promise<{ rowCount: number | null; rows: T[] }>;
  release: () => void;
};

type HealthReadyPayload = {
  checks?: {
    db?: boolean;
    keycloak?: boolean;
    redis?: boolean;
  };
  path?: string;
  requestId?: string;
  status?: string;
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

type AccountRow = {
  id: string;
  keycloak_subject: string;
};

type OrganizationRow = {
  depth: number;
  display_name: string;
  hierarchy_path: string[];
  id: string;
  is_active: boolean;
  organization_key: string;
  parent_organization_id: string | null;
};

type MembershipRow = {
  account_id: string;
  is_default_context: boolean;
  membership_visibility: string;
  organization_id: string;
};

const rootDir = resolve(import.meta.dirname, '../..');
const appRequire = createRequire(resolve(rootDir, 'apps/sva-studio-react/package.json'));
const authRequire = createRequire(resolve(rootDir, 'packages/auth/package.json'));

const { chromium } = appRequire('@playwright/test') as BrowserModule;
const { Pool } = authRequire('pg') as PgModule;

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
} as const;

const buildMutationHeaders = (baseUrl: string, idempotencyKey?: string): Record<string, string> => {
  const origin = new URL(baseUrl).origin;
  return {
    ...JSON_HEADERS,
    Origin: origin,
    Referer: `${origin}/`,
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
  };
};

const stepRecords: AcceptanceStepRecord[] = [];

const recordStep = (step: AcceptanceStepRecord): AcceptanceStepRecord => {
  stepRecords.push(step);
  const statusLabel = step.status.toUpperCase();
  const detailSuffix = step.details ? `: ${step.details}` : '';
  console.log(`[iam-acceptance] ${statusLabel} ${step.name}${detailSuffix}`);
  return step;
};

const failStep = (input: {
  details: string;
  failureCode: AcceptanceFailureCode;
  metadata?: Readonly<Record<string, unknown>>;
  name: string;
}): never => {
  recordStep({
    name: input.name,
    status: 'failed',
    details: input.details,
    failureCode: input.failureCode,
    metadata: input.metadata,
  });
  throw new Error(`${input.failureCode}: ${input.details}`);
};

const fetchJson = async <T>(response: ApiResponse): Promise<T> => response.json() as Promise<T>;

const resolveKeycloakUser = async (
  client: KeycloakAdminClient,
  username: string,
  name: string
): Promise<IdentityListedUser> => {
  const matches = (await client.listUsers({ username })).filter((entry) => entry.username === username);
  if (matches.length === 0) {
    failStep({
      name: `Preflight ${name}`,
      failureCode: 'acceptance_keycloak_user_missing',
      details: `Keycloak-Testnutzer "${username}" wurde nicht gefunden.`,
    });
  }
  if (matches.length > 1) {
    failStep({
      name: `Preflight ${name}`,
      failureCode: 'acceptance_keycloak_user_not_unique',
      details: `Keycloak-Testnutzer "${username}" ist nicht eindeutig.`,
      metadata: { matches: matches.map((entry) => entry.externalId) },
    });
  }
  return matches[0] as IdentityListedUser;
};

const expectVisible = async (
  locator: Locator,
  input: { details: string; failureCode: AcceptanceFailureCode; name: string }
) => {
  const visible = await locator.isVisible().catch(() => false);
  if (!visible) {
    failStep(input);
  }
};

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

const performKeycloakLogin = async (page: Page, input: { password: string; username: string }): Promise<void> => {
  const usernameFilled =
    (await fillIfVisible(page.locator('input[name="username"]'), input.username)) ||
    (await fillIfVisible(page.locator('#username'), input.username));
  const passwordFilled =
    (await fillIfVisible(page.locator('input[name="password"]'), input.password)) ||
    (await fillIfVisible(page.locator('#password'), input.password));

  if (!usernameFilled || !passwordFilled) {
    failStep({
      name: 'OIDC Login',
      failureCode: 'acceptance_login_failed',
      details: 'Die Keycloak-Loginmaske konnte nicht automatisiert bedient werden.',
    });
  }

  const clicked =
    (await clickIfVisible(page.locator('#kc-login'))) ||
    (await clickIfVisible(page.getByRole('button', { name: /anmelden|sign in|login/i })));
  if (!clicked) {
    failStep({
      name: 'OIDC Login',
      failureCode: 'acceptance_login_failed',
      details: 'Der Keycloak-Login-Button wurde nicht gefunden.',
    });
  }
};

const loginAndReadSession = async (input: {
  baseUrl: string;
  browser: Browser;
  name: string;
  password: string;
  username: string;
}): Promise<{
  context: BrowserContext;
  user: NonNullable<AuthMePayload['user']>;
}> => {
  const context = await input.browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(new URL('/auth/login', input.baseUrl).toString(), {
      timeout: 45_000,
      waitUntil: 'domcontentloaded',
    });
    await performKeycloakLogin(page, { username: input.username, password: input.password });
    await page.waitForURL(new RegExp(`${input.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/.*`), {
      timeout: 45_000,
    });
    await page.waitForLoadState('networkidle');

    const meResponse = await context.request.get(new URL('/auth/me', input.baseUrl).toString(), {
      failOnStatusCode: false,
    });
    if (meResponse.status() !== 200) {
      failStep({
        name: `${input.name} /auth/me`,
        failureCode: 'acceptance_http_request_failed',
        details: `/auth/me antwortete mit HTTP ${meResponse.status()}.`,
      });
    }

    const mePayload = await fetchJson<AuthMePayload>(meResponse);
    const user = mePayload.user;
    if (!user?.id || !user.instanceId || !Array.isArray(user.roles)) {
      failStep({
        name: `${input.name} Claims`,
        failureCode: 'acceptance_expected_claim_missing',
        details: 'Der User-Kontext aus /auth/me ist unvollständig.',
        metadata: { payload: mePayload },
      });
    }

    return {
      context,
      user: user as NonNullable<AuthMePayload['user']>,
    };
  } catch (error) {
    await context.close().catch(() => undefined);
    failStep({
      name: `${input.name} Login`,
      failureCode: 'acceptance_login_failed',
      details: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

const queryAccount = async (pool: Pool, input: {
  instanceId: string;
  keycloakSubject: string;
}): Promise<AccountRow[]> => {
  const result = await pool.query<AccountRow>(
    `
SELECT id, keycloak_subject
FROM iam.accounts
WHERE instance_id = $1
  AND keycloak_subject = $2
ORDER BY created_at ASC;
`,
    [input.instanceId, input.keycloakSubject]
  );
  return result.rows;
};

const assertSingleProvisionedAccount = async (input: {
  instanceId: string;
  keycloakSubject: string;
  name: string;
  pool: Pool;
}): Promise<{ accountId: string }> => {
  const rows = await queryAccount(input.pool, {
    instanceId: input.instanceId,
    keycloakSubject: input.keycloakSubject,
  });
  if (rows.length !== 1) {
    failStep({
      name: `${input.name} JIT-Provisioning`,
      failureCode: 'acceptance_database_query_failed',
      details: `Erwartet genau einen Account-Datensatz für ${input.keycloakSubject}, gefunden: ${rows.length}.`,
      metadata: { rows },
    });
  }

  const accountId = rows[0]?.id;
  const membershipResult = await input.pool.query<{ account_id: string }>(
    `
SELECT account_id
FROM iam.instance_memberships
WHERE instance_id = $1
  AND account_id = $2::uuid;
`,
    [input.instanceId, accountId]
  );
  if (membershipResult.rowCount !== 1) {
    failStep({
      name: `${input.name} JIT-Provisioning`,
      failureCode: 'acceptance_membership_missing',
      details: `Die Instanz-Mitgliedschaft für ${input.keycloakSubject} fehlt.`,
      metadata: { accountId },
    });
  }

  return { accountId: accountId as string };
};

const cleanupAcceptanceOrganizations = async (pool: Pool, input: {
  instanceId: string;
  organizationKeyPrefix: string;
}): Promise<void> => {
  const organizations = await pool.query<{ id: string }>(
    `
SELECT id
FROM iam.organizations
WHERE instance_id = $1
  AND organization_key LIKE $2
ORDER BY depth DESC;
`,
    [input.instanceId, `${input.organizationKeyPrefix}-%`]
  );

  const ids = organizations.rows.map((row) => row.id);
  if (ids.length === 0) {
    return;
  }

  await pool.query(
    `
DELETE FROM iam.account_organizations
WHERE instance_id = $1
  AND organization_id = ANY($2::uuid[]);
`,
    [input.instanceId, ids]
  );

  for (const organizationId of ids) {
    await pool.query(
      `
DELETE FROM iam.organizations
WHERE instance_id = $1
  AND id = $2::uuid;
`,
      [input.instanceId, organizationId]
    );
  }
};

const cleanupAcceptanceAccounts = async (pool: Pool, input: {
  instanceId: string;
  keycloakSubjects: readonly string[];
}): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const accounts = await client.query<{ id: string }>(
      `
SELECT id
FROM iam.accounts
WHERE instance_id = $1
  AND keycloak_subject = ANY($2::text[]);
`,
      [input.instanceId, input.keycloakSubjects]
    );

    const accountIds = accounts.rows.map((row) => row.id);
    if (accountIds.length > 0) {
      await client.query(
        `
DELETE FROM iam.account_organizations
WHERE instance_id = $1
  AND account_id = ANY($2::uuid[]);
`,
        [input.instanceId, accountIds]
      );
      await client.query(
        `
DELETE FROM iam.account_roles
WHERE instance_id = $1
  AND account_id = ANY($2::uuid[]);
`,
        [input.instanceId, accountIds]
      );
      await client.query(
        `
DELETE FROM iam.instance_memberships
WHERE instance_id = $1
  AND account_id = ANY($2::uuid[]);
`,
        [input.instanceId, accountIds]
      );
      await client.query(
        `
DELETE FROM iam.activity_logs
WHERE instance_id = $1
  AND (
    account_id = ANY($2::uuid[])
    OR subject_id = ANY($2::uuid[])
  );
`,
        [input.instanceId, accountIds]
      );
      await client.query(
        `
DELETE FROM iam.accounts
WHERE instance_id = $1
  AND id = ANY($2::uuid[]);
`,
        [input.instanceId, accountIds]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    failStep({
      name: 'Testdaten-Reset',
      failureCode: 'acceptance_test_data_reset_failed',
      details: error instanceof Error ? error.message : String(error),
    });
  } finally {
    client.release();
  }
};

const expectAdminClaims = (input: {
  expectedInstanceId: string;
  expectedRoles: readonly string[];
  user: NonNullable<AuthMePayload['user']>;
}) => {
  if (!input.user.id || !input.user.instanceId) {
    failStep({
      name: 'OIDC Login Claims',
      failureCode: 'acceptance_expected_claim_missing',
      details: 'Der User-Kontext enthält nicht die Claims `sub` und `instanceId`.',
      metadata: { user: input.user },
    });
  }
  if (input.user.instanceId !== input.expectedInstanceId) {
    failStep({
      name: 'OIDC Login Claims',
      failureCode: 'acceptance_expected_claim_missing',
      details: `Erwartete instanceId "${input.expectedInstanceId}", erhalten "${input.user.instanceId}".`,
      metadata: { user: input.user },
    });
  }
  for (const expectedRole of input.expectedRoles) {
    if (!input.user.roles?.includes(expectedRole)) {
      failStep({
        name: 'OIDC Login Claims',
        failureCode: 'acceptance_expected_role_missing',
        details: `Die erwartete Rolle "${expectedRole}" fehlt im User-Kontext.`,
        metadata: { roles: input.user.roles },
      });
    }
  }
};

const requestJson = async <T>(response: ApiResponse, input: {
  details: string;
  failureCode: AcceptanceFailureCode;
  expectedStatus: number;
  name: string;
}): Promise<T> => {
  if (response.status() !== input.expectedStatus) {
    failStep({
      name: input.name,
      failureCode: input.failureCode,
      details: `${input.details} (HTTP ${response.status()})`,
    });
  }
  return fetchJson<T>(response);
};

const main = async (): Promise<void> => {
  const startedAt = new Date();
  let reportFileBase = 'iam-foundation-acceptance';

  try {
    const config = parseAcceptanceConfig(process.env, rootDir);
    reportFileBase = createAcceptanceReportFileBase(config, startedAt);

    const keycloakConfig: KeycloakAdminClientConfig = {
      baseUrl: config.keycloakAdmin.baseUrl,
      realm: config.keycloakAdmin.realm,
      clientId: config.keycloakAdmin.clientId,
      clientSecret: config.keycloakAdmin.clientSecret,
    };
    const keycloakAdmin = new KeycloakAdminClient(keycloakConfig);

    const adminIdentity = await resolveKeycloakUser(keycloakAdmin, config.admin.username, 'Admin-Testnutzer');
    const memberIdentity = await resolveKeycloakUser(keycloakAdmin, config.member.username, 'Member-Testnutzer');
    const adminRoleNames = await keycloakAdmin.listUserRoleNames(adminIdentity.externalId);
    for (const expectedRole of config.admin.expectedRoles) {
      if (!adminRoleNames.includes(expectedRole) && expectedRole !== 'system_admin') {
        failStep({
          name: 'Preflight Admin-Testnutzer',
          failureCode: 'acceptance_expected_role_missing',
          details: `Der Keycloak-Testnutzer "${config.admin.username}" besitzt die Rolle "${expectedRole}" nicht.`,
          metadata: { roles: adminRoleNames },
        });
      }
    }
    recordStep({
      name: 'Preflight Testnutzer',
      status: 'passed',
      details: 'Keycloak-Testnutzer und Rollenvertrag wurden geprüft.',
      metadata: {
        adminSubject: adminIdentity.externalId,
        memberSubject: memberIdentity.externalId,
      },
    });

    const pool = new Pool({ connectionString: config.databaseUrl });
    const browser = await chromium.launch({ headless: true });

    try {
      await cleanupAcceptanceOrganizations(pool, {
        instanceId: config.instanceId,
        organizationKeyPrefix: config.organizationKeyPrefix,
      });
      await cleanupAcceptanceAccounts(pool, {
        instanceId: config.instanceId,
        keycloakSubjects: [adminIdentity.externalId, memberIdentity.externalId],
      });
      recordStep({
        name: 'Testdaten-Reset',
        status: 'passed',
        details: 'Acceptance-Accounts und Acceptance-Organisationen wurden zurückgesetzt.',
      });

      const readyResponse = await fetch(new URL('/health/ready', config.baseUrl).toString());
      const readyPayload = (await readyResponse.json()) as HealthReadyPayload;
      if (
        readyResponse.status !== 200 ||
        readyPayload.status !== 'ready' ||
        !readyPayload.checks?.db ||
        !readyPayload.checks?.redis ||
        !readyPayload.checks?.keycloak
      ) {
        failStep({
          name: 'Readiness',
          failureCode: 'acceptance_dependency_not_ready',
          details: 'Das Readiness-Gate meldet nicht alle Dependencies als bereit.',
          metadata: readyPayload,
        });
      }
      recordStep({
        name: 'Readiness',
        status: 'passed',
        details: 'DB, Redis und Keycloak melden `ready`.',
        metadata: readyPayload,
      });

      const adminFirstLogin = await loginAndReadSession({
        baseUrl: config.baseUrl,
        browser,
        name: 'Admin Erstlogin',
        password: config.admin.password,
        username: config.admin.username,
      });
      expectAdminClaims({
        expectedInstanceId: config.instanceId,
        expectedRoles: config.admin.expectedRoles,
        user: adminFirstLogin.user,
      });
      const firstAdminAccount = await assertSingleProvisionedAccount({
        instanceId: config.instanceId,
        keycloakSubject: adminFirstLogin.user.id as string,
        name: 'Admin Erstlogin',
        pool,
      });
      recordStep({
        name: 'OIDC Login Claims',
        status: 'passed',
        details: 'Admin-Login liefert `sub`, `instanceId` und die erwarteten Rollen.',
        metadata: {
          instanceId: adminFirstLogin.user.instanceId,
          roles: adminFirstLogin.user.roles,
          sub: adminFirstLogin.user.id,
        },
      });
      recordStep({
        name: 'Admin JIT-Provisioning Erstlogin',
        status: 'passed',
        details: 'Der erste Admin-Login erzeugt den IAM-Account-Kontext deterministisch.',
        metadata: {
          accountId: firstAdminAccount.accountId,
          keycloakSubject: adminFirstLogin.user.id,
        },
      });
      await adminFirstLogin.context.close();

      const memberFirstLogin = await loginAndReadSession({
        baseUrl: config.baseUrl,
        browser,
        name: 'Member Erstlogin',
        password: config.member.password,
        username: config.member.username,
      });
      const memberAccount = await assertSingleProvisionedAccount({
        instanceId: config.instanceId,
        keycloakSubject: memberFirstLogin.user.id as string,
        name: 'Member Erstlogin',
        pool,
      });
      recordStep({
        name: 'Member JIT-Provisioning Erstlogin',
        status: 'passed',
        details: 'Der Member-Login erzeugt den benötigten Membership-Zielaccount.',
        metadata: {
          accountId: memberAccount.accountId,
          keycloakSubject: memberFirstLogin.user.id,
        },
      });
      await memberFirstLogin.context.close();

      const adminSecondLogin = await loginAndReadSession({
        baseUrl: config.baseUrl,
        browser,
        name: 'Admin Zweitlogin',
        password: config.admin.password,
        username: config.admin.username,
      });
      const secondAdminAccount = await assertSingleProvisionedAccount({
        instanceId: config.instanceId,
        keycloakSubject: adminSecondLogin.user.id as string,
        name: 'Admin Zweitlogin',
        pool,
      });
      if (firstAdminAccount.accountId !== secondAdminAccount.accountId) {
        failStep({
          name: 'Admin JIT-Provisioning Zweitlogin',
          failureCode: 'acceptance_database_query_failed',
          details: 'Der zweite Login hat keinen stabilen Account-Kontext wiederverwendet.',
          metadata: {
            firstAccountId: firstAdminAccount.accountId,
            secondAccountId: secondAdminAccount.accountId,
          },
        });
      }
      recordStep({
        name: 'Admin JIT-Provisioning Zweitlogin',
        status: 'passed',
        details: 'Der zweite Admin-Login verwendet den bestehenden Account ohne Duplikatbildung.',
        metadata: {
          accountId: secondAdminAccount.accountId,
        },
      });

      const seedRoot = await pool.query<{ id: string }>(
        `
SELECT id
FROM iam.organizations
WHERE instance_id = $1
  AND organization_key = 'seed-org-default'
LIMIT 1;
`,
        [config.instanceId]
      );
      const seedRootId = seedRoot.rows[0]?.id;
      if (!seedRootId) {
        failStep({
          name: 'Organisationen Preflight',
          failureCode: 'acceptance_database_query_failed',
          details: 'Die Seed-Organisation `seed-org-default` fehlt.',
        });
      }

      const adminRequest = adminSecondLogin.context.request;
      const parentMutationHeaders = buildMutationHeaders(config.baseUrl, `${reportFileBase}-organization-parent-create`);
      const parentPayload = {
        organizationKey: `${config.organizationKeyPrefix}-parent`,
        displayName: 'Acceptance Parent',
        organizationType: 'municipality',
        parentOrganizationId: seedRootId,
        contentAuthorPolicy: 'org_or_personal',
      };
      const parentCreateResponse = await adminRequest.post(
        new URL('/api/v1/iam/organizations', config.baseUrl).toString(),
        {
          data: parentPayload,
          failOnStatusCode: false,
          headers: parentMutationHeaders,
        }
      );
      const parentCreated = await requestJson<{ data: { id: string; displayName: string } }>(parentCreateResponse, {
        expectedStatus: 201,
        failureCode: 'acceptance_http_request_failed',
        details: 'Die Acceptance-Parent-Organisation konnte nicht angelegt werden.',
        name: 'Organisations-CRUD',
      });

      const childMutationHeaders = buildMutationHeaders(config.baseUrl, `${reportFileBase}-organization-child-create`);
      const childPayload = {
        organizationKey: `${config.organizationKeyPrefix}-child`,
        displayName: 'Acceptance Child',
        organizationType: 'district',
        parentOrganizationId: parentCreated.data.id,
        contentAuthorPolicy: 'org_only',
      };
      const childCreateResponse = await adminRequest.post(
        new URL('/api/v1/iam/organizations', config.baseUrl).toString(),
        {
          data: childPayload,
          failOnStatusCode: false,
          headers: childMutationHeaders,
        }
      );
      const childCreated = await requestJson<{ data: { id: string } }>(childCreateResponse, {
        expectedStatus: 201,
        failureCode: 'acceptance_http_request_failed',
        details: 'Die Acceptance-Child-Organisation konnte nicht angelegt werden.',
        name: 'Organisations-CRUD',
      });

      const childUpdateResponse = await adminRequest.patch(
        new URL(`/api/v1/iam/organizations/${childCreated.data.id}`, config.baseUrl).toString(),
        {
          data: {
            displayName: 'Acceptance Child Updated',
            contentAuthorPolicy: 'org_or_personal',
          },
          failOnStatusCode: false,
          headers: buildMutationHeaders(config.baseUrl),
        }
      );
      await requestJson(childUpdateResponse, {
        expectedStatus: 200,
        failureCode: 'acceptance_http_request_failed',
        details: 'Die Acceptance-Child-Organisation konnte nicht aktualisiert werden.',
        name: 'Organisations-CRUD',
      });

      const childReadResponse = await adminRequest.get(
        new URL(`/api/v1/iam/organizations/${childCreated.data.id}`, config.baseUrl).toString(),
        {
          failOnStatusCode: false,
        }
      );
      const childReadPayload = await requestJson<{ data: { displayName: string; id: string; parentOrganizationId: string | null } }>(
        childReadResponse,
        {
          expectedStatus: 200,
          failureCode: 'acceptance_http_request_failed',
          details: 'Die aktualisierte Acceptance-Child-Organisation konnte nicht gelesen werden.',
          name: 'Organisations-CRUD',
        }
      );
      if (
        childReadPayload.data.id !== childCreated.data.id ||
        childReadPayload.data.displayName !== 'Acceptance Child Updated' ||
        childReadPayload.data.parentOrganizationId !== parentCreated.data.id
      ) {
        failStep({
          name: 'Organisations-CRUD',
          failureCode: 'acceptance_organization_assertion_failed',
          details: 'Der API-Readback der Acceptance-Child-Organisation ist inkonsistent.',
          metadata: childReadPayload,
        });
      }

      const membershipAssignResponse = await adminRequest.post(
        new URL(`/api/v1/iam/organizations/${parentCreated.data.id}/memberships`, config.baseUrl).toString(),
        {
          data: {
            accountId: memberAccount.accountId,
            isDefaultContext: true,
            visibility: 'external',
          },
          failOnStatusCode: false,
          headers: buildMutationHeaders(config.baseUrl, `${reportFileBase}-membership-parent-assign`),
        }
      );
      await requestJson(membershipAssignResponse, {
        expectedStatus: 200,
        failureCode: 'acceptance_http_request_failed',
        details: 'Die Acceptance-Membership konnte nicht zugewiesen werden.',
        name: 'Membership-Zuweisung',
      });

      const childDeactivateResponse = await adminRequest.delete(
        new URL(`/api/v1/iam/organizations/${childCreated.data.id}`, config.baseUrl).toString(),
        {
          failOnStatusCode: false,
          headers: buildMutationHeaders(config.baseUrl),
        }
      );
      await requestJson(childDeactivateResponse, {
        expectedStatus: 200,
        failureCode: 'acceptance_http_request_failed',
        details: 'Die Acceptance-Child-Organisation konnte nicht deaktiviert werden.',
        name: 'Organisations-CRUD',
      });

      const organizationRows = await pool.query<OrganizationRow>(
        `
SELECT id, organization_key, display_name, parent_organization_id, hierarchy_path, depth, is_active
FROM iam.organizations
WHERE instance_id = $1
  AND organization_key IN ($2, $3)
ORDER BY organization_key ASC;
`,
        [config.instanceId, parentPayload.organizationKey, childPayload.organizationKey]
      );
      const parentRow = organizationRows.rows.find((row) => row.organization_key === parentPayload.organizationKey);
      const childRow = organizationRows.rows.find((row) => row.organization_key === childPayload.organizationKey);
      if (!parentRow || !childRow) {
        failStep({
          name: 'Organisations-CRUD',
          failureCode: 'acceptance_organization_assertion_failed',
          details: 'Die Acceptance-Organisationen sind nicht konsistent in der Datenbank vorhanden.',
          metadata: { rows: organizationRows.rows },
        });
      }
      const verifiedParentRow = parentRow as OrganizationRow;
      const verifiedChildRow = childRow as OrganizationRow;
      if (
        verifiedChildRow.parent_organization_id !== verifiedParentRow.id ||
        verifiedChildRow.is_active !== false ||
        verifiedChildRow.depth !== verifiedParentRow.depth + 1 ||
        !Array.isArray(verifiedChildRow.hierarchy_path) ||
        verifiedChildRow.hierarchy_path.length !== verifiedParentRow.hierarchy_path.length + 1 ||
        verifiedChildRow.hierarchy_path.at(-1) !== verifiedParentRow.id
      ) {
        failStep({
          name: 'Organisations-CRUD',
          failureCode: 'acceptance_organization_assertion_failed',
          details: 'Parent-/Child-Beziehung oder Hierarchiefelder stimmen nicht.',
          metadata: { childRow: verifiedChildRow, parentRow: verifiedParentRow },
        });
      }
      recordStep({
        name: 'Organisations-CRUD',
        status: 'passed',
        details: 'Anlegen, Aktualisieren und Deaktivieren der Acceptance-Organisationen wurden über API und DB verifiziert.',
        metadata: {
          childDepth: verifiedChildRow.depth,
          childHierarchyPath: verifiedChildRow.hierarchy_path,
          childOrganizationId: verifiedChildRow.id,
          parentOrganizationId: verifiedParentRow.id,
        },
      });

      const membershipRows = await pool.query<MembershipRow>(
        `
SELECT account_id, organization_id, is_default_context, membership_visibility
FROM iam.account_organizations
WHERE instance_id = $1
  AND account_id = $2::uuid
  AND organization_id = $3::uuid;
`,
        [config.instanceId, memberAccount.accountId, verifiedParentRow.id]
      );
      const membershipRow = membershipRows.rows[0];
      if (!membershipRow || !membershipRow.is_default_context || membershipRow.membership_visibility !== 'external') {
        failStep({
          name: 'Membership-Zuweisung',
          failureCode: 'acceptance_membership_missing',
          details: 'Membership oder Default-Kontext fehlt in der Datenbank.',
          metadata: { rows: membershipRows.rows },
        });
      }
      recordStep({
        name: 'Membership-Zuweisung',
        status: 'passed',
        details: 'Membership und Default-Kontext wurden per API und Datenbank nachgewiesen.',
        metadata: membershipRow,
      });

      const uiPage = await adminSecondLogin.context.newPage();
      await uiPage.goto(new URL('/admin/users', config.baseUrl).toString(), {
        timeout: 45_000,
        waitUntil: 'domcontentloaded',
      });
      await uiPage.waitForLoadState('networkidle');
      await expectVisible(uiPage.getByRole('heading', { name: 'Benutzerverwaltung' }), {
        name: 'UI Benutzerliste',
        failureCode: 'acceptance_ui_assertion_failed',
        details: 'Die Benutzerverwaltung wurde nicht geladen.',
      });
      await expectVisible(uiPage.getByLabel('Suche'), {
        name: 'UI Benutzerliste',
        failureCode: 'acceptance_ui_assertion_failed',
        details: 'Das Suchfeld der Benutzerverwaltung fehlt.',
      });
      await uiPage.getByLabel('Suche').fill(config.member.username);
      await uiPage.waitForLoadState('networkidle');
      await expectVisible(uiPage.getByRole('link', { name: memberFirstLogin.user.name ?? config.member.username }), {
        name: 'UI Benutzerliste',
        failureCode: 'acceptance_ui_assertion_failed',
        details: 'Der Acceptance-Member ist in der Benutzerliste nicht sichtbar.',
      });
      recordStep({
        name: 'UI Benutzerliste',
        status: 'passed',
        details: 'Die Benutzerliste zeigt den Acceptance-Member im aktiven Instanzkontext.',
      });

      await uiPage.goto(new URL('/admin/organizations', config.baseUrl).toString(), {
        timeout: 45_000,
        waitUntil: 'domcontentloaded',
      });
      await uiPage.waitForLoadState('networkidle');
      await expectVisible(uiPage.getByRole('heading', { name: 'Organisationsverwaltung' }), {
        name: 'UI Organisationsstruktur',
        failureCode: 'acceptance_ui_assertion_failed',
        details: 'Die Organisationsverwaltung wurde nicht geladen.',
      });
      await expectVisible(uiPage.getByText('Acceptance Parent'), {
        name: 'UI Organisationsstruktur',
        failureCode: 'acceptance_ui_assertion_failed',
        details: 'Die Acceptance-Parent-Organisation ist in der UI nicht sichtbar.',
      });
      await expectVisible(uiPage.getByText('Acceptance Child Updated'), {
        name: 'UI Organisationsstruktur',
        failureCode: 'acceptance_ui_assertion_failed',
        details: 'Die aktualisierte Acceptance-Child-Organisation ist in der UI nicht sichtbar.',
      });

      await uiPage.getByLabel('Suche').fill('Acceptance Parent');
      await uiPage.waitForLoadState('networkidle');
      await uiPage.getByRole('button', { name: 'Mitgliedschaften' }).first().click();
      await uiPage.waitForLoadState('networkidle');
      await expectVisible(uiPage.getByText(memberFirstLogin.user.name ?? config.member.username), {
        name: 'UI Membership-Nachweis',
        failureCode: 'acceptance_ui_assertion_failed',
        details: 'Die Membership-Zuweisung ist in der UI nicht sichtbar.',
      });
      await expectVisible(uiPage.getByText('Standardkontext'), {
        name: 'UI Membership-Nachweis',
        failureCode: 'acceptance_ui_assertion_failed',
        details: 'Der Default-Kontext wird in der Membership-UI nicht angezeigt.',
      });
      recordStep({
        name: 'UI Organisationsstruktur',
        status: 'passed',
        details: 'Organisationsstruktur und Membership-Zuweisung wurden in der Admin-Oberfläche nachgewiesen.',
      });

      await uiPage.close();
      await adminSecondLogin.context.close();
    } finally {
      await pool.end().catch(() => undefined);
      await browser.close().catch(() => undefined);
    }

    const report = buildAcceptanceReport({
      baseUrl: config.baseUrl,
      generatedAt: startedAt.toISOString(),
      instanceId: config.instanceId,
      steps: stepRecords,
    });
    const reportPaths = await writeAcceptanceReports({
      generatedAt: startedAt,
      report,
      reportDirectory: config.reportDirectory,
      reportFileBase: reportFileBase,
    });
    console.log(`[iam-acceptance] report written: ${reportPaths.markdownPath}`);

    if (report.summary.status === 'failed') {
      process.exitCode = 1;
    }
  } catch (error) {
    const configMissing = error instanceof Error && /Missing required acceptance env/.test(error.message);
    if (configMissing) {
      recordStep({
        name: 'Acceptance-Konfiguration',
        status: 'failed',
        failureCode: 'acceptance_config_missing',
        details: error.message,
      });
    } else if (!(error instanceof Error && /^acceptance_/.test(error.message))) {
      recordStep({
        name: 'Acceptance Runner',
        status: 'failed',
        failureCode: 'acceptance_report_write_failed',
        details: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      const fallbackConfig = parseAcceptanceConfig(
        {
          ...process.env,
          IAM_ACCEPTANCE_ADMIN_PASSWORD: process.env.IAM_ACCEPTANCE_ADMIN_PASSWORD ?? 'missing',
          IAM_ACCEPTANCE_ADMIN_USERNAME: process.env.IAM_ACCEPTANCE_ADMIN_USERNAME ?? 'missing',
          IAM_ACCEPTANCE_MEMBER_PASSWORD: process.env.IAM_ACCEPTANCE_MEMBER_PASSWORD ?? 'missing',
          IAM_ACCEPTANCE_MEMBER_USERNAME: process.env.IAM_ACCEPTANCE_MEMBER_USERNAME ?? 'missing',
          IAM_ACCEPTANCE_DATABASE_URL:
            process.env.IAM_ACCEPTANCE_DATABASE_URL ?? process.env.IAM_DATABASE_URL ?? 'postgres://invalid/acceptance',
          KEYCLOAK_ADMIN_BASE_URL: process.env.KEYCLOAK_ADMIN_BASE_URL ?? 'https://invalid.example.com',
          KEYCLOAK_ADMIN_CLIENT_ID: process.env.KEYCLOAK_ADMIN_CLIENT_ID ?? 'missing',
          KEYCLOAK_ADMIN_CLIENT_SECRET: process.env.KEYCLOAK_ADMIN_CLIENT_SECRET ?? 'missing',
          KEYCLOAK_ADMIN_REALM: process.env.KEYCLOAK_ADMIN_REALM ?? 'missing',
        },
        rootDir
      );
      const report = buildAcceptanceReport({
        baseUrl: fallbackConfig.baseUrl,
        generatedAt: startedAt.toISOString(),
        instanceId: fallbackConfig.instanceId,
        steps: stepRecords,
      });
      await writeAcceptanceReports({
        generatedAt: startedAt,
        report,
        reportDirectory: fallbackConfig.reportDirectory,
        reportFileBase: reportFileBase,
      });
    } catch {
      // Intentionally swallow secondary report failures. The original error remains authoritative.
    }
    process.exitCode = 1;
  }
};

void main();
