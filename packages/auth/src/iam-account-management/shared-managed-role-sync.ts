import { getRoleExternalName, mapRoleSyncErrorCode } from './role-audit.js';
import { emitRoleAuditEvent, setRoleSyncState } from './shared-activity.js';
import { trackKeycloakCall } from './shared-observability.js';
import { withInstanceScopedDb, type IdentityProviderResolution } from './shared-runtime.js';
import { buildRoleAttributes } from './roles-handlers.shared.js';
import type { ManagedRoleRow } from './types.js';

type ManagedRoleSyncRow = ManagedRoleRow & {
  readonly id: string;
  readonly role_key: string;
  readonly display_name?: string | null;
};

const loadManagedRolesByExternalNames = async (
  instanceId: string,
  externalRoleNames: readonly string[]
): Promise<readonly ManagedRoleSyncRow[]> => {
  if (externalRoleNames.length === 0) {
    return [];
  }

  return withInstanceScopedDb(instanceId, async (client) => {
    const result = await client.query<ManagedRoleSyncRow>(
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
  AND COALESCE(external_role_name, role_key) = ANY($2::text[]);
`,
      [instanceId, [...new Set(externalRoleNames)]]
    );

    return result.rows;
  });
};

const markManagedRoleSyncResult = async (input: {
  instanceId: string;
  roleId: string;
  roleKey: string;
  externalRoleName: string;
  actorAccountId?: string;
  requestId?: string;
  traceId?: string;
  result: 'success' | 'failure';
  syncState: 'synced' | 'failed';
  errorCode?: string;
}) =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    await setRoleSyncState(client, {
      instanceId: input.instanceId,
      roleId: input.roleId,
      syncState: input.syncState,
      errorCode: input.errorCode ?? null,
      syncedAt: input.result === 'success',
    });
    await emitRoleAuditEvent(client, {
      instanceId: input.instanceId,
      accountId: input.actorAccountId,
      roleId: input.roleId,
      eventType: input.result === 'success' ? 'role.sync_succeeded' : 'role.sync_failed',
      operation: 'ensure_exists',
      result: input.result,
      roleKey: input.roleKey,
      externalRoleName: input.externalRoleName,
      errorCode: input.errorCode,
      requestId: input.requestId,
      traceId: input.traceId,
    });
  });

export const ensureManagedRealmRolesExist = async (input: {
  instanceId: string;
  identityProvider: IdentityProviderResolution;
  externalRoleNames: readonly string[];
  actorAccountId?: string;
  requestId?: string;
  traceId?: string;
}): Promise<void> => {
  const managedRoles = await loadManagedRolesByExternalNames(input.instanceId, input.externalRoleNames);

  for (const role of managedRoles) {
    const externalRoleName = getRoleExternalName(role);
    const existingRole = await trackKeycloakCall('ensure_role_exists_get', () =>
      input.identityProvider.provider.getRoleByName(externalRoleName)
    );
    if (existingRole) {
      continue;
    }

    try {
      await trackKeycloakCall('ensure_role_exists_create', () =>
        input.identityProvider.provider.createRole({
          externalName: externalRoleName,
          description: role.description ?? undefined,
          attributes: buildRoleAttributes({
            instanceId: input.instanceId,
            roleKey: role.role_key,
            displayName: role.display_name?.trim() || role.role_key,
          }),
        })
      );
      await markManagedRoleSyncResult({
        instanceId: input.instanceId,
        roleId: role.id,
        roleKey: role.role_key,
        externalRoleName,
        actorAccountId: input.actorAccountId,
        requestId: input.requestId,
        traceId: input.traceId,
        result: 'success',
        syncState: 'synced',
      });
    } catch (error) {
      await markManagedRoleSyncResult({
        instanceId: input.instanceId,
        roleId: role.id,
        roleKey: role.role_key,
        externalRoleName,
        actorAccountId: input.actorAccountId,
        requestId: input.requestId,
        traceId: input.traceId,
        result: 'failure',
        syncState: 'failed',
        errorCode: mapRoleSyncErrorCode(error),
      });
      throw error;
    }
  }
};
