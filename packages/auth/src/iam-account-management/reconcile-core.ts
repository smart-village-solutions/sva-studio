import type { IdentityProviderPort } from '../identity-provider-port.js';
import { readString } from '../shared/input-readers.js';

import {
  emitRoleAuditEvent,
  resolveIdentityProvider,
  setRoleDriftBacklog,
  setRoleSyncState,
  trackKeycloakCall,
  withInstanceScopedDb,
} from './shared.js';
import {
  getRoleDisplayName,
  getRoleExternalName,
  mapRoleSyncErrorCode,
  sanitizeRoleErrorMessage,
} from './role-audit.js';
import type { ManagedRoleRow } from './types.js';

type IdentityRole = Awaited<ReturnType<IdentityProviderPort['getRoleByName']>> extends infer T ? Exclude<T, null> : never;

type ReconcileRoleEntry = {
  readonly roleId?: string;
  readonly roleKey?: string;
  readonly externalRoleName: string;
  readonly action: 'noop' | 'create' | 'update' | 'report';
  readonly status: 'synced' | 'corrected' | 'failed' | 'requires_manual_action';
  readonly errorCode?: string;
};

export type ReconcileReport = {
  readonly checkedCount: number;
  readonly correctedCount: number;
  readonly failedCount: number;
  readonly requiresManualActionCount: number;
  readonly roles: readonly ReconcileRoleEntry[];
  readonly debug?: {
    readonly instanceId: string;
    readonly dbRoleCount: number;
    readonly listedIdpRoleCount: number;
    readonly hydratedIdpRoleCount: number;
    readonly managedIdpRoleCount: number;
    readonly importFailures?: ReadonlyArray<{
      readonly roleKey?: string;
      readonly externalRoleName: string;
      readonly errorName: string;
      readonly errorMessage: string;
      readonly dbContext?: {
        readonly currentUser?: string;
        readonly sessionUser?: string;
        readonly currentRole?: string;
        readonly appInstanceId?: string;
      };
    }>;
    readonly dbRoleMatches: ReadonlyArray<{
      readonly roleKey: string;
      readonly externalRoleName: string;
      readonly hasExternalNameMatch: boolean;
      readonly hasRoleKeyMatch: boolean;
      readonly matchingExternalNameByRoleKey?: string;
      readonly listedRoleFound: boolean;
      readonly listedRoleHasAttributes: boolean;
      readonly hydratedRoleFound: boolean;
      readonly hydratedManagedBy?: string;
      readonly hydratedInstanceId?: string;
      readonly hydratedRoleKey?: string;
      readonly hydratedDisplayName?: string;
    }>;
  };
};

type RoleImportDbContext = {
  currentUser?: string;
  sessionUser?: string;
  currentRole?: string;
  appInstanceId?: string;
};

type RoleReconcileAlias = {
  readonly externalRoleName: string;
  readonly identityRoleKey?: string;
};

const ROLE_RECONCILE_ALIASES: Readonly<Record<string, RoleReconcileAlias>> = {
  editor: {
    externalRoleName: 'Editor',
    identityRoleKey: 'mainserver_editor',
  },
};

const BUILTIN_REALM_ROLE_NAMES = new Set(['offline_access', 'uma_authorization']);

const readRoleAttribute = (
  attributes: Readonly<Record<string, readonly string[]>> | undefined,
  key: string
): string | undefined => {
  const values = attributes?.[key];
  return Array.isArray(values) ? readString(values[0]) : undefined;
};

const isStudioManagedIdentityRole = (role: IdentityRole, instanceId: string): boolean =>
  readRoleAttribute(role.attributes, 'managed_by') === 'studio' &&
  readRoleAttribute(role.attributes, 'instance_id') === instanceId;

const readImportableRoleMetadata = (
  role: IdentityRole
): { roleKey: string; displayName: string; roleLevel: number } | null => {
  const roleKey = readRoleAttribute(role.attributes, 'role_key');
  const displayName = readRoleAttribute(role.attributes, 'display_name');
  const roleLevelRaw = readRoleAttribute(role.attributes, 'role_level');
  const parsedRoleLevel = roleLevelRaw ? Number(roleLevelRaw) : 0;

  if (!roleKey || !displayName) {
    return null;
  }

  if (!Number.isFinite(parsedRoleLevel) || parsedRoleLevel < 0 || parsedRoleLevel > 100) {
    return null;
  }

  return {
    roleKey,
    displayName,
    roleLevel: parsedRoleLevel,
  };
};

