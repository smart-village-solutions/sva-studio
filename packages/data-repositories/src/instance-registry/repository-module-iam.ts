import type { SqlExecutor } from '../iam/repositories/types.js';

import type {
  InstanceRegistryRepository,
  PermissionCatalogReconcileResult,
} from './repository-contract.js';
import {
  buildManagedPermissions,
  buildRolePermissionPairs,
  cleanupModuleRolePermissions,
  insertModuleRolePermission,
  insertProtectedRolePermission,
  upsertPermission,
  upsertProtectedRole,
} from './repository-module-iam-shared.js';
import { compareAlphabetically, statement } from './repository-shared.js';

type ModuleIamRepository = Pick<
  InstanceRegistryRepository,
  'assignModule' | 'revokeModule' | 'syncAssignedModuleIam' | 'syncProtectedSystemRolePermissions'
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

const inTransaction = async <T>(executor: SqlExecutor, work: () => Promise<T>): Promise<T> => {
  await executor.execute(statement('BEGIN;', []));
  try {
    const result = await work();
    await executor.execute(statement('COMMIT;', []));
    return result;
  } catch (error) {
    await executor.execute(statement('ROLLBACK;', []));
    throw error;
  }
};

export const createModuleIamRepository = (executor: SqlExecutor): ModuleIamRepository => ({
  async assignModule(instanceId, moduleId) {
    const result = await executor.execute(
      statement(
        `
INSERT INTO iam.instance_modules (instance_id, module_id)
VALUES ($1, $2)
ON CONFLICT (instance_id, module_id) DO NOTHING;
`,
        [instanceId, moduleId]
      )
    );
    return result.rowCount > 0;
  },

  async revokeModule(instanceId, moduleId) {
    const result = await executor.execute(
      statement(
        `
DELETE FROM iam.instance_modules
WHERE instance_id = $1
  AND module_id = $2;
`,
        [instanceId, moduleId]
      )
    );
    return result.rowCount > 0;
  },

  async syncAssignedModuleIam({ instanceId, managedModuleIds, contracts }) {
    const permissions = buildManagedPermissions(contracts);
    const rolePermissionPairs = buildRolePermissionPairs(contracts);
    if (permissions.length === 0 && rolePermissionPairs.length === 0 && managedModuleIds.length === 0) {
      return emptyReconcileResult();
    }
    return inTransaction(executor, async () => {
      let reconcileResult = emptyReconcileResult();
      for (const permission of permissions) {
        reconcileResult = recordPermissionOutcome(
          reconcileResult,
          await upsertPermission(executor, instanceId, permission)
        );
      }
      for (const pair of rolePermissionPairs) {
        const inserted = await insertModuleRolePermission(executor, instanceId, pair);
        reconcileResult = {
          ...reconcileResult,
          grantsInserted: reconcileResult.grantsInserted + (inserted ? 1 : 0),
          grantsUnchanged: reconcileResult.grantsUnchanged + (inserted ? 0 : 1),
        };
      }
      await cleanupModuleRolePermissions(executor, instanceId, managedModuleIds, rolePermissionPairs);
      return reconcileResult;
    });
  },

  async syncProtectedSystemRolePermissions({ instanceId, role }) {
    const permissions = [...new Map(role.permissions.map((permission) => [permission.key, permission])).values()].sort(
      (left, right) => compareAlphabetically(left.key, right.key)
    );
    return inTransaction(executor, async () => {
      let reconcileResult = emptyReconcileResult();
      for (const permission of permissions) {
        reconcileResult = recordPermissionOutcome(
          reconcileResult,
          await upsertPermission(executor, instanceId, permission)
        );
      }
      await upsertProtectedRole(executor, instanceId, role);
      for (const permission of permissions) {
        const inserted = await insertProtectedRolePermission(executor, instanceId, role.roleKey, permission.key);
        reconcileResult = {
          ...reconcileResult,
          grantsInserted: reconcileResult.grantsInserted + (inserted ? 1 : 0),
          grantsUnchanged: reconcileResult.grantsUnchanged + (inserted ? 0 : 1),
        };
      }
      return reconcileResult;
    });
  },
});
