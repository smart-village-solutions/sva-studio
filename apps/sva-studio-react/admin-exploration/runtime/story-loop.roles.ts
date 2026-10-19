import { openTenantContext, createRoleViaUi, assignRoleToUserViaUi } from './browser.js';
import { createTenantUserPayload, createUserViaUi } from './story-loop.users.js';
import {
  defaultEvidenceForCluster,
  type AdminExplorationStoryCluster,
  type AdminExplorationStoryEvidenceInput,
} from './story-loop.evidence.js';
import type { AdminExplorationConfig } from './types.js';

type BrowserModule = typeof import('@playwright/test');

export function createRolePayload(runToken: string) {
  const uniqueSuffix = runToken
    .slice(-12)
    .replace(/[^a-z0-9]/giu, '')
    .slice(-8);
  const roleName = `adminExploration_role_${uniqueSuffix}`.toLowerCase();
  const displayName = `AdminExploration Role ${uniqueSuffix}`;
  const description = `AdminExploration-Testrolle ${uniqueSuffix}`;
  const idempotencyKey = `admin-exploration-role-${runToken}`;

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
  const response = await context.request.get(
    new URL(`/api/v1/iam/users/${userId}`, tenantBaseUrl).toString(),
    {
      failOnStatusCode: false,
      headers: {
        Accept: 'application/json',
      },
    }
  );

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
    payload.data?.roles?.some(
      (role) => role.roleId === roleId || role.roleName === roleDisplayName
    ) ?? false
  );
}

async function verifyRoleVisibleInCatalog(
  context: import('@playwright/test').BrowserContext,
  tenantBaseUrl: string,
  roleId: string,
  roleName: string,
  roleDisplayName: string
): Promise<boolean> {
  const response = await context.request.get(
    new URL('/api/v1/iam/roles', tenantBaseUrl).toString(),
    {
      failOnStatusCode: false,
      headers: {
        Accept: 'application/json',
      },
    }
  );

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
      (role) =>
        role.id === roleId || role.roleName === roleName || role.displayName === roleDisplayName
    ) ?? false
  );
}

export async function executeRoleAndPermissionManagementCluster(
  config: AdminExplorationConfig,
  cluster: AdminExplorationStoryCluster,
  chromiumFactory: () => Promise<BrowserModule['chromium']>
): Promise<readonly AdminExplorationStoryEvidenceInput[]> {
  if (config.tenant === null) {
    return defaultEvidenceForCluster(cluster).map((entry) => ({
      ...entry,
      notes:
        'Tenant-Konfiguration fehlt; Rollen- und Zuweisungslauf kann lokal nicht automatisch geprüft werden.',
    }));
  }

  const tenant = config.tenant;
  const chromium = await chromiumFactory();
  const browser = await chromium.launch({ headless: true });
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/gu, '')
    .slice(0, 14);
  const user = createTenantUserPayload(`role-assignment-${timestamp}`);
  const role = createRolePayload(`role-assignment-${timestamp}`);

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
        negative: 'missing',
        positive: userRoleVerified && roleVisibleInCatalog ? 'verified' : 'missing',
      },
    }));
  } catch (error) {
    return failedRoleManagementEvidence(cluster, error);
  } finally {
    await browser.close();
  }
}

function failedRoleManagementEvidence(
  cluster: AdminExplorationStoryCluster,
  error: unknown
): readonly AdminExplorationStoryEvidenceInput[] {
  const message =
    error instanceof Error
      ? error.message
      : 'Der browsergeführte Rollen- und Zuweisungslauf ist fehlgeschlagen.';

  return cluster.stories.map((story) => ({
    storyId: story.id,
    coverage: 'nachweis_fehlend',
    notes: message,
    findings: [
      'Der browsergeführte Rollen-/Nutzer-/Zuweisungsflow konnte nicht vollständig ausgeführt werden.',
    ],
    verification: {
      environment: 'adequate',
      negative: 'missing',
      positive: 'missing',
    },
  }));
}