const requiresRoleDetailHydration = (role: IdentityRole): boolean =>
  !readRoleAttribute(role.attributes, 'managed_by') ||
  !readRoleAttribute(role.attributes, 'instance_id') ||
  !readRoleAttribute(role.attributes, 'role_key') ||
  !readRoleAttribute(role.attributes, 'display_name');

const isPotentialStudioManagedRealmRole = (role: IdentityRole): boolean => {
  if (role.clientRole) {
    return false;
  }

  if (BUILTIN_REALM_ROLE_NAMES.has(role.externalName)) {
    return false;
  }

  if (role.externalName.startsWith('default-roles-')) {
    return false;
  }

  return true;
};

const hydrateRoleDetailsForReconciliation = async (
  identityProvider: { provider: IdentityProviderPort },
  roles: readonly IdentityRole[]
): Promise<readonly IdentityRole[]> =>
  Promise.all(
    roles.map(async (role) => {
      if (!isPotentialStudioManagedRealmRole(role) || !requiresRoleDetailHydration(role)) {
        return role;
      }

      const detailedRole = await trackKeycloakCall('reconcile_get_role_by_name', () =>
        identityProvider.provider.getRoleByName(role.externalName)
      );

      return detailedRole ?? role;
    })
  );

const readRoleReconcileAlias = (roleKey: string): RoleReconcileAlias | undefined => ROLE_RECONCILE_ALIASES[roleKey];

const isAcceptedIdentityRoleKey = (roleKey: string, identityRoleKey: string | undefined): boolean => {
  if (!identityRoleKey) {
    return false;
  }

  if (identityRoleKey === roleKey) {
    return true;
  }

  return readRoleReconcileAlias(roleKey)?.identityRoleKey === identityRoleKey;
};

const buildReconcileDebugReport = (input: {
  instanceId: string;
  dbRoles: readonly ManagedRoleRow[];
  listedIdpRoles: readonly IdentityRole[];
  hydratedIdpRoles: readonly IdentityRole[];
  managedIdpRoles: readonly IdentityRole[];
  importFailures: ReadonlyArray<{
    roleKey?: string;
    externalRoleName: string;
    errorName: string;
    errorMessage: string;
    dbContext?: {
      currentUser?: string;
      sessionUser?: string;
      currentRole?: string;
      appInstanceId?: string;
    };
  }>;
}) => {
  const listedByExternalName = new Map(input.listedIdpRoles.map((role) => [role.externalName, role]));
  const hydratedByExternalName = new Map(input.hydratedIdpRoles.map((role) => [role.externalName, role]));
  const managedByExternalName = new Map(input.managedIdpRoles.map((role) => [role.externalName, role]));
  const managedByRoleKey = new Map(
    input.managedIdpRoles.flatMap((role) => {
      const roleKey = readRoleAttribute(role.attributes, 'role_key');
      return roleKey ? ([[roleKey, role]] as const) : [];
    })
  );

  return {
    instanceId: input.instanceId,
    dbRoleCount: input.dbRoles.length,
    listedIdpRoleCount: input.listedIdpRoles.length,
    hydratedIdpRoleCount: input.hydratedIdpRoles.length,
    managedIdpRoleCount: input.managedIdpRoles.length,
    importFailures: input.importFailures,
    dbRoleMatches: input.dbRoles.map((role) => {
      const externalRoleName = getRoleExternalName(role);
      const listedRole = listedByExternalName.get(externalRoleName);
      const hydratedRole = hydratedByExternalName.get(externalRoleName);
      const externalNameMatch = managedByExternalName.get(externalRoleName);
      const roleKeyMatch = managedByRoleKey.get(role.role_key);

      return {
        roleKey: role.role_key,
        externalRoleName,
        hasExternalNameMatch: Boolean(externalNameMatch),
        hasRoleKeyMatch: Boolean(roleKeyMatch),
        matchingExternalNameByRoleKey: roleKeyMatch?.externalName,
        listedRoleFound: Boolean(listedRole),
        listedRoleHasAttributes: Boolean(listedRole?.attributes && Object.keys(listedRole.attributes).length > 0),
        hydratedRoleFound: Boolean(hydratedRole),
        hydratedManagedBy: readRoleAttribute(hydratedRole?.attributes, 'managed_by'),
        hydratedInstanceId: readRoleAttribute(hydratedRole?.attributes, 'instance_id'),
        hydratedRoleKey: readRoleAttribute(hydratedRole?.attributes, 'role_key'),
        hydratedDisplayName: readRoleAttribute(hydratedRole?.attributes, 'display_name'),
      };
    }),
  } satisfies NonNullable<ReconcileReport['debug']>;
};

