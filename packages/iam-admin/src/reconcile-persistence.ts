import type {
  RoleCatalogReconciliationDeps,
  RoleReconcileOperation,
  RoleReconcileResult,
} from './reconcile-types.js';
import type { ManagedRoleRow } from './types.js';

export const persistSuccessfulReconcile = async (input: {
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

export const persistFailedReconcile = async (input: {
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
