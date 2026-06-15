import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadStagehandStoryCatalogFromFile,
  writeStagehandStoryCheckOverlay,
  type StagehandStoryCheck,
  type StagehandStoryRecord,
} from '../stories/state.js';
import { toPortableArtifactPath } from '../reporting/path-utils.js';
import { buildStagehandStoryClusters } from './clusters.js';
import type { StagehandAdminConfig, StagehandStoryCheckStatus, StagehandStoryCoverage } from './types.js';

export interface StagehandStoryCluster {
  readonly id: string;
  readonly reason: string;
  readonly stories: readonly StagehandStoryRecord[];
}

export interface StagehandStoryEvidence {
  readonly coverage: StagehandStoryCoverage;
  readonly findings: readonly string[];
  readonly notes: string;
  readonly status: StagehandStoryCheckStatus;
  readonly storyId: number;
}

export interface StagehandStoryVerification {
  readonly environment: 'adequate' | 'insufficient';
  readonly negative: 'missing' | 'verified';
  readonly positive: 'missing' | 'verified';
}

export interface StagehandStoryEvidenceInput {
  readonly coverage: StagehandStoryCoverage;
  readonly findings: readonly string[];
  readonly notes: string;
  readonly storyId: number;
  readonly verification: StagehandStoryVerification;
}

export interface StagehandStoryLoopSummary {
  readonly clusters: number;
  readonly storiesClassified: number;
  readonly storiesFailedEvidence: number;
  readonly storiesPassed: number;
  readonly storiesSkipped: number;
}

export interface StagehandStoryLoopResult {
  readonly artifacts: {
    readonly overlayPath: string;
    readonly reportPath: string;
    readonly statusPath: string;
    readonly transcriptPath: string;
  };
  readonly summary: StagehandStoryLoopSummary;
}

export interface RunStagehandStoryLoopOptions {
  readonly executeCluster?: (input: {
    cluster: StagehandStoryCluster;
    stories: readonly StagehandStoryRecord[];
  }) => Promise<readonly StagehandStoryEvidenceInput[]>;
  readonly generatedAt?: string;
  readonly loadChromium?: () => Promise<BrowserModule['chromium']>;
  readonly reportsRoot: string;
  readonly storySourcePath: string;
}

interface StoryLoopAggregateStatus {
  readonly generatedAt: string;
  readonly overlayPath: string;
  readonly stories: readonly {
    readonly coverage: StagehandStoryCoverage;
    readonly findings: readonly string[];
    readonly notes: string;
    readonly status: StagehandStoryCheckStatus;
    readonly storyId: number;
  }[];
  readonly summary: StagehandStoryLoopSummary;
  readonly transcriptPath: string;
}

type BrowserModule = typeof import('@playwright/test');

type ApiResponsePayload = {
  readonly data?: {
    readonly invitation?: {
      readonly status?: string;
    };
    readonly user?: {
      readonly id?: string;
    };
  };
  readonly error?: {
    readonly message?: string;
  };
};

const appRequire = createRequire(fileURLToPath(import.meta.url));

function createAggregateArtifacts(reportsRoot: string) {
  const loopDirectory = join(reportsRoot, 'story-loop');

  return {
    overlayPath: join(loopDirectory, 'overlay.json'),
    reportPath: join(loopDirectory, 'report.md'),
    statusPath: join(loopDirectory, 'status.json'),
    transcriptPath: join(loopDirectory, 'transcript.jsonl'),
  };
}

function shouldSkipStory(config: StagehandAdminConfig, story: StagehandStoryRecord): boolean {
  if (config.storyFilters.resume && story.studioCheck.status !== 'offen') {
    return true;
  }

  if (config.storyFilters.storyIds.length > 0 && config.storyFilters.storyIds.includes(story.id) === false) {
    return true;
  }

  if (config.storyFilters.packageIds.length > 0 && config.storyFilters.packageIds.includes(story.packageId) === false) {
    return true;
  }

  return false;
}

function buildClusters(config: StagehandAdminConfig, stories: readonly StagehandStoryRecord[]): StagehandStoryCluster[] {
  return buildStagehandStoryClusters(stories.filter((story) => shouldSkipStory(config, story) === false))
    .filter(
      (cluster) => config.storyFilters.clusters.length === 0 || config.storyFilters.clusters.includes(cluster.definition.id)
    )
    .map((cluster) => ({
      id: cluster.definition.id,
      reason: cluster.definition.reason,
      stories: cluster.stories,
    }));
}