const reconcileDatabaseRoles = async (input: {
  dbRoles: readonly ManagedRoleRow[];
  idpByExternalName: ReadonlyMap<string, IdentityRole>;
  idpByRoleKey: ReadonlyMap<string, IdentityRole>;
  matchedIdentityExternalNames: Set<string>;
  matchedIdentityRoleKeys: Set<string>;
  entries: ReconcileRoleEntry[];
  instanceId: string;
  actorAccountId?: string;
  requestId?: string;
  traceId?: string;
  identityProvider: { provider: IdentityProviderPort };
}) => {
  for (const role of input.dbRoles) {
    const externalRoleName = getRoleExternalName(role);
    const alias = readRoleReconcileAlias(role.role_key);
    const matchingIdentityRole =
      input.idpByExternalName.get(externalRoleName) ??
      input.idpByRoleKey.get(role.role_key) ??
      (alias ? input.idpByExternalName.get(alias.externalRoleName) : undefined) ??
      (alias?.identityRoleKey ? input.idpByRoleKey.get(alias.identityRoleKey) : undefined);
    const expectedDisplayName = getRoleDisplayName(role);
    const identityDisplayName = readRoleAttribute(matchingIdentityRole?.attributes, 'display_name');
    const identityRoleKey = readRoleAttribute(matchingIdentityRole?.attributes, 'role_key');
    const canonicalExternalRoleName = matchingIdentityRole?.externalName ?? externalRoleName;
    const matchedByAlias =
      Boolean(alias) &&
      identityRoleKey === alias?.identityRoleKey &&
      (matchingIdentityRole?.externalName === alias?.externalRoleName ||
        matchingIdentityRole?.externalName === input.idpByRoleKey.get(alias?.identityRoleKey ?? '')?.externalName) &&
      alias?.identityRoleKey !== role.role_key;
    const aliasSatisfiedByCanonicalRole = matchedByAlias && identityRoleKey === alias?.identityRoleKey;
    const reportedExternalRoleName = matchedByAlias ? canonicalExternalRoleName : externalRoleName;

    if (!matchingIdentityRole) {
      try {
        await trackKeycloakCall('reconcile_create_role', () =>
          input.identityProvider.provider.createRole({
            externalName: externalRoleName,
            description: role.description ?? undefined,
            attributes: {
              managedBy: 'studio',
              instanceId: input.instanceId,
              roleKey: role.role_key,
              displayName: expectedDisplayName,
            },
          })
        );
        await withInstanceScopedDb(input.instanceId, async (client) => {
          await setRoleSyncState(client, {
            instanceId: input.instanceId,
            roleId: role.id,
            syncState: 'synced',
            errorCode: null,
            syncedAt: true,
          });
          await emitRoleAuditEvent(client, {
            instanceId: input.instanceId,
            accountId: input.actorAccountId,
            roleId: role.id,
            eventType: 'role.reconciled',
            operation: 'reconcile_create',
            result: 'success',
            roleKey: role.role_key,
            externalRoleName,
            requestId: input.requestId,
            traceId: input.traceId,
          });
        });
        input.entries.push({
          roleId: role.id,
          roleKey: role.role_key,
          externalRoleName,
          action: 'create',
          status: 'corrected',
        });
      } catch (error) {
        const errorCode = mapRoleSyncErrorCode(error);
        await withInstanceScopedDb(input.instanceId, async (client) => {
          await setRoleSyncState(client, {
            instanceId: input.instanceId,
            roleId: role.id,
            syncState: 'failed',
            errorCode,
          });
          await emitRoleAuditEvent(client, {
            instanceId: input.instanceId,
            accountId: input.actorAccountId,
            roleId: role.id,
            eventType: 'role.reconciled',
            operation: 'reconcile_create',
            result: 'failure',
            roleKey: role.role_key,
            externalRoleName,
            errorCode,
            requestId: input.requestId,
            traceId: input.traceId,
          });
        });
        input.entries.push({
          roleId: role.id,
          roleKey: role.role_key,
          externalRoleName,
          action: 'create',
          status: 'failed',
          errorCode,
        });
      }
      continue;
    }

    input.matchedIdentityExternalNames.add(matchingIdentityRole.externalName);
    if (identityRoleKey) {
      input.matchedIdentityRoleKeys.add(identityRoleKey);
    }

    const descriptionChanged = (matchingIdentityRole.description ?? undefined) !== (role.description ?? undefined);
    const displayNameChanged = identityDisplayName !== expectedDisplayName;
    const roleKeyChanged = !isAcceptedIdentityRoleKey(role.role_key, identityRoleKey);
    const shouldUpdateIdentityRole =
      !aliasSatisfiedByCanonicalRole && (descriptionChanged || displayNameChanged || roleKeyChanged);
    const shouldResyncDbState = role.sync_state !== 'synced';

    if (shouldUpdateIdentityRole || shouldResyncDbState) {
      try {
        await withInstanceScopedDb(input.instanceId, async (client) => {
          if (shouldUpdateIdentityRole) {
            await trackKeycloakCall('reconcile_update_role', () =>
              input.identityProvider.provider.updateRole(canonicalExternalRoleName, {
                description: role.description ?? undefined,
                attributes: {
                  managedBy: 'studio',
                  instanceId: input.instanceId,
                  roleKey: role.role_key,
                  displayName: expectedDisplayName,
                },
              })
            );
          }
          await setRoleSyncState(client, {
            instanceId: input.instanceId,
            roleId: role.id,
            syncState: 'synced',
            errorCode: null,
            syncedAt: true,
          });
          await emitRoleAuditEvent(client, {
            instanceId: input.instanceId,
            accountId: input.actorAccountId,
            roleId: role.id,
            eventType: 'role.reconciled',
            operation: 'reconcile_update',
            result: 'success',
            roleKey: role.role_key,
            externalRoleName,
            requestId: input.requestId,
            traceId: input.traceId,
          });
        });
        input.entries.push({
          roleId: role.id,
          roleKey: role.role_key,
          externalRoleName: reportedExternalRoleName,
          action: shouldUpdateIdentityRole ? 'update' : 'noop',
          status: 'corrected',
        });
      } catch (error) {
        const errorCode = mapRoleSyncErrorCode(error);
        await withInstanceScopedDb(input.instanceId, async (client) => {
          await setRoleSyncState(client, {
            instanceId: input.instanceId,
            roleId: role.id,
            syncState: 'failed',
            errorCode,
          });
          await emitRoleAuditEvent(client, {
            instanceId: input.instanceId,
            accountId: input.actorAccountId,
            roleId: role.id,
            eventType: 'role.reconciled',
            operation: 'reconcile_update',
            result: 'failure',
            roleKey: role.role_key,
            externalRoleName,
            errorCode,
            requestId: input.requestId,
            traceId: input.traceId,
          });
        });
        input.entries.push({
          roleId: role.id,
          roleKey: role.role_key,
          externalRoleName: reportedExternalRoleName,
          action: shouldUpdateIdentityRole ? 'update' : 'noop',
          status: 'failed',
          errorCode,
        });
      }
      continue;
    }

    input.entries.push({
      roleId: role.id,
      roleKey: role.role_key,
      externalRoleName: reportedExternalRoleName,
      action: 'noop',
      status: 'synced',
    });
  }
};

