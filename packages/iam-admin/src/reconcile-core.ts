import type { IdentityProviderPort } from './identity-provider-port.js';
import { readString } from './input-readers.js';

import {
  getRoleDisplayName,
  getRoleExternalName,
  mapRoleSyncErrorCode,
  sanitizeRoleErrorMessage,
} from './role-audit.js';
import type { QueryClient } from './query-client.js';
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
  readonly outcome: 'success' | 'partial_failure' | 'failed';
  readonly checkedCount: number;
  readonly correctedCount: number;
  readonly failedCount: number;
  readonly manualReviewCount: number;
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

type RoleReconcileOperation = 'reconcile_create' | 'reconcile_update' | 'reconcile_import';
type RoleReconcileResult = 'success' | 'failure';

export type RoleCatalogReconciliationDeps = {
  resolveIdentityProviderForInstance(instanceId: string): Promise<{ provider: IdentityProviderPort } | null>;
  withInstanceScopedDb<T>(instanceId: string, work: (client: QueryClient) => Promise<T>): Promise<T>;
  setRoleSyncState(
    client: QueryClient,
    input: {
      instanceId: string;
      roleId: string;
      syncState: 'synced' | 'failed';
      errorCode: string | null;
      syncedAt?: true;
    }
  ): Promise<void>;
  emitRoleAuditEvent(
    client: QueryClient,
    input: {
      instanceId: string;
      accountId?: string;
      roleId: string;
      eventType: 'role.reconciled';
      operation: RoleReconcileOperation;
      result: RoleReconcileResult;
      roleKey: string;
      externalRoleName: string;
      errorCode?: string;
      requestId?: string;
      traceId?: string;
    }
  ): Promise<void>;
  trackKeycloakCall<T>(operation: string, execute: () => Promise<T>): Promise<T>;
  setRoleDriftBacklog(instanceId: string, backlog: number): void;
};

const ROLE_RECONCILE_ALIASES: Readonly<Record<string, RoleReconcileAlias>> = {
  editor: {
    externalRoleName: 'Editor',
    identityRoleKey: 'mainserver_editor',
  },
};

const BUILTIN_REALM_ROLE_NAMES = new Set(['offline_access', 'uma_authorization']);
const NON_TENANT_CATALOG_REALM_ROLE_NAMES = new Set(['instance_registry_admin', 'realm_account_admin']);

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

  // Some realm roles may exist in tenant realms for platform or Keycloak-native
  // authorization, but they are not part of the tenant role catalog.
  if (NON_TENANT_CATALOG_REALM_ROLE_NAMES.has(role.externalName)) {
    return false;
  }

  if (role.externalName.startsWith('default-roles-')) {
    return false;
  }

  return true;
};

