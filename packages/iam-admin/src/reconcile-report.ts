import { getRoleExternalName, mapRoleSyncErrorCode } from './role-audit.js';
import type { ManagedRoleRow } from './types.js';
import type { IdentityRole, ReconcileReport, ReconcileRoleEntry } from './reconcile-types.js';
import { isPotentialStudioManagedRealmRole, readRoleAttribute } from './reconcile-identity.js';

export const buildReconcileDebugReport = (input: {
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
  const listedByExternalName = new Map(
    input.listedIdpRoles.map((role) => [role.externalName, role])
  );
  const hydratedByExternalName = new Map(
    input.hydratedIdpRoles.map((role) => [role.externalName, role])
  );
  const managedByExternalName = new Map(
    input.managedIdpRoles.map((role) => [role.externalName, role])
  );
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
        listedRoleHasAttributes: Boolean(
          listedRole?.attributes && Object.keys(listedRole.attributes).length > 0
        ),
        hydratedRoleFound: Boolean(hydratedRole),
        hydratedManagedBy: readRoleAttribute(hydratedRole?.attributes, 'managed_by'),
        hydratedInstanceId: readRoleAttribute(hydratedRole?.attributes, 'instance_id'),
        hydratedRoleKey: readRoleAttribute(hydratedRole?.attributes, 'role_key'),
        hydratedDisplayName: readRoleAttribute(hydratedRole?.attributes, 'display_name'),
      };
    }),
  } satisfies NonNullable<ReconcileReport['debug']>;
};

export const appendReconcileEntry = (
  entries: ReconcileRoleEntry[],
  entry: ReconcileRoleEntry
): void => {
  entries.push(entry);
};

export const appendDatabaseRoleResult = (
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

export const appendImportedRoleEntry = (
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

export const appendFailedImportedRoleEntry = (
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

export const reportRemainingPotentialStudioRoles = (input: {
  idpRoles: readonly IdentityRole[];
  idpByExternalName: ReadonlyMap<string, IdentityRole>;
  dbByExternalName: ReadonlyMap<string, ManagedRoleRow>;
  entries: ReconcileRoleEntry[];
}) => {
  const reportedExternalNames = new Set(input.entries.map((entry) => entry.externalRoleName));

  for (const identityRole of input.idpRoles) {
    if (input.idpByExternalName.has(identityRole.externalName)) {
      continue;
    }

    if (reportedExternalNames.has(identityRole.externalName)) {
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

export const buildReconcileReport = (input: {
  entries: ReconcileRoleEntry[];
  instanceId: string;
  includeDiagnostics?: boolean;
  dbRoles: readonly ManagedRoleRow[];
  listedIdpRoles: readonly IdentityRole[];
  hydratedIdpRoles: readonly IdentityRole[];
  managedIdpRoles: readonly IdentityRole[];
  importFailures: NonNullable<NonNullable<ReconcileReport['debug']>['importFailures']>;
}): ReconcileReport => ({
  outcome: input.entries.some(
    (entry) => entry.status === 'failed' || entry.status === 'requires_manual_action'
  )
    ? input.entries.some((entry) => entry.status === 'corrected' || entry.status === 'synced')
      ? 'partial_failure'
      : 'failed'
    : 'success',
  checkedCount: input.entries.length,
  correctedCount: input.entries.filter((entry) => entry.status === 'corrected').length,
  failedCount: input.entries.filter((entry) => entry.status === 'failed').length,
  manualReviewCount: input.entries.filter((entry) => entry.status === 'requires_manual_action')
    .length,
  requiresManualActionCount: input.entries.filter(
    (entry) => entry.status === 'requires_manual_action'
  ).length,
  roles: input.entries,
  ...(input.includeDiagnostics
    ? {
        debug: buildReconcileDebugReport({
          instanceId: input.instanceId,
          dbRoles: input.dbRoles,
          listedIdpRoles: input.listedIdpRoles,
          hydratedIdpRoles: input.hydratedIdpRoles,
          managedIdpRoles: input.managedIdpRoles,
          importFailures: input.importFailures,
        }),
      }
    : {}),
});