const reconcileManagedIdentityRoles = async (input: {
  managedIdpRoles: readonly IdentityRole[];
  dbByExternalName: ReadonlyMap<string, ManagedRoleRow>;
  dbByRoleKey: ReadonlyMap<string, ManagedRoleRow>;
  matchedIdentityExternalNames: ReadonlySet<string>;
  matchedIdentityRoleKeys: ReadonlySet<string>;
  entries: ReconcileRoleEntry[];
  importFailures: Array<{
    roleKey?: string;
    externalRoleName: string;
    errorName: string;
    errorMessage: string;
    dbContext?: RoleImportDbContext;
  }>;
  instanceId: string;
  actorAccountId?: string;
  requestId?: string;
  traceId?: string;
  includeDiagnostics?: boolean;
}) => {
  for (const identityRole of input.managedIdpRoles) {
    const identityRoleKey = readRoleAttribute(identityRole.attributes, 'role_key');
    if (input.matchedIdentityExternalNames.has(identityRole.externalName)) {
      continue;
    }
    if (identityRoleKey && input.matchedIdentityRoleKeys.has(identityRoleKey)) {
      continue;
    }
    if (input.dbByExternalName.has(identityRole.externalName) || (identityRoleKey && input.dbByRoleKey.has(identityRoleKey))) {
      continue;
    }

    const importableMetadata = readImportableRoleMetadata(identityRole);
    if (!importableMetadata) {
      input.entries.push({
        externalRoleName: identityRole.externalName,
        roleKey: readRoleAttribute(identityRole.attributes, 'role_key'),
        action: 'report',
        status: 'requires_manual_action',
        errorCode: 'REQUIRES_MANUAL_ACTION',
      });
      continue;
    }

    let importDbContext: RoleImportDbContext | undefined;
    try {
      const importedRole = await withInstanceScopedDb(input.instanceId, async (client) => {
        if (input.includeDiagnostics) {
          const dbContextResult = await client.query<{
            current_user: string | null;
            session_user: string | null;
            current_role: string | null;
            app_instance_id: string | null;
          }>(
            `
SELECT
  current_user,
  session_user,
  current_role,
  current_setting('app.instance_id', true) AS app_instance_id;
`
          );
          const dbContextRow = dbContextResult.rows[0];
          importDbContext = dbContextRow
            ? {
                currentUser: readString(dbContextRow.current_user ?? undefined),
                sessionUser: readString(dbContextRow.session_user ?? undefined),
                currentRole: readString(dbContextRow.current_role ?? undefined),
                appInstanceId: readString(dbContextRow.app_instance_id ?? undefined),
              }
            : undefined;
        }

        const inserted = await client.query<{ id: string }>(
          `
INSERT INTO iam.roles (
  instance_id,
  role_key,
  role_name,
  display_name,
  external_role_name,
  description,
  is_system_role,
  role_level,
  managed_by,
  sync_state,
  last_synced_at,
  last_error_code
)
VALUES ($1, $2, $3, $4, $5, $6, false, $7, 'studio', 'synced', NOW(), NULL)
RETURNING id;
`,
          [
            input.instanceId,
            importableMetadata.roleKey,
            importableMetadata.roleKey,
            importableMetadata.displayName,
            identityRole.externalName,
            identityRole.description ?? null,
            importableMetadata.roleLevel,
          ]
        );
        const roleId = inserted.rows[0]?.id;
        if (!roleId) {
          throw new Error('role_import_failed');
        }

        await emitRoleAuditEvent(client, {
          instanceId: input.instanceId,
          accountId: input.actorAccountId,
          roleId,
          eventType: 'role.reconciled',
          operation: 'reconcile_import',
          result: 'success',
          roleKey: importableMetadata.roleKey,
          externalRoleName: identityRole.externalName,
          requestId: input.requestId,
          traceId: input.traceId,
        });

        return { roleId };
      });
      input.entries.push({
        roleId: importedRole.roleId,
        roleKey: importableMetadata.roleKey,
        externalRoleName: identityRole.externalName,
        action: 'create',
        status: 'corrected',
      });
    } catch (error) {
      input.importFailures.push({
        roleKey: importableMetadata.roleKey,
        externalRoleName: identityRole.externalName,
        errorName: error instanceof Error ? error.name : 'Error',
        errorMessage: sanitizeRoleErrorMessage(error),
        dbContext: importDbContext,
      });
      input.entries.push({
        roleKey: importableMetadata.roleKey,
        externalRoleName: identityRole.externalName,
        action: 'create',
        status: 'failed',
        errorCode: mapRoleSyncErrorCode(error),
      });
    }
  }
};