function defaultEvidenceForCluster(cluster: StagehandStoryCluster): readonly StagehandStoryEvidenceInput[] {
  return cluster.stories.map((story) => ({
    storyId: story.id,
    coverage: 'nachweis_fehlend',
    notes: `Cluster ${cluster.id}: ${cluster.reason}`,
    findings: [
      'Für diese Story existiert im aktuellen lokalen Stagehand-Ausbau noch kein belastbarer Vollnachweis.',
      `Grund: ${cluster.reason}`,
    ],
    verification: {
      environment: 'insufficient',
      negative: 'missing',
      positive: 'missing',
    },
  }));
}

export function classifyStoryEvidence(input: StagehandStoryEvidenceInput): StagehandStoryEvidence {
  if (input.verification.environment === 'insufficient') {
    return {
      ...input,
      status: 'umgebung_unzureichend',
    };
  }

  if (input.verification.positive === 'verified' && input.verification.negative === 'verified') {
    return {
      ...input,
      status: 'erfuellt',
    };
  }

  return {
    ...input,
    status: 'unklar',
  };
}

async function loadChromium() {
  return (appRequire('@playwright/test') as BrowserModule).chromium;
}

async function loginTenantAdmin(
  page: import('@playwright/test').Page,
  tenant: { admin: { password: string; username: string }; baseUrl: string }
): Promise<void> {
  await page.goto(new URL('/auth/login', tenant.baseUrl).toString(), {
    timeout: 45_000,
    waitUntil: 'domcontentloaded',
  });
  await performKeycloakLogin(page, tenant.admin);
  await page.waitForURL(new RegExp(`${tenant.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/.*`), {
    timeout: 45_000,
  });
  await page.waitForLoadState('networkidle');
}

async function openTenantContext(
  browser: import('@playwright/test').Browser,
  tenant: { admin: { password: string; username: string }; baseUrl: string }
) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await loginTenantAdmin(page, tenant);

  return {
    context,
    page,
  };
}

function createTenantUserPayload(timestamp: string) {
  const uniqueSuffix = timestamp.slice(-6);
  const email = `stagehand.story18.${timestamp}@example.invalid`;
  const firstName = 'Stagehand';
  const lastName = `Loop${uniqueSuffix}`;
  const displayName = `${firstName} ${lastName}`;
  const idempotencyKey = `stagehand-story18-${timestamp}`;

  return {
    displayName,
    email,
    firstName,
    idempotencyKey,
    lastName,
  };
}

async function createTenantUser(
  context: import('@playwright/test').BrowserContext,
  tenantBaseUrl: string,
  user: ReturnType<typeof createTenantUserPayload>
): Promise<ApiResponsePayload & { readonly httpStatus: number }> {
  const response = await context.request.post(new URL('/api/v1/iam/users', tenantBaseUrl).toString(), {
    data: {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      roleIds: [],
      sendPasswordSetupEmail: false,
    },
    failOnStatusCode: false,
    headers: createMutationHeaders(tenantBaseUrl, user.idempotencyKey),
  });
  const payload = (await response.json().catch(() => ({}))) as ApiResponsePayload;

  return {
    ...payload,
    httpStatus: response.status(),
  };
}

