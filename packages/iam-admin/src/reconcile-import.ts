import { readString } from './input-readers.js';
import { sanitizeRoleErrorMessage } from './role-audit.js';
import type { ManagedRoleRow } from './types.js';
import type {
  IdentityRole,
  ReconcileRoleEntry,
  RoleCatalogReconciliationDeps,
  RoleImportDbContext,
} from './reconcile-types.js';
import {
  readImportableRoleMetadata,
  readRoleAttribute,
  shouldSkipManagedIdentityRole,
  isTechnicalIdentityRole,
} from './reconcile-identity.js';
import {
  appendReconcileEntry,
  appendImportedRoleEntry,
  appendFailedImportedRoleEntry,
} from './reconcile-report.js';

const appendManualActionEntry = (entries: ReconcileRoleEntry[], identityRole: IdentityRole) => {
  appendReconcileEntry(entries, {
    externalRoleName: identityRole.externalName,
    roleKey: readRoleAttribute(identityRole.attributes, 'role_key'),
    action: 'report',
    status: 'requires_manual_action',
    errorCode: 'REQUIRES_MANUAL_ACTION',
  });
};

const persistImportedIdentityRole = async (input: {
  deps: RoleCatalogReconciliationDeps;
  identityRole: IdentityRole;
  importableMetadata: { roleKey: string; displayName: string; roleLevel: number };
  instanceId: string;
  actorAccountId?: string;
  requestId?: string;
  traceId?: string;
  includeDiagnostics?: boolean;
  onDbContext(context: RoleImportDbContext | undefined): void;
}) => {
  const { deps, identityRole, importableMetadata } = input;
  return deps.withInstanceScopedDb(input.instanceId, async (client) => {
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
      input.onDbContext(
        dbContextRow
          ? {
              currentUser: readString(dbContextRow.current_user ?? undefined),
              sessionUser: readString(dbContextRow.session_user ?? undefined),
              currentRole: readString(dbContextRow.current_role ?? undefined),
              appInstanceId: readString(dbContextRow.app_instance_id ?? undefined),
            }
          : undefined
      );
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
};

export const reconcileManagedIdentityRoles = async (input: {
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
    if (!isTechnicalIdentityRole(identityRole)) {
      appendManualActionEntry(input.entries, identityRole);
      continue;
    }

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
      const importedRole = await persistImportedIdentityRole({
        deps,
        identityRole,
        importableMetadata,
        instanceId: input.instanceId,
        actorAccountId: input.actorAccountId,
        requestId: input.requestId,
        traceId: input.traceId,
        includeDiagnostics: input.includeDiagnostics,
        onDbContext: (context) => {
          importDbContext = context;
        },
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
