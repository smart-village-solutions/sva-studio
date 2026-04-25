import type { IdentityProviderPort, IdentityManagedRoleAttributes } from './identity-provider-port.js';
import { getRoleExternalName, mapRoleSyncErrorCode } from './role-audit.js';
import type { QueryClient } from './query-client.js';
import type { ManagedRoleRow } from './types.js';

export type ManagedRoleSyncRow = ManagedRoleRow & {
  readonly id: string;
  readonly role_key: string;
  readonly display_name?: string | null;
};

type RoleAuditEventInput = {
  readonly instanceId: string;
  readonly accountId?: string;
  readonly roleId: string;
  readonly eventType: 'role.sync_succeeded' | 'role.sync_failed';
  readonly operation: 'ensure_exists';
  readonly result: 'success' | 'failure';
  readonly roleKey: string;
  readonly externalRoleName: string;
  readonly errorCode?: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

export type ManagedRoleSyncDeps = {
  readonly buildRoleAttributes: (input: {
    readonly instanceId: string;
    readonly roleKey: string;
    readonly displayName: string;
  }) => IdentityManagedRoleAttributes;
  readonly emitRoleAuditEvent: (client: QueryClient, input: RoleAuditEventInput) => Promise<void>;
  readonly setRoleSyncState: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly roleId: string;
      readonly syncState: 'synced' | 'failed';
      readonly errorCode: string | null;
      readonly syncedAt?: boolean;
    }
  ) => Promise<void>;
  readonly trackKeycloakCall: <T>(operation: string, execute: () => Promise<T>) => Promise<T>;
  readonly withInstanceScopedDb: <T>(
    instanceId: string,
    work: (client: QueryClient) => Promise<T>
  ) => Promise<T>;
};

export type ManagedRoleIdentityProviderResolution = {
  readonly provider: Pick<IdentityProviderPort, 'getRoleByName' | 'createRole'>;
};

export const createManagedRoleSync = (deps: ManagedRoleSyncDeps) => {
  const loadManagedRolesByExternalNames = async (
    instanceId: string,
    externalRoleNames: readonly string[]
  ): Promise<readonly ManagedRoleSyncRow[]> => {
    if (externalRoleNames.length === 0) {
      return [];
    }

    return deps.withInstanceScopedDb(instanceId, async (client) => {
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
    readonly instanceId: string;
    readonly roleId: string;
    readonly roleKey: string;
    readonly externalRoleName: string;
    readonly actorAccountId?: string;
    readonly requestId?: string;
    readonly traceId?: string;
    readonly result: 'success' | 'failure';
    readonly syncState: 'synced' | 'failed';
    readonly errorCode?: string;
  }) =>
    deps.withInstanceScopedDb(input.instanceId, async (client) => {
      await deps.setRoleSyncState(client, {
        instanceId: input.instanceId,
        roleId: input.roleId,
        syncState: input.syncState,
        errorCode: input.errorCode ?? null,
        syncedAt: input.result === 'success',
      });
      await deps.emitRoleAuditEvent(client, {
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

  const ensureManagedRealmRolesExist = async (input: {
    readonly instanceId: string;
    readonly identityProvider: ManagedRoleIdentityProviderResolution;
    readonly externalRoleNames: readonly string[];
    readonly actorAccountId?: string;
    readonly requestId?: string;
    readonly traceId?: string;
  }): Promise<void> => {
    const managedRoles = await loadManagedRolesByExternalNames(input.instanceId, input.externalRoleNames);

    for (const role of managedRoles) {
      const externalRoleName = getRoleExternalName(role);
      const existingRole = await deps.trackKeycloakCall('ensure_role_exists_get', () =>
        input.identityProvider.provider.getRoleByName(externalRoleName)
      );
      if (existingRole) {
        continue;
      }

      try {
        await deps.trackKeycloakCall('ensure_role_exists_create', () =>
          input.identityProvider.provider.createRole({
            externalName: externalRoleName,
            description: role.description ?? undefined,
            attributes: deps.buildRoleAttributes({
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

  return {
    ensureManagedRealmRolesExist,
    loadManagedRolesByExternalNames,
  };
};
