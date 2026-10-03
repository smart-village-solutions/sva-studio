import type { IdentityProviderPort } from './identity-provider-port.js';
import { getRoleDisplayName } from './role-audit.js';
import { mapRoleSyncErrorCode } from './role-audit.js';
import type { ManagedRoleRow } from './types.js';
import type {
  IdentityRole,
  ReconcileRoleEntry,
  RoleCatalogReconciliationDeps,
} from './reconcile-types.js';
import {
  resolveMatchingIdentityRole,
  markMatchedIdentityRole,
  describeMatchedIdentityRole,
  isAcceptedIdentityRoleKey,
} from './reconcile-identity.js';
import { persistSuccessfulReconcile, persistFailedReconcile } from './reconcile-persistence.js';
import { appendDatabaseRoleResult } from './reconcile-report.js';

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

export const reconcileDatabaseRoles = async (input: {
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

    markMatchedIdentityRole(
      input.matchedIdentityExternalNames,
      input.matchedIdentityRoleKeys,
      matchingIdentityRole
    );

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
    const descriptionChanged =
      (matchingIdentityRole.description ?? undefined) !== (role.description ?? undefined);
    const displayNameChanged = identityDisplayName !== expectedDisplayName;
    const roleKeyChanged = !isAcceptedIdentityRoleKey(role.role_key, identityRoleKey);
    const shouldUpdateIdentityRole =
      !aliasSatisfiedByCanonicalRole &&
      (descriptionChanged || displayNameChanged || roleKeyChanged);
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
