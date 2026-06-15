import type { SqlExecutor } from '../iam/repositories/types.js';

import type {
  InstanceRegistryRepository,
} from './repository-contract.js';
import {
  buildManagedPermissionKeys,
  buildRolePermissionPairs,
  cleanupModulePermissions,
  cleanupModuleRolePermissions,
  cleanupProtectedRolePermissions,
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
    const permissionKeys = buildManagedPermissionKeys(contracts);
    const rolePermissionPairs = buildRolePermissionPairs(contracts);
    for (const permissionKey of permissionKeys) {
      await upsertPermission(executor, instanceId, permissionKey, `Modulberechtigung ${permissionKey}`);
    }
    for (const pair of rolePermissionPairs) {
      await insertModuleRolePermission(executor, instanceId, pair);
    }
    await cleanupModuleRolePermissions(executor, instanceId, managedModuleIds, rolePermissionPairs);
    await cleanupModulePermissions(executor, instanceId, managedModuleIds, permissionKeys);
  },

  async syncProtectedSystemRolePermissions({ instanceId, role }) {
    const permissionKeys = Array.from(new Set(role.permissionKeys)).sort(compareAlphabetically);
    for (const permissionKey of permissionKeys) {
      await upsertPermission(
        executor,
        instanceId,
        permissionKey,
        `Geschützte Systemrolle ${role.roleKey}: ${permissionKey}`
      );
    }
    await upsertProtectedRole(executor, instanceId, role);
    await cleanupProtectedRolePermissions(executor, instanceId, role.roleKey, permissionKeys);
    for (const permissionKey of permissionKeys) {
      await insertProtectedRolePermission(executor, instanceId, role.roleKey, permissionKey);
    }
  },
});
