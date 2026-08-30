import type { SqlExecutor } from '../iam/repositories/types.js';
import type {
  InstanceRegistryRepository,
  PermissionCatalogReconcileResult,
} from './repository-contract.js';
import { createModuleActivationRepository } from './repository-module-activation.js';
import {
  buildManagedPermissions,
  buildRolePermissionPairs,
  cleanupModuleRolePermissions,
  insertModuleRolePermission,
  insertProtectedRolePermission,
  upsertPermission,
  upsertProtectedRole,
} from './repository-module-iam-shared.js';
import { compareAlphabetically } from './repository-shared.js';

type ModuleIamRepository = Pick<
  InstanceRegistryRepository,
  | 'assignModule'
  | 'getModuleActivationPolicy'
  | 'reconcileModuleActivationPolicies'
  | 'revokeModule'
  | 'syncAssignedModuleIam'
  | 'syncProtectedSystemRolePermissions'
>;

const emptyReconcileResult = (): PermissionCatalogReconcileResult => ({
  permissionsInserted: 0,
  permissionsUpdated: 0,
  permissionsUnchanged: 0,
  grantsInserted: 0,
  grantsUnchanged: 0,
});

const recordPermissionOutcome = (
  result: PermissionCatalogReconcileResult,
  outcome: 'inserted' | 'updated' | 'unchanged'
): PermissionCatalogReconcileResult => ({
  ...result,
  permissionsInserted: result.permissionsInserted + (outcome === 'inserted' ? 1 : 0),
  permissionsUpdated: result.permissionsUpdated + (outcome === 'updated' ? 1 : 0),
  permissionsUnchanged: result.permissionsUnchanged + (outcome === 'unchanged' ? 1 : 0),
});

const recordGrantOutcome = (
  result: PermissionCatalogReconcileResult,
  inserted: boolean
): PermissionCatalogReconcileResult => ({
  ...result,
  grantsInserted: result.grantsInserted + (inserted ? 1 : 0),
  grantsUnchanged: result.grantsUnchanged + (inserted ? 0 : 1),
});

const createSyncAssignedModuleIam =
  (executor: SqlExecutor): InstanceRegistryRepository['syncAssignedModuleIam'] =>
  async (input) => {
    const { instanceId, managedModuleIds, managedContracts = [], contracts } = input;
    const permissions = buildManagedPermissions(contracts);
    const rolePermissionPairs = buildRolePermissionPairs(contracts);
    if (
      permissions.length === 0 &&
      rolePermissionPairs.length === 0 &&
      managedModuleIds.length === 0 &&
      managedContracts.length === 0
    )
      return emptyReconcileResult();
    let result = emptyReconcileResult();
    for (const permission of permissions) {
      result = recordPermissionOutcome(
        result,
        await upsertPermission(executor, instanceId, permission)
      );
    }
    for (const pair of rolePermissionPairs) {
      result = recordGrantOutcome(
        result,
        await insertModuleRolePermission(executor, instanceId, pair)
      );
    }
    await cleanupModuleRolePermissions(
      executor,
      instanceId,
      managedModuleIds,
      contracts.map((contract) => contract.moduleId)
    );
    return result;
  };

const createSyncProtectedSystemRolePermissions =
  (executor: SqlExecutor): InstanceRegistryRepository['syncProtectedSystemRolePermissions'] =>
  async ({ instanceId, role }) => {
    const permissions = [
      ...new Map(role.permissions.map((permission) => [permission.key, permission])).values(),
    ].sort((left, right) => compareAlphabetically(left.key, right.key));
    let result = emptyReconcileResult();
    for (const permission of permissions) {
      result = recordPermissionOutcome(
        result,
        await upsertPermission(executor, instanceId, permission)
      );
    }
    await upsertProtectedRole(executor, instanceId, role);
    for (const permissionKey of [...new Set(role.grantPermissionKeys)].sort(
      compareAlphabetically
    )) {
      result = recordGrantOutcome(
        result,
        await insertProtectedRolePermission(executor, instanceId, role.roleKey, permissionKey)
      );
    }
    return result;
  };

export const createModuleIamRepository = (executor: SqlExecutor): ModuleIamRepository => ({
  ...createModuleActivationRepository(executor),
  syncAssignedModuleIam: createSyncAssignedModuleIam(executor),
  syncProtectedSystemRolePermissions: createSyncProtectedSystemRolePermissions(executor),
});
