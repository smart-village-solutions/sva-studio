import type { IamRolePermissionAssignmentScope } from '@sva/iam-core';
import { tenantCorePermissionCatalog } from '@sva/core';
import { getManagedPermissionMetadata, isRootOnlyPermissionKey } from './managed-permissions.js';
import type { QueryClient } from './query-client.js';
import type {
  RoleMutationPersistenceActor,
  RoleMutationPersistenceDeps,
} from './role-mutation-persistence.js';

export type RolePermissionAssignmentInput = {
  readonly permissionId: string;
  readonly accessScope?: IamRolePermissionAssignmentScope;
};

export type StoredRolePermissionAssignment = {
  readonly permissionId: string;
  readonly accessScope: IamRolePermissionAssignmentScope;
};

const tenantCorePermissionKeys = new Set(tenantCorePermissionCatalog.map(({ key }) => key));

export class UnavailableRolePermissionError extends Error {
  constructor() {
    super('tenant_permission_unavailable');
  }
}

export const normalizeRolePermissionAssignments = (
  permissionIds: readonly string[] | undefined,
  permissionAssignments: readonly RolePermissionAssignmentInput[] | undefined
): readonly StoredRolePermissionAssignment[] => {
  if (permissionAssignments && permissionAssignments.length > 0) {
    return permissionAssignments.map((assignment) => ({
      permissionId: assignment.permissionId,
      accessScope: assignment.accessScope ?? 'all',
    }));
  }

  return (permissionIds ?? []).map((permissionId) => ({
    permissionId,
    accessScope: 'all',
  }));
};

const hasDuplicatePermissionIds = (
  assignments: readonly StoredRolePermissionAssignment[]
): boolean => {
  const uniquePermissionIds = new Set(assignments.map((assignment) => assignment.permissionId));
  return uniquePermissionIds.size !== assignments.length;
};

const loadPermissionKeysById = async (
  client: QueryClient,
  instanceId: string,
  permissionIds: readonly string[]
): Promise<ReadonlyMap<string, string>> => {
  if (permissionIds.length === 0) {
    return new Map();
  }

  const result = await client.query<{ id: string; permission_key: string }>(
    `
SELECT id::text AS id, permission_key
FROM iam.permissions
WHERE instance_id = $1
  AND id = ANY($2::uuid[]);
`,
    [instanceId, permissionIds]
  );

  return new Map(result.rows.map((row) => [row.id, row.permission_key] as const));
};

const hasUnavailableModulePermission = async (
  client: QueryClient,
  instanceId: string,
  permissionKeys: readonly string[]
): Promise<boolean> => {
  const moduleIds = [
    ...new Set(
      permissionKeys
        .filter((key) => !tenantCorePermissionKeys.has(key))
        .map((key) => key.split('.')[0] ?? '')
    ),
  ];
  if (moduleIds.length === 0) return false;

  // The row lock keeps a concurrent module revocation behind the role write.
  const result = await client.query<{ module_id: string }>(
    `SELECT module_id FROM iam.instance_modules
WHERE instance_id = $1 AND module_id = ANY($2::text[]) AND effective_active = true
FOR SHARE;`,
    [instanceId, moduleIds]
  );
  const activeModules = new Set(result.rows.map((row) => row.module_id));
  return moduleIds.some((moduleId) => !activeModules.has(moduleId));
};

const normalizeStoredAccessScope = (
  accessScope: IamRolePermissionAssignmentScope,
  permissionKey: string | undefined
): IamRolePermissionAssignmentScope => {
  const metadata = permissionKey ? getManagedPermissionMetadata(permissionKey) : undefined;
  if (!metadata?.isScopeAssignable) {
    return 'all';
  }

  const supportedAccessScopes = metadata.supportedAccessScopes ?? ['all'];
  return supportedAccessScopes.includes(accessScope) ? accessScope : 'all';
};

export const normalizeAssignmentsForPersistence = async (
  client: QueryClient,
  instanceId: string,
  assignments: readonly StoredRolePermissionAssignment[]
): Promise<readonly StoredRolePermissionAssignment[]> => {
  const permissionKeyById = await loadPermissionKeysById(
    client,
    instanceId,
    assignments.map((assignment) => assignment.permissionId)
  );

  if (
    permissionKeyById.size !== assignments.length ||
    [...permissionKeyById.values()].some(isRootOnlyPermissionKey) ||
    (await hasUnavailableModulePermission(client, instanceId, [...permissionKeyById.values()]))
  ) {
    throw new UnavailableRolePermissionError();
  }

  return assignments.map((assignment) => ({
    permissionId: assignment.permissionId,
    accessScope: normalizeStoredAccessScope(
      assignment.accessScope,
      permissionKeyById.get(assignment.permissionId)
    ),
  }));
};

export const insertRolePermissionAssignments = async (
  client: QueryClient,
  instanceId: string,
  roleId: string,
  assignments: readonly StoredRolePermissionAssignment[]
): Promise<void> => {
  if (assignments.length === 0) return;

  await client.query(
    `
INSERT INTO iam.role_permissions (instance_id, role_id, permission_id, access_scope)
SELECT $1, $2::uuid, permission_id, access_scope
FROM unnest($3::uuid[], $4::text[]) AS permission_assignment(permission_id, access_scope)
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;
`,
    [
      instanceId,
      roleId,
      assignments.map((assignment) => assignment.permissionId),
      assignments.map((assignment) => assignment.accessScope),
    ]
  );
};

export const validateRequestedPermissions =
  (deps: Pick<RoleMutationPersistenceDeps, 'withInstanceScopedDb' | 'createApiError'>) =>
  async (input: {
    readonly actor: RoleMutationPersistenceActor;
    readonly permissionIds?: readonly string[];
    readonly permissionAssignments?: readonly RolePermissionAssignmentInput[];
  }): Promise<Response | null> =>
    deps.withInstanceScopedDb(input.actor.instanceId, async (client) => {
      const assignments = normalizeRolePermissionAssignments(
        input.permissionIds,
        input.permissionAssignments
      );
      if (assignments.length === 0) {
        return null;
      }

      if (hasDuplicatePermissionIds(assignments)) {
        return deps.createApiError(
          400,
          'invalid_request',
          'Berechtigungen dürfen im Payload nicht doppelt vorkommen.',
          input.actor.requestId
        );
      }

      const permissionKeyById = await loadPermissionKeysById(
        client,
        input.actor.instanceId,
        assignments.map((assignment) => assignment.permissionId)
      );

      const hasUnknownPermission = assignments.some(
        (assignment) => !permissionKeyById.has(assignment.permissionId)
      );
      if (hasUnknownPermission) {
        return deps.createApiError(
          400,
          'invalid_request',
          'Mindestens eine Berechtigung existiert im Tenant nicht.',
          input.actor.requestId
        );
      }

      const hasRootOnlyPermission = assignments.some((assignment) =>
        isRootOnlyPermissionKey(permissionKeyById.get(assignment.permissionId) ?? '')
      );
      if (hasRootOnlyPermission) {
        return deps.createApiError(
          400,
          'invalid_request',
          'Mindestens eine Berechtigung ist im Tenant nicht verwaltbar.',
          input.actor.requestId
        );
      }

      if (
        await hasUnavailableModulePermission(client, input.actor.instanceId, [
          ...permissionKeyById.values(),
        ])
      ) {
        return deps.createApiError(
          400,
          'invalid_request',
          'Mindestens eine Berechtigung ist im Tenant nicht verwaltbar.',
          input.actor.requestId
        );
      }

      return null;
    });