const hydrateRoleDetailsForReconciliation = async (
  deps: RoleCatalogReconciliationDeps,
  identityProvider: { provider: IdentityProviderPort },
  roles: readonly IdentityRole[]
): Promise<readonly IdentityRole[]> =>
  Promise.all(
    roles.map(async (role) => {
      if (!isPotentialStudioManagedRealmRole(role) || !requiresRoleDetailHydration(role)) {
        return role;
      }

      const detailedRole = await deps.trackKeycloakCall('reconcile_get_role_by_name', () =>
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

const appendReconcileEntry = (
  entries: ReconcileRoleEntry[],
  entry: ReconcileRoleEntry
): void => {
  entries.push(entry);
};

const resolveMatchingIdentityRole = (input: {
  role: ManagedRoleRow;
  idpByExternalName: ReadonlyMap<string, IdentityRole>;
  idpByRoleKey: ReadonlyMap<string, IdentityRole>;
}) => {
  const externalRoleName = getRoleExternalName(input.role);
  const alias = readRoleReconcileAlias(input.role.role_key);
  const matchingIdentityRole =
    input.idpByExternalName.get(externalRoleName) ??
    input.idpByRoleKey.get(input.role.role_key) ??
    (alias ? input.idpByExternalName.get(alias.externalRoleName) : undefined) ??
    (alias?.identityRoleKey ? input.idpByRoleKey.get(alias.identityRoleKey) : undefined);

  return {
    externalRoleName,
    alias,
    matchingIdentityRole,
  };
};

const describeMatchedIdentityRole = (input: {
  role: ManagedRoleRow;
  externalRoleName: string;
  alias: RoleReconcileAlias | undefined;
  matchingIdentityRole: IdentityRole;
}) => {
  const expectedDisplayName = getRoleDisplayName(input.role);
  const identityDisplayName = readRoleAttribute(input.matchingIdentityRole.attributes, 'display_name');
  const identityRoleKey = readRoleAttribute(input.matchingIdentityRole.attributes, 'role_key');
  const canonicalExternalRoleName = input.matchingIdentityRole.externalName ?? input.externalRoleName;
  const matchedByAlias =
    Boolean(input.alias) &&
    identityRoleKey === input.alias?.identityRoleKey &&
    (input.matchingIdentityRole.externalName === input.alias?.externalRoleName ||
      input.matchingIdentityRole.externalName === canonicalExternalRoleName) &&
    input.alias?.identityRoleKey !== input.role.role_key;
  const aliasSatisfiedByCanonicalRole = matchedByAlias && identityRoleKey === input.alias?.identityRoleKey;
  const reportedExternalRoleName = matchedByAlias ? canonicalExternalRoleName : input.externalRoleName;

  return {
    expectedDisplayName,
    identityDisplayName,
    identityRoleKey,
    canonicalExternalRoleName,
    matchedByAlias,
    aliasSatisfiedByCanonicalRole,
    reportedExternalRoleName,
  };
};

const markMatchedIdentityRole = (
  matchedIdentityExternalNames: Set<string>,
  matchedIdentityRoleKeys: Set<string>,
  identityRole: IdentityRole
) => {
  matchedIdentityExternalNames.add(identityRole.externalName);
  const identityRoleKey = readRoleAttribute(identityRole.attributes, 'role_key');
  if (identityRoleKey) {
    matchedIdentityRoleKeys.add(identityRoleKey);
  }
};

const persistSuccessfulReconcile = async (input: {
  deps: RoleCatalogReconciliationDeps;
  instanceId: string;
  role: ManagedRoleRow;
  actorAccountId?: string;
  requestId?: string;
  traceId?: string;
  externalRoleName: string;
  operation: RoleReconcileOperation;
}) =>
  persistRoleReconcileState({
    deps: input.deps,
    instanceId: input.instanceId,
    roleId: input.role.id,
    actorAccountId: input.actorAccountId,
    requestId: input.requestId,
    traceId: input.traceId,
    roleKey: input.role.role_key,
    externalRoleName: input.externalRoleName,
    operation: input.operation,
    result: 'success',
    syncState: 'synced',
    syncedAt: true,
  });

const persistFailedReconcile = async (input: {
  deps: RoleCatalogReconciliationDeps;
  instanceId: string;
  role: ManagedRoleRow;
  actorAccountId?: string;
  requestId?: string;
  traceId?: string;
  externalRoleName: string;
  operation: RoleReconcileOperation;
  errorCode: string;
}) =>
  persistRoleReconcileState({
    deps: input.deps,
    instanceId: input.instanceId,
    roleId: input.role.id,
    actorAccountId: input.actorAccountId,
    requestId: input.requestId,
    traceId: input.traceId,
    roleKey: input.role.role_key,
    externalRoleName: input.externalRoleName,
    operation: input.operation,
    result: 'failure',
    errorCode: input.errorCode,
    syncState: 'failed',
  });

const appendDatabaseRoleResult = (
  entries: ReconcileRoleEntry[],
  input: {
    readonly role: ManagedRoleRow;
    readonly externalRoleName: string;
    readonly action: ReconcileRoleEntry['action'];
    readonly status: ReconcileRoleEntry['status'];
    readonly errorCode?: string;
  }
) =>
  appendReconcileEntry(entries, {
    roleId: input.role.id,
    roleKey: input.role.role_key,
    externalRoleName: input.externalRoleName,
    action: input.action,
    status: input.status,
    ...(input.errorCode ? { errorCode: input.errorCode } : {}),
  });

const createMissingIdentityRole = async (input: {
  deps: RoleCatalogReconciliationDeps;
  identityProvider: { provider: IdentityProviderPort };
  role: ManagedRoleRow;
  instanceId: string;
  actorAccountId?: string;
  requestId?: string;
  traceId?: string;
  entries: ReconcileRoleEntry[];
  externalRoleName: string;
}) => {
  const expectedDisplayName = getRoleDisplayName(input.role);

  try {
    await input.deps.trackKeycloakCall('reconcile_create_role', () =>
      input.identityProvider.provider.createRole({
        externalName: input.externalRoleName,
        description: input.role.description ?? undefined,
        attributes: {
          managedBy: 'studio',
          instanceId: input.instanceId,
          roleKey: input.role.role_key,
          displayName: expectedDisplayName,
        },
      })
    );
    await persistSuccessfulReconcile({
      deps: input.deps,
      instanceId: input.instanceId,
      role: input.role,
      actorAccountId: input.actorAccountId,
      requestId: input.requestId,
      traceId: input.traceId,
      externalRoleName: input.externalRoleName,
      operation: 'reconcile_create',
    });
    appendDatabaseRoleResult(input.entries, {
      role: input.role,
      externalRoleName: input.externalRoleName,
      action: 'create',
      status: 'corrected',
    });
  } catch (error) {
    const errorCode = mapRoleSyncErrorCode(error);
    await persistFailedReconcile({
      deps: input.deps,
      instanceId: input.instanceId,
      role: input.role,
      actorAccountId: input.actorAccountId,
      requestId: input.requestId,
      traceId: input.traceId,
      externalRoleName: input.externalRoleName,
      operation: 'reconcile_create',
      errorCode,
    });
    appendDatabaseRoleResult(input.entries, {
      role: input.role,
      externalRoleName: input.externalRoleName,
      action: 'create',
      status: 'failed',
      errorCode,
    });
  }
};

const updateMatchedIdentityRole = async (input: {
  deps: RoleCatalogReconciliationDeps;
  identityProvider: { provider: IdentityProviderPort };
  role: ManagedRoleRow;
  instanceId: string;
  actorAccountId?: string;
  requestId?: string;
  traceId?: string;
  entries: ReconcileRoleEntry[];
  expectedDisplayName: string;
  canonicalExternalRoleName: string;
  reportedExternalRoleName: string;
  shouldUpdateIdentityRole: boolean;
}) => {
  try {
    if (input.shouldUpdateIdentityRole) {
      await input.deps.trackKeycloakCall('reconcile_update_role', () =>
        input.identityProvider.provider.updateRole(input.canonicalExternalRoleName, {
          description: input.role.description ?? undefined,
          attributes: {
            managedBy: 'studio',
            instanceId: input.instanceId,
            roleKey: input.role.role_key,
            displayName: input.expectedDisplayName,
          },
        })
      );
    }

    await persistSuccessfulReconcile({
      deps: input.deps,
      instanceId: input.instanceId,
      role: input.role,
      actorAccountId: input.actorAccountId,
      requestId: input.requestId,
      traceId: input.traceId,
      externalRoleName: input.reportedExternalRoleName,
      operation: 'reconcile_update',
    });
    appendDatabaseRoleResult(input.entries, {
      role: input.role,
      externalRoleName: input.reportedExternalRoleName,
      action: input.shouldUpdateIdentityRole ? 'update' : 'noop',
      status: 'corrected',
    });
  } catch (error) {
    const errorCode = mapRoleSyncErrorCode(error);
    await persistFailedReconcile({
      deps: input.deps,
      instanceId: input.instanceId,
      role: input.role,
      actorAccountId: input.actorAccountId,
      requestId: input.requestId,
      traceId: input.traceId,
      externalRoleName: input.reportedExternalRoleName,
      operation: 'reconcile_update',
      errorCode,
    });
    appendDatabaseRoleResult(input.entries, {
      role: input.role,
      externalRoleName: input.reportedExternalRoleName,
      action: input.shouldUpdateIdentityRole ? 'update' : 'noop',
      status: 'failed',
      errorCode,
    });
  }
};

const shouldSkipManagedIdentityRole = (input: {
  identityRole: IdentityRole;
  dbByExternalName: ReadonlyMap<string, ManagedRoleRow>;
  dbByRoleKey: ReadonlyMap<string, ManagedRoleRow>;
  matchedIdentityExternalNames: Set<string>;
  matchedIdentityRoleKeys: Set<string>;
}): boolean => {
  const identityRoleKey = readRoleAttribute(input.identityRole.attributes, 'role_key');
  return (
    input.matchedIdentityExternalNames.has(input.identityRole.externalName) ||
    Boolean(identityRoleKey && input.matchedIdentityRoleKeys.has(identityRoleKey)) ||
    input.dbByExternalName.has(input.identityRole.externalName) ||
    Boolean(identityRoleKey && input.dbByRoleKey.has(identityRoleKey))
  );
};

const appendManualActionEntry = (entries: ReconcileRoleEntry[], identityRole: IdentityRole) => {
  appendReconcileEntry(entries, {
    externalRoleName: identityRole.externalName,
    roleKey: readRoleAttribute(identityRole.attributes, 'role_key'),
    action: 'report',
    status: 'requires_manual_action',
    errorCode: 'REQUIRES_MANUAL_ACTION',
  });
};

const appendImportedRoleEntry = (
  entries: ReconcileRoleEntry[],
  importedRole: { roleId: string },
  importableMetadata: { roleKey: string },
  identityRole: IdentityRole
) => {
  appendReconcileEntry(entries, {
    roleId: importedRole.roleId,
    roleKey: importableMetadata.roleKey,
    externalRoleName: identityRole.externalName,
    action: 'create',
    status: 'corrected',
  });
};

const appendFailedImportedRoleEntry = (
  entries: ReconcileRoleEntry[],
  importableMetadata: { roleKey: string },
  identityRole: IdentityRole,
  error: unknown
) => {
  appendReconcileEntry(entries, {
    roleKey: importableMetadata.roleKey,
    externalRoleName: identityRole.externalName,
    action: 'create',
    status: 'failed',
    errorCode: mapRoleSyncErrorCode(error),
  });
};

const persistRoleReconcileState = async (input: {
  deps: RoleCatalogReconciliationDeps;
  instanceId: string;
  roleId: string;
  actorAccountId?: string;
  requestId?: string;
  traceId?: string;
  roleKey: string;
  externalRoleName: string;
  operation: RoleReconcileOperation;
  result: RoleReconcileResult;
  errorCode?: string | null;
  syncState: 'synced' | 'failed';
  syncedAt?: true;
}) => {
  const { deps } = input;
  await deps.withInstanceScopedDb(input.instanceId, async (client) => {
    await deps.setRoleSyncState(client, {
      instanceId: input.instanceId,
      roleId: input.roleId,
      syncState: input.syncState,
      errorCode: input.errorCode ?? null,
      ...(input.syncedAt ? { syncedAt: true } : {}),
    });
    await deps.emitRoleAuditEvent(client, {
      instanceId: input.instanceId,
      accountId: input.actorAccountId,
      roleId: input.roleId,
      eventType: 'role.reconciled',
      operation: input.operation,
      result: input.result,
      roleKey: input.roleKey,
      externalRoleName: input.externalRoleName,
      ...(input.errorCode ? { errorCode: input.errorCode } : {}),
      requestId: input.requestId,
      traceId: input.traceId,
    });
  });
};

const reconcileDatabaseRoles = async (input: {
  deps: RoleCatalogReconciliationDeps;
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
  const { deps } = input;
  for (const role of input.dbRoles) {
    const { externalRoleName, alias, matchingIdentityRole } = resolveMatchingIdentityRole({
      role,
      idpByExternalName: input.idpByExternalName,
      idpByRoleKey: input.idpByRoleKey,
    });

    if (!matchingIdentityRole) {
      await createMissingIdentityRole({
        deps,
        identityProvider: input.identityProvider,
        role,
        instanceId: input.instanceId,
        actorAccountId: input.actorAccountId,
        requestId: input.requestId,
        traceId: input.traceId,
        entries: input.entries,
        externalRoleName,
      });
      continue;
    }

    markMatchedIdentityRole(input.matchedIdentityExternalNames, input.matchedIdentityRoleKeys, matchingIdentityRole);

    const {
      expectedDisplayName,
      identityDisplayName,
      identityRoleKey,
      canonicalExternalRoleName,
      aliasSatisfiedByCanonicalRole,
      reportedExternalRoleName,
    } = describeMatchedIdentityRole({
      role,
      externalRoleName,
      alias,
      matchingIdentityRole,
    });
    const descriptionChanged = (matchingIdentityRole.description ?? undefined) !== (role.description ?? undefined);
    const displayNameChanged = identityDisplayName !== expectedDisplayName;
    const roleKeyChanged = !isAcceptedIdentityRoleKey(role.role_key, identityRoleKey);
    const shouldUpdateIdentityRole =
      !aliasSatisfiedByCanonicalRole && (descriptionChanged || displayNameChanged || roleKeyChanged);
    const shouldResyncDbState = role.sync_state !== 'synced';

    if (shouldUpdateIdentityRole || shouldResyncDbState) {
      await updateMatchedIdentityRole({
        deps,
        identityProvider: input.identityProvider,
        role,
        instanceId: input.instanceId,
        actorAccountId: input.actorAccountId,
        requestId: input.requestId,
        traceId: input.traceId,
        entries: input.entries,
        expectedDisplayName,
        canonicalExternalRoleName,
        reportedExternalRoleName,
        shouldUpdateIdentityRole,
      });
      continue;
    }

    appendDatabaseRoleResult(input.entries, {
      role,
      externalRoleName: reportedExternalRoleName,
      action: 'noop',
      status: 'synced',
    });
  }
};

const reconcileManagedIdentityRoles = async (input: {
  deps: RoleCatalogReconciliationDeps;
  managedIdpRoles: readonly IdentityRole[];
  dbByExternalName: ReadonlyMap<string, ManagedRoleRow>;
  dbByRoleKey: ReadonlyMap<string, ManagedRoleRow>;
  matchedIdentityExternalNames: Set<string>;
  matchedIdentityRoleKeys: Set<string>;
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
  const { deps } = input;
  for (const identityRole of input.managedIdpRoles) {
    if (
      shouldSkipManagedIdentityRole({
        identityRole,
        dbByExternalName: input.dbByExternalName,
        dbByRoleKey: input.dbByRoleKey,
        matchedIdentityExternalNames: input.matchedIdentityExternalNames,
        matchedIdentityRoleKeys: input.matchedIdentityRoleKeys,
      })
    ) {
      continue;
    }

    const importableMetadata = readImportableRoleMetadata(identityRole);
    if (!importableMetadata) {
      appendManualActionEntry(input.entries, identityRole);
      continue;
    }

    let importDbContext: RoleImportDbContext | undefined;
    try {
      const importedRole = await deps.withInstanceScopedDb(input.instanceId, async (client) => {
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

        await deps.emitRoleAuditEvent(client, {
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
      input.matchedIdentityExternalNames.add(identityRole.externalName);
      input.matchedIdentityRoleKeys.add(importableMetadata.roleKey);
      appendImportedRoleEntry(input.entries, importedRole, importableMetadata, identityRole);
    } catch (error) {
      input.importFailures.push({
        roleKey: importableMetadata.roleKey,
        externalRoleName: identityRole.externalName,
        errorName: error instanceof Error ? error.name : 'Error',
        errorMessage: sanitizeRoleErrorMessage(error),
        dbContext: importDbContext,
      });
      appendFailedImportedRoleEntry(input.entries, importableMetadata, identityRole, error);
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

    appendReconcileEntry(input.entries, {
      externalRoleName: identityRole.externalName,
      roleKey: readRoleAttribute(identityRole.attributes, 'role_key') ?? identityRole.externalName,
      action: 'report',
      status: 'requires_manual_action',
      errorCode: 'REQUIRES_MANUAL_ACTION',
    });
  }
};

export const runRoleCatalogReconciliation = async (input: {
  deps: RoleCatalogReconciliationDeps;
  instanceId: string;
  actorAccountId?: string;
  requestId?: string;
  traceId?: string;
  includeDiagnostics?: boolean;
}): Promise<ReconcileReport> => {
  const deps = input.deps;
  const identityProvider = await deps.resolveIdentityProviderForInstance(input.instanceId);
  if (!identityProvider) {
    throw new Error('identity_provider_unavailable');
  }

  const dbRoles = await deps.withInstanceScopedDb(input.instanceId, async (client) => {
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

  const listedIdpRoles = await deps.trackKeycloakCall('reconcile_list_roles', () => identityProvider.provider.listRoles());
  const idpRoles = await hydrateRoleDetailsForReconciliation(deps, identityProvider, listedIdpRoles);
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
    deps,
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
    deps,
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
    outcome:
      entries.some((entry) => entry.status === 'failed' || entry.status === 'requires_manual_action')
        ? entries.some((entry) => entry.status === 'corrected' || entry.status === 'synced')
          ? 'partial_failure'
          : 'failed'
        : 'success',
    checkedCount: entries.length,
    correctedCount: entries.filter((entry) => entry.status === 'corrected').length,
    failedCount: entries.filter((entry) => entry.status === 'failed').length,
    manualReviewCount: entries.filter((entry) => entry.status === 'requires_manual_action').length,
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

  deps.setRoleDriftBacklog(input.instanceId, report.failedCount + report.requiresManualActionCount);
  return report;
};
