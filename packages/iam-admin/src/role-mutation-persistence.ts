import type { IamRoleListItem } from '@sva/core';
import type { ManagedRoleRow } from './types.js';
import { persistCreatedRole } from './role-mutation-create.js';
import { createRoleDeletePersistence } from './role-mutation-delete.js';
import {
  markRoleSyncState,
  persistUpdatedRole,
  resolveMutableRole,
} from './role-mutation-update.js';
import { validateRequestedPermissions } from './role-mutation-permissions.js';
import type { RolePermissionAssignmentInput } from './role-mutation-permissions.js';
import type { QueryClient } from './query-client.js';

export { UnavailableRolePermissionError } from './role-mutation-permissions.js';

export type RoleMutationPersistenceActor = {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

export type MutableRole = ManagedRoleRow & {
  readonly is_system_role: boolean;
  readonly managed_by: string;
  readonly role_level: number;
  readonly role_key: string;
  readonly description: string | null;
};

type RoleAuditEventInput = {
  readonly instanceId: string;
  readonly accountId?: string;
  readonly roleId: string;
  readonly eventType: 'role.sync_started' | 'role.sync_failed' | 'role.sync_succeeded';
  readonly operation: 'create' | 'update' | 'retry' | 'delete';
  readonly result: 'success' | 'failure';
  readonly roleKey: string;
  readonly externalRoleName: string;
  readonly errorCode?: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

type RoleActivityLogInput = {
  readonly instanceId: string;
  readonly accountId?: string;
  readonly eventType: 'role.created' | 'role.updated' | 'role.deleted';
  readonly result: 'success';
  readonly payload: Readonly<Record<string, unknown>>;
  readonly requestId?: string;
  readonly traceId?: string;
};

export type RoleMutationPersistenceDeps = {
  readonly createApiError: (
    status: number,
    code: 'conflict' | 'invalid_request' | 'not_found',
    message: string,
    requestId?: string
  ) => Response;
  readonly emitActivityLog: (client: QueryClient, input: RoleActivityLogInput) => Promise<void>;
  readonly emitRoleAuditEvent: (client: QueryClient, input: RoleAuditEventInput) => Promise<void>;
  readonly notifyPermissionInvalidation: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly trigger: 'role_created' | 'role_updated' | 'role_deleted';
    }
  ) => Promise<void>;
  readonly setRoleSyncState: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly roleId: string;
      readonly syncState: 'pending' | 'failed' | 'synced';
      readonly errorCode: string | null;
      readonly syncedAt?: boolean;
    }
  ) => Promise<void>;
  readonly withInstanceScopedDb: <T>(
    instanceId: string,
    work: (client: QueryClient) => Promise<T>
  ) => Promise<T>;
};

export type RoleMutationPersistence = {
  readonly deleteRoleFromDatabase: (input: {
    readonly actor: RoleMutationPersistenceActor;
    readonly roleId: string;
    readonly roleKey: string;
    readonly externalRoleName: string;
  }) => Promise<void>;
  readonly listDirectRoleAssignmentSubjects: (input: {
    readonly instanceId: string;
    readonly roleId: string;
  }) => Promise<readonly string[]>;
  readonly markDeleteRoleSyncState: (input: {
    readonly actor: RoleMutationPersistenceActor;
    readonly roleId: string;
    readonly roleKey: string;
    readonly externalRoleName: string;
    readonly result: 'success' | 'failure';
    readonly eventType: 'role.sync_started' | 'role.sync_failed' | 'role.sync_succeeded';
    readonly errorCode?: string;
    readonly syncState?: 'pending' | 'failed';
  }) => Promise<void>;
  readonly markRoleSyncState: (input: {
    readonly actor: RoleMutationPersistenceActor;
    readonly roleId: string;
    readonly operation: 'update' | 'retry';
    readonly result: 'success' | 'failure';
    readonly roleKey: string;
    readonly externalRoleName: string;
    readonly errorCode?: string;
    readonly syncState: 'pending' | 'failed' | 'synced';
    readonly syncedAt?: boolean;
  }) => Promise<void>;
  readonly persistCreatedRole: (input: {
    readonly actor: RoleMutationPersistenceActor;
    readonly roleKey: string;
    readonly generateUniqueRoleKey?: boolean;
    readonly displayName: string;
    readonly externalRoleName: string;
    readonly description?: string;
    readonly roleLevel: number;
    readonly permissionIds: readonly string[];
    readonly permissionAssignments?: readonly RolePermissionAssignmentInput[];
  }) => Promise<IamRoleListItem>;
  readonly persistUpdatedRole: (input: {
    readonly actor: RoleMutationPersistenceActor;
    readonly roleId: string;
    readonly existing: MutableRole;
    readonly displayName: string;
    readonly description?: string;
    readonly roleLevel: number;
    readonly externalRoleName: string;
    readonly permissionIds?: readonly string[];
    readonly permissionAssignments?: readonly RolePermissionAssignmentInput[];
    readonly operation: 'update' | 'retry';
  }) => Promise<IamRoleListItem>;
  readonly resolveDeletableRole: (
    actor: RoleMutationPersistenceActor,
    roleId: string
  ) => Promise<MutableRole | Response>;
  readonly resolveMutableRole: (
    actor: RoleMutationPersistenceActor,
    roleId: string
  ) => Promise<MutableRole | Response>;
  readonly validateRequestedPermissions: (input: {
    readonly actor: RoleMutationPersistenceActor;
    readonly permissionIds?: readonly string[];
    readonly permissionAssignments?: readonly RolePermissionAssignmentInput[];
  }) => Promise<Response | null>;
};

export const createRoleMutationPersistence = (
  deps: RoleMutationPersistenceDeps
): RoleMutationPersistence => {
  return {
    ...createRoleDeletePersistence(deps),
    markRoleSyncState: markRoleSyncState(deps),
    persistCreatedRole: persistCreatedRole(deps),
    persistUpdatedRole: persistUpdatedRole(deps),
    resolveMutableRole: resolveMutableRole(deps),
    validateRequestedPermissions: validateRequestedPermissions(deps),
  };
};