async function verifyTenantUserVisible(
  page: import('@playwright/test').Page,
  tenantBaseUrl: string,
  userId: string,
  user: Pick<ReturnType<typeof createTenantUserPayload>, 'displayName' | 'email'>
): Promise<boolean> {
  await page.goto(new URL(`/admin/users/${userId}`, tenantBaseUrl).toString(), {
    timeout: 45_000,
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle');

  const pageContent = await page.textContent('body');

  return (pageContent?.includes(user.email) ?? false) && (pageContent?.includes(user.displayName) ?? false);
}

async function verifyTenantUserHiddenFromNeighbor(
  browser: import('@playwright/test').Browser,
  tenant: NonNullable<StagehandAdminConfig['tenant']>,
  userId: string,
  user: Pick<ReturnType<typeof createTenantUserPayload>, 'displayName' | 'email'>
): Promise<{ readonly verified: boolean; readonly details: readonly string[] }> {
  const neighbor = tenant.neighbor;

  if (neighbor === null) {
    return {
      verified: false,
      details: ['Nachbar-Mandant ist nicht konfiguriert.'],
    };
  }

  const { context, page } = await openTenantContext(browser, neighbor);
  const details: string[] = [];

  try {
    const apiResponse = await context.request.get(new URL(`/api/v1/iam/users/${userId}`, neighbor.baseUrl).toString(), {
      failOnStatusCode: false,
      headers: {
        Accept: 'application/json',
      },
    });
    const apiDenied = apiResponse.status() === 403 || apiResponse.status() === 404;
    details.push(`Nachbar-Mandanten-API antwortete mit HTTP ${apiResponse.status()}.`);

    await page.goto(new URL(`/admin/users/${userId}`, neighbor.baseUrl).toString(), {
      timeout: 45_000,
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle');

    const pageContent = await page.textContent('body');
    const uiHidden =
      (pageContent?.includes(user.email) ?? false) === false && (pageContent?.includes(user.displayName) ?? false) === false;

    details.push(
      uiHidden
        ? 'Im Nachbar-Mandanten waren weder E-Mail noch Anzeigename sichtbar.'
        : 'Im Nachbar-Mandanten waren fremde Nutzerdaten sichtbar.'
    );

    return {
      verified: apiDenied && uiHidden,
      details,
    };
  } finally {
    await context.close();
  }
}

function createRolePayload(timestamp: string) {
  const uniqueSuffix = timestamp.slice(-6);
  const roleName = `stagehand_role_${uniqueSuffix}`.toLowerCase();
  const displayName = `Stagehand Role ${uniqueSuffix}`;
  const description = `Stagehand-Testrolle ${uniqueSuffix}`;
  const idempotencyKey = `stagehand-role-${timestamp}`;

  return {
    description,
    displayName,
    idempotencyKey,
    roleLevel: 40,
    roleName,
  };
}

async function verifyUserRoleAssignment(
  context: import('@playwright/test').BrowserContext,
  tenantBaseUrl: string,
  userId: string,
  roleId: string,
  roleDisplayName: string
): Promise<boolean> {
  const response = await context.request.get(new URL(`/api/v1/iam/users/${userId}`, tenantBaseUrl).toString(), {
    failOnStatusCode: false,
    headers: {
      Accept: 'application/json',
    },
  });

  if (response.status() !== 200) {
    return false;
  }

  const payload = (await response.json().catch(() => ({}))) as {
    readonly data?: {
      readonly roles?: readonly {
        readonly roleId?: string;
        readonly roleName?: string;
      }[];
    };
  };

  return (
    payload.data?.roles?.some((role) => role.roleId === roleId || role.roleName === roleDisplayName) ?? false
  );
}

async function verifyRoleVisibleInCatalog(
  context: import('@playwright/test').BrowserContext,
  tenantBaseUrl: string,
  roleId: string,
  roleName: string,
  roleDisplayName: string
): Promise<boolean> {
  const response = await context.request.get(new URL('/api/v1/iam/roles', tenantBaseUrl).toString(), {
    failOnStatusCode: false,
    headers: {
      Accept: 'application/json',
    },
  });

  if (response.status() !== 200) {
    return false;
  }

  const payload = (await response.json().catch(() => ({}))) as {
    readonly data?: readonly {
      readonly id?: string;
      readonly roleName?: string;
      readonly displayName?: string;
    }[];
  };

  return (
    payload.data?.some(
      (role) => role.id === roleId || role.roleName === roleName || role.displayName === roleDisplayName
    ) ?? false
  );
}

async function fillIfVisible(page: import('@playwright/test').Page, selectors: readonly string[], value: string): Promise<boolean> {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);

    if (count === 0) {
      continue;
    }

    const first = locator.first();
    const isVisible = await first.isVisible().catch(() => false);

    if (isVisible === false) {
      continue;
    }

    await first.fill(value);
    return true;
  }

  return false;
}

async function clickIfVisible(
  page: import('@playwright/test').Page,
  selectors: readonly ({ kind: 'css'; value: string } | { kind: 'role'; value: string | RegExp })[]
): Promise<boolean> {
  for (const selector of selectors) {
    const locator =
      selector.kind === 'css' ? page.locator(selector.value) : page.getByRole('button', { name: selector.value });
    const count = await locator.count().catch(() => 0);

    if (count === 0) {
      continue;
    }

    const first = locator.first();
    const isVisible = await first.isVisible().catch(() => false);

    if (isVisible === false) {
      continue;
    }

    await first.click();
    return true;
  }

  return false;
}

async function createRoleViaUi(
  page: import('@playwright/test').Page,
  tenantBaseUrl: string,
  role: ReturnType<typeof createRolePayload>
): Promise<string> {
  await page.goto(new URL('/admin/roles/new', tenantBaseUrl).toString(), {
    timeout: 45_000,
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle');

  const roleKeyFilled = await fillIfVisible(page, ['#create-role-key'], role.roleName);
  const roleNameFilled = await fillIfVisible(page, ['#create-role-name'], role.displayName);
  const roleDescriptionFilled = await fillIfVisible(page, ['#create-role-description'], role.description);
  const roleLevelFilled = await fillIfVisible(page, ['#create-role-level'], String(role.roleLevel));

  if (roleKeyFilled === false || roleNameFilled === false || roleDescriptionFilled === false || roleLevelFilled === false) {
    throw new Error('Die Rollenanlage konnte in der UI nicht vollständig befüllt werden.');
  }

  const createClicked = await clickIfVisible(page, [{ kind: 'role', value: /rolle anlegen/i }]);

  if (createClicked === false) {
    throw new Error('Der UI-Button für die Rollenanlage wurde nicht gefunden.');
  }

  await page.waitForURL(/\/admin\/roles\/(?!new(?:[/?#]|$))[^/?#]+(?:[?#].*)?$/u, { timeout: 45_000 });
  await page.waitForLoadState('networkidle');

  const createdRoleUrl = page.url();
  const roleId = new URL(createdRoleUrl).pathname.split('/').pop();

  if (roleId === undefined || roleId === '' || roleId === 'new') {
    throw new Error(`Die Rollenanlage führte nicht auf eine belastbare Detail-URL: ${createdRoleUrl}`);
  }

  return roleId;
}

async function createUserViaUi(
  page: import('@playwright/test').Page,
  tenantBaseUrl: string,
  user: ReturnType<typeof createTenantUserPayload>
): Promise<string> {
  await page.goto(new URL('/admin/users/new', tenantBaseUrl).toString(), {
    timeout: 45_000,
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle');

  const emailFilled = await fillIfVisible(page, ['#create-user-email'], user.email);
  const firstNameFilled = await fillIfVisible(page, ['#create-user-first-name'], user.firstName);
  const lastNameFilled = await fillIfVisible(page, ['#create-user-last-name'], user.lastName);

  if (emailFilled === false || firstNameFilled === false || lastNameFilled === false) {
    throw new Error('Die Nutzeranlage konnte in der UI nicht vollständig befüllt werden.');
  }

  const createClicked = await clickIfVisible(page, [{ kind: 'role', value: /nutzer anlegen/i }]);

  if (createClicked === false) {
    throw new Error('Der UI-Button für die Nutzeranlage wurde nicht gefunden.');
  }

  await page.waitForURL(/\/admin\/users\/[^/]+/u, { timeout: 45_000 });
  await page.waitForLoadState('networkidle');

  const createdUserUrl = page.url();
  const userId = new URL(createdUserUrl).pathname.split('/').pop();

  if (userId === undefined || userId === '' || userId === 'new') {
    throw new Error(`Die Nutzeranlage führte nicht auf eine belastbare Detail-URL: ${createdUserUrl}`);
  }

  return userId;
}

async function assignRoleToUserViaUi(
  page: import('@playwright/test').Page,
  tenantBaseUrl: string,
  roleId: string,
  userEmail: string
): Promise<void> {
  await page.goto(new URL(`/admin/roles/${roleId}`, tenantBaseUrl).toString(), {
    timeout: 45_000,
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle');

  const assignmentsTabClicked = await clickIfVisible(page, [{ kind: 'role', value: /zuweisungen/i }]);

  if (assignmentsTabClicked === false) {
    throw new Error('Der Zuweisungen-Tab der Rollen-Detailseite wurde nicht gefunden.');
  }

  await page.waitForLoadState('networkidle');

  const searchFilled = await fillIfVisible(page, ['#role-assignment-search'], userEmail);

  if (searchFilled === false) {
    throw new Error('Die Benutzer-Suche im Rollen-Zuweisungsbereich wurde nicht gefunden.');
  }

  await page.waitForLoadState('networkidle');

  const assignClicked = await clickIfVisible(page, [{ kind: 'role', value: /zuweisen/i }]);

  if (assignClicked === false) {
    throw new Error('Der UI-Button für die Rollenzuweisung wurde nicht gefunden.');
  }

  await page.waitForLoadState('networkidle');
}

async function performKeycloakLogin(
  page: import('@playwright/test').Page,
  credentials: { password: string; username: string }
): Promise<void> {
  const usernameFilled = await fillIfVisible(page, ['input[name="username"]', '#username'], credentials.username);
  const passwordFilled = await fillIfVisible(page, ['input[name="password"]', '#password'], credentials.password);

  if (usernameFilled === false || passwordFilled === false) {
    throw new Error('Die Keycloak-Loginmaske konnte nicht automatisiert bedient werden.');
  }

  const clicked = await clickIfVisible(page, [
    { kind: 'css', value: '#kc-login' },
    { kind: 'role', value: /anmelden|sign in|login/i },
  ]);

  if (clicked === false) {
    throw new Error('Der Keycloak-Login-Button wurde nicht gefunden.');
  }
}

function createMutationHeaders(baseUrl: string, idempotencyKey: string): Record<string, string> {
  const origin = new URL(baseUrl).origin;

  return {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    Origin: origin,
    Referer: `${origin}/`,
    'Idempotency-Key': idempotencyKey,
  };
}

async function executeTenantUserCreateCluster(
  config: StagehandAdminConfig,
  cluster: StagehandStoryCluster,
  chromiumFactory: () => Promise<BrowserModule['chromium']>
): Promise<readonly StagehandStoryEvidenceInput[]> {
  if (config.tenant === null) {
    return defaultEvidenceForCluster(cluster).map((entry) => ({
      ...entry,
      notes: 'Tenant-Konfiguration fehlt; Story kann lokal nicht automatisch geprüft werden.',
    }));
  }

  const tenant = config.tenant;
  const chromium = await chromiumFactory();
  const browser = await chromium.launch({ headless: true });
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/gu, '').slice(0, 14);
  const user = createTenantUserPayload(timestamp);

  try {
    const { context, page } = await openTenantContext(browser, tenant);
    const responsePayload = await createTenantUser(context, tenant.baseUrl, user);

    if (responsePayload.httpStatus !== 201 || responsePayload.data?.user?.id === undefined) {
      return cluster.stories.map((story) => ({
        storyId: story.id,
        coverage: 'nachweis_fehlend',
        notes:
          responsePayload.error?.message ??
          `Nutzeranlage antwortete mit HTTP ${responsePayload.httpStatus} und lieferte keine belastbare User-ID.`,
        findings: [
          `Tenant-Create-Call fehlgeschlagen: HTTP ${responsePayload.httpStatus}.`,
          'Die Story konnte lokal nicht positiv nachgewiesen werden.',
        ],
        verification: {
          environment: 'adequate',
          negative: 'missing',
          positive: 'missing',
        },
      }));
    }

    const userId = responsePayload.data.user.id;
    const visibleInTenant = await verifyTenantUserVisible(page, tenant.baseUrl, userId, user);

    if (visibleInTenant === false) {
      return cluster.stories.map((story) => ({
        storyId: story.id,
        coverage: 'nachweis_fehlend',
        notes: 'Nutzer wurde erzeugt, konnte aber in der Detailansicht nicht eindeutig nachgewiesen werden.',
        findings: [
          `User-ID ${userId} wurde erstellt, aber Name/E-Mail waren nicht in /admin/users/${userId} sichtbar.`,
        ],
        verification: {
          environment: 'adequate',
          negative: 'missing',
          positive: 'missing',
        },
      }));
    }

    return cluster.stories.map((story) => ({
      storyId: story.id,
      coverage: 'luecke',
      notes: `Tenant-Nachweis über User ${user.email} auf ${tenant.baseUrl}/admin/users/${userId}; tenant-übergreifender Negativnachweis fehlt noch.`,
      findings: [
        `Nutzer ${user.email} wurde im Tenant erfolgreich angelegt.`,
        `Die Detailansicht /admin/users/${userId} zeigte Name und E-Mail.`,
        `Passwort-Einladung wurde mit Status ${responsePayload.data?.invitation?.status ?? 'not_requested'} verarbeitet.`,
        'Ein Negativnachweis gegen einen Nachbar-Mandanten wurde in diesem Executor noch nicht geführt.',
      ],
      verification: {
        environment: 'adequate',
        negative: 'missing',
        positive: 'verified',
      },
    }));
  } finally {
    await browser.close();
  }
}

async function executeTenantIsolationCluster(
  config: StagehandAdminConfig,
  cluster: StagehandStoryCluster,
  chromiumFactory: () => Promise<BrowserModule['chromium']>
): Promise<readonly StagehandStoryEvidenceInput[]> {
  if (config.tenant === null || config.tenant.neighbor === null) {
    return defaultEvidenceForCluster(cluster).map((entry) => ({
      ...entry,
      notes: 'Tenant- oder Nachbar-Mandanten-Konfiguration fehlt; Isolation kann lokal nicht ehrlich geprüft werden.',
    }));
  }

  const tenant = config.tenant;
  const chromium = await chromiumFactory();
  const browser = await chromium.launch({ headless: true });
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/gu, '').slice(0, 14);
  const user = createTenantUserPayload(timestamp);

  try {
    const { context, page } = await openTenantContext(browser, tenant);
    const responsePayload = await createTenantUser(context, tenant.baseUrl, user);

    if (responsePayload.httpStatus !== 201 || responsePayload.data?.user?.id === undefined) {
      return cluster.stories.map((story) => ({
        storyId: story.id,
        coverage: 'nachweis_fehlend',
        notes:
          responsePayload.error?.message ??
          `Isolationstest konnte den Ausgangsnutzer nicht anlegen: HTTP ${responsePayload.httpStatus}.`,
        findings: [
          `Tenant-Create-Call für Isolationstest fehlgeschlagen: HTTP ${responsePayload.httpStatus}.`,
        ],
        verification: {
          environment: 'adequate',
          negative: 'missing',
          positive: 'missing',
        },
      }));
    }

    const userId = responsePayload.data.user.id;
    const visibleInTenant = await verifyTenantUserVisible(page, tenant.baseUrl, userId, user);

    if (visibleInTenant === false) {
      return cluster.stories.map((story) => ({
        storyId: story.id,
        coverage: 'nachweis_fehlend',
        notes: 'Isolationstest konnte die erzeugten Ausgangsdaten im Ausgangsmandanten nicht sichtbar reproduzieren.',
        findings: [`User-ID ${userId} war im Ausgangsmandanten nicht sichtbar.`],
        verification: {
          environment: 'adequate',
          negative: 'missing',
          positive: 'missing',
        },
      }));
    }

    const negativeProof = await verifyTenantUserHiddenFromNeighbor(browser, tenant, userId, user);

    return cluster.stories.map((story) => ({
      storyId: story.id,
      coverage: negativeProof.verified ? 'vorhanden' : 'luecke',
      notes: negativeProof.verified
        ? `Mandantentrennung für User ${user.email} zwischen ${tenant.baseUrl} und ${tenant.neighbor?.baseUrl} nachgewiesen.`
        : `Ausgangsmandant sichtbar, aber Negativnachweis gegen ${tenant.neighbor?.baseUrl} blieb unvollständig.`,
      findings: [
        `Nutzer ${user.email} war im Ausgangsmandanten sichtbar.`,
        ...negativeProof.details,
      ],
      verification: {
        environment: 'adequate',
        negative: negativeProof.verified ? 'verified' : 'missing',
        positive: 'verified',
      },
    }));
  } finally {
    await browser.close();
  }
}

async function executeRoleAndPermissionManagementCluster(
  config: StagehandAdminConfig,
  cluster: StagehandStoryCluster,
  chromiumFactory: () => Promise<BrowserModule['chromium']>
): Promise<readonly StagehandStoryEvidenceInput[]> {
  if (config.tenant === null) {
    return defaultEvidenceForCluster(cluster).map((entry) => ({
      ...entry,
      notes: 'Tenant-Konfiguration fehlt; Rollen- und Zuweisungslauf kann lokal nicht automatisch geprüft werden.',
    }));
  }

  const tenant = config.tenant;
  const chromium = await chromiumFactory();
  const browser = await chromium.launch({ headless: true });
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/gu, '').slice(0, 14);
  const user = createTenantUserPayload(timestamp);
  const role = createRolePayload(timestamp);

  try {
    const { context, page } = await openTenantContext(browser, tenant);
    const createdRoleId = await createRoleViaUi(page, tenant.baseUrl, role);
    const createdUserId = await createUserViaUi(page, tenant.baseUrl, user);
    await assignRoleToUserViaUi(page, tenant.baseUrl, createdRoleId, user.email);

    const userRoleVerified = await verifyUserRoleAssignment(
      context,
      tenant.baseUrl,
      createdUserId,
      createdRoleId,
      role.displayName
    );
    const roleVisibleInCatalog = await verifyRoleVisibleInCatalog(
      context,
      tenant.baseUrl,
      createdRoleId,
      role.roleName,
      role.displayName
    );

    return cluster.stories.map((story) => ({
      storyId: story.id,
      coverage: userRoleVerified && roleVisibleInCatalog ? 'vorhanden' : 'luecke',
      notes:
        userRoleVerified && roleVisibleInCatalog
          ? `Nutzer ${user.email} erhielt die Rolle ${role.displayName} und beide Nachweise waren über API sichtbar.`
          : `Rolle ${role.displayName} oder ihre Zuweisung zu ${user.email} blieb nur teilweise nachweisbar.`,
      findings: [
        `Rolle ${role.displayName} wurde angelegt.`,
        `Nutzer ${user.email} wurde angelegt.`,
        `Rolle ${role.displayName} wurde dem Nutzer zugeordnet.`,
        userRoleVerified
          ? 'Die Nutzerdetail-API zeigte die Rollenzuweisung.'
          : 'Die Nutzerdetail-API zeigte die Rollenzuweisung nicht belastbar.',
        roleVisibleInCatalog
          ? 'Die Rollenliste enthielt die neue Rolle.'
          : 'Die Rollenliste enthielt die neue Rolle nicht belastbar.',
      ],
      verification: {
        environment: 'adequate',
        negative: userRoleVerified ? 'verified' : 'missing',
        positive: userRoleVerified && roleVisibleInCatalog ? 'verified' : 'missing',
      },
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Der browsergeführte Rollen- und Zuweisungslauf ist fehlgeschlagen.';

    return cluster.stories.map((story) => ({
      storyId: story.id,
      coverage: 'nachweis_fehlend',
      notes: message,
      findings: ['Der browsergeführte Rollen-/Nutzer-/Zuweisungsflow konnte nicht vollständig ausgeführt werden.'],
      verification: {
        environment: 'adequate',
        negative: 'missing',
        positive: 'missing',
      },
    }));
  } finally {
    await browser.close();
  }
}

async function executeDefaultCluster(
  config: StagehandAdminConfig,
  cluster: StagehandStoryCluster,
  chromiumFactory: () => Promise<BrowserModule['chromium']>
): Promise<readonly StagehandStoryEvidenceInput[]> {
  if (cluster.id === 'tenant-user-create') {
    return executeTenantUserCreateCluster(config, cluster, chromiumFactory);
  }

  if (cluster.id === 'tenant-isolation') {
    return executeTenantIsolationCluster(config, cluster, chromiumFactory);
  }

  if (cluster.id === 'role-and-permission-management') {
    return executeRoleAndPermissionManagementCluster(config, cluster, chromiumFactory);
  }

  return defaultEvidenceForCluster(cluster);
}

function createSummary(
  clusters: readonly StagehandStoryCluster[],
  evidence: readonly StagehandStoryEvidence[],
  skippedStories: number
): StagehandStoryLoopSummary {
  const storiesPassed = evidence.filter((entry) => entry.status === 'erfuellt').length;
  const storiesFailedEvidence = evidence.filter((entry) => entry.status === 'unklar').length;

  return {
    clusters: clusters.length,
    storiesClassified: evidence.length,
    storiesFailedEvidence,
    storiesPassed,
    storiesSkipped: skippedStories,
  };
}

function createAggregateMarkdown(
  generatedAt: string,
  summary: StagehandStoryLoopSummary,
  evidence: readonly StagehandStoryEvidence[],
  stories: ReadonlyMap<number, StagehandStoryRecord>,
  transcriptPath: string
): string {
  return [
    '# Stagehand-Story-Loop',
    '',
    `Erstellt am: \`${generatedAt}\``,
    `Verarbeitete Stories: \`${summary.storiesClassified}\``,
    `Erfüllt: \`${summary.storiesPassed}\``,
    `Unklar / Lücke: \`${summary.storiesFailedEvidence}\``,
    `Umgebung unzureichend: \`${evidence.filter((entry) => entry.status === 'umgebung_unzureichend').length}\``,
    `Übersprungen: \`${summary.storiesSkipped}\``,
    '',
    '## Story-Ergebnisse',
    ...(evidence.length === 0
      ? ['- Keine']
      : evidence.flatMap((entry) => {
          const story = stories.get(entry.storyId);
          const title = story?.story ?? `Story ${entry.storyId}`;

          return [
            `- ${story?.packageId ?? 'IAM'} / Story ${entry.storyId}: ${title}`,
            `  - Status: ${entry.status}`,
            `  - Coverage: ${entry.coverage}`,
            `  - Notes: ${entry.notes}`,
            ...entry.findings.map((finding) => `  - Finding: ${finding}`),
          ];
        })),
    '',
    '## Transkript',
    '```text',
    transcriptPath,
    '```',
  ].join('\n');
}

export async function runStagehandStoryLoop(
  config: StagehandAdminConfig,
  options: RunStagehandStoryLoopOptions
): Promise<StagehandStoryLoopResult> {
  const catalog = loadStagehandStoryCatalogFromFile(options.storySourcePath);
  const stories = [...catalog.storyIndex.values()].sort((left, right) => left.id - right.id);
  const eligibleStories = stories.filter((story) => shouldSkipStory(config, story) === false);
  const clusters = buildClusters(config, stories);
  const storiesCoveredByClusters = new Set(clusters.flatMap((cluster) => cluster.stories.map((story) => story.id)));
  const resumeSkippedStories = stories.filter((story) => shouldSkipStory(config, story)).length;
  const filteredOutStories = eligibleStories.length - storiesCoveredByClusters.size;
  const skippedStories = resumeSkippedStories + filteredOutStories;
  const chromiumFactory = options.loadChromium ?? loadChromium;
  const executeCluster =
    options.executeCluster ?? (async ({ cluster }) => executeDefaultCluster(config, cluster, chromiumFactory));
  const evidence = (
    await Promise.all(clusters.map((cluster) => executeCluster({ cluster, stories: cluster.stories })))
  )
    .flat()
    .map((entry) => classifyStoryEvidence(entry));
  const summary = createSummary(clusters, evidence, skippedStories);
  const artifacts = createAggregateArtifacts(options.reportsRoot);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const clusterByStoryId = new Map(
    clusters.flatMap((cluster) => cluster.stories.map((story) => [story.id, cluster.id] as const))
  );

  writeStagehandStoryCheckOverlay(artifacts.overlayPath, {
    generatedAt,
    sourcePath: toPortableArtifactPath(options.storySourcePath),
    stories: evidence.map((entry) => ({
      clusterId: clusterByStoryId.get(entry.storyId) ?? 'unknown',
      storyId: entry.storyId,
      studioCheck: {
        status: entry.status,
        coverage: entry.coverage,
        notes: entry.notes,
      } satisfies StagehandStoryCheck,
      findings: entry.findings,
    })),
  });

  mkdirSync(dirname(artifacts.statusPath), { recursive: true });
  mkdirSync(dirname(artifacts.reportPath), { recursive: true });
  mkdirSync(dirname(artifacts.transcriptPath), { recursive: true });

  const aggregateStatus: StoryLoopAggregateStatus = {
    generatedAt,
    overlayPath: toPortableArtifactPath(artifacts.overlayPath),
    stories: evidence.map((entry) => ({
      coverage: entry.coverage,
      findings: entry.findings,
      notes: entry.notes,
      status: entry.status,
      storyId: entry.storyId,
    })),
    summary,
    transcriptPath: toPortableArtifactPath(artifacts.transcriptPath),
  };

  writeFileSync(artifacts.statusPath, `${JSON.stringify(aggregateStatus, null, 2)}\n`, 'utf8');
  writeFileSync(
    artifacts.reportPath,
    `${createAggregateMarkdown(
      generatedAt,
      summary,
      evidence,
      catalog.storyIndex,
      toPortableArtifactPath(artifacts.transcriptPath)
    )}\n`,
    'utf8'
  );
  writeFileSync(
    artifacts.transcriptPath,
    `${evidence
      .map((entry) =>
        JSON.stringify({
          storyId: entry.storyId,
          status: entry.status,
          coverage: entry.coverage,
          findings: entry.findings,
        })
      )
      .join('\n')}\n`,
    'utf8'
  );

  return {
    artifacts,
    summary,
  };
}