const reportRemainingPotentialStudioRoles = (input: {
  idpRoles: readonly IdentityRole[];
  idpByExternalName: ReadonlyMap<string, IdentityRole>;
  dbByExternalName: ReadonlyMap<string, ManagedRoleRow>;
  entries: ReconcileRoleEntry[];
}) => {
  for (const identityRole of input.idpRoles) {
    if (input.idpByExternalName.has(identityRole.externalName) || input.dbByExternalName.has(identityRole.externalName)) {
      continue;
    }

    if (!isPotentialStudioManagedRealmRole(identityRole)) {
      continue;
    }

    input.entries.push({
      externalRoleName: identityRole.externalName,
      roleKey: readRoleAttribute(identityRole.attributes, 'role_key') ?? identityRole.externalName,
      action: 'report',
      status: 'requires_manual_action',
      errorCode: 'REQUIRES_MANUAL_ACTION',
    });
  }
};

export const runRoleCatalogReconciliation = async (input: {
  instanceId: string;
  actorAccountId?: string;
  requestId?: string;
  traceId?: string;
  includeDiagnostics?: boolean;
}): Promise<ReconcileReport> => {
  const identityProvider = resolveIdentityProvider();
  if (!identityProvider) {
    throw new Error('identity_provider_unavailable');
  }

  const dbRoles = await withInstanceScopedDb(input.instanceId, async (client) => {
    const result = await client.query<ManagedRoleRow>(
      `
SELECT
  id,
  role_key,
  role_name,
  display_name,
  external_role_name,
  description,
  is_system_role,
  role_level,
  managed_by,
  sync_state,
  last_synced_at::text,
  last_error_code
FROM iam.roles
WHERE instance_id = $1
  AND managed_by = 'studio'
ORDER BY role_level DESC, COALESCE(display_name, role_name) ASC;
`,
      [input.instanceId]
    );
    return result.rows;
  });

  const listedIdpRoles = await trackKeycloakCall('reconcile_list_roles', () => identityProvider.provider.listRoles());
  const idpRoles = await hydrateRoleDetailsForReconciliation(identityProvider, listedIdpRoles);
  const managedIdpRoles = idpRoles.filter((role) => isStudioManagedIdentityRole(role, input.instanceId));
  const idpByExternalName = new Map(managedIdpRoles.map((role) => [role.externalName, role]));
  const idpByRoleKey = new Map(
    managedIdpRoles.flatMap((role) => {
      const roleKey = readRoleAttribute(role.attributes, 'role_key');
      return roleKey ? ([[roleKey, role]] as const) : [];
    })
  );
  const dbByExternalName = new Map(dbRoles.map((role) => [getRoleExternalName(role), role]));
  const dbByRoleKey = new Map(dbRoles.map((role) => [role.role_key, role]));
  const matchedIdentityExternalNames = new Set<string>();
  const matchedIdentityRoleKeys = new Set<string>();

  const entries: ReconcileRoleEntry[] = [];
  const importFailures: Array<{
    roleKey?: string;
    externalRoleName: string;
    errorName: string;
    errorMessage: string;
    dbContext?: RoleImportDbContext;
  }> = [];

  await reconcileDatabaseRoles({
    dbRoles,
    idpByExternalName,
    idpByRoleKey,
    matchedIdentityExternalNames,
    matchedIdentityRoleKeys,
    entries,
    instanceId: input.instanceId,
    actorAccountId: input.actorAccountId,
    requestId: input.requestId,
    traceId: input.traceId,
    identityProvider,
  });

  await reconcileManagedIdentityRoles({
    managedIdpRoles,
    dbByExternalName,
    dbByRoleKey,
    matchedIdentityExternalNames,
    matchedIdentityRoleKeys,
    entries,
    importFailures,
    instanceId: input.instanceId,
    actorAccountId: input.actorAccountId,
    requestId: input.requestId,
    traceId: input.traceId,
    includeDiagnostics: input.includeDiagnostics,
  });

  reportRemainingPotentialStudioRoles({
    idpRoles,
    idpByExternalName,
    dbByExternalName,
    entries,
  });

  const report = {
    checkedCount: entries.length,
    correctedCount: entries.filter((entry) => entry.status === 'corrected').length,
    failedCount: entries.filter((entry) => entry.status === 'failed').length,
    requiresManualActionCount: entries.filter((entry) => entry.status === 'requires_manual_action').length,
    roles: entries,
    ...(input.includeDiagnostics
      ? {
          debug: buildReconcileDebugReport({
            instanceId: input.instanceId,
            dbRoles,
            listedIdpRoles,
            hydratedIdpRoles: idpRoles,
            managedIdpRoles,
            importFailures,
          }),
        }
      : {}),
  } satisfies ReconcileReport;

  setRoleDriftBacklog(input.instanceId, report.failedCount + report.requiresManualActionCount);
  return report;
};
