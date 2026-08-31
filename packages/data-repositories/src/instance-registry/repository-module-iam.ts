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
import { compareAlphabetically, queryRows, statement } from './repository-shared.js';

type ModuleIamRepository = Pick<
  InstanceRegistryRepository,
  | 'assignModule'
  | 'getModuleActivationPolicy'
  | 'reconcileModuleActivationPolicies'
  | 'persistPluginTenantLifecycleReconcileIntents'
  | 'restoreModuleActivation'
  | 'revokeModule'
  | 'syncAssignedModuleIam'
  | 'syncProtectedSystemRolePermissions'
>;

type LifecycleIntentRow = { plugin_id: string };

const persistPluginTenantLifecycleReconcileIntentSql = `
WITH active_module AS MATERIALIZED (
  SELECT module_id
  FROM iam.instance_modules
  WHERE instance_id = $1 AND module_id = $2 AND effective_active
  FOR UPDATE
),
intent AS (
  INSERT INTO iam.instance_plugin_lifecycle (
    instance_id, plugin_id, desired_operation, desired_generation, readiness_status,
    contract_revision, next_recheck_at, retry_kind, retry_after,
    recovery_error_code, updated_at
  )
  SELECT $1, $2, 'provision', 1, 'pending', $3, now(), NULL, NULL, NULL, now()
  FROM active_module
  ON CONFLICT (instance_id, plugin_id) DO UPDATE
  SET desired_operation = 'reconcile',
    desired_generation = iam.instance_plugin_lifecycle.desired_generation + 1,
    readiness_status = 'pending', readiness_revision = NULL,
    contract_revision = EXCLUDED.contract_revision,
    next_recheck_at = now(), retry_kind = NULL, retry_after = NULL,
    recovery_error_code = NULL, updated_at = now()
  WHERE iam.instance_plugin_lifecycle.active_job_id IS NULL
    AND ($4::boolean
      OR iam.instance_plugin_lifecycle.contract_revision IS DISTINCT FROM EXCLUDED.contract_revision)
  RETURNING plugin_id
),
enqueued AS (
  SELECT graphile_worker.sva_enqueue_job(
    identifier => 'plugin_tenant_lifecycle_retry',
    payload => json_build_object('instanceId', $1::text, 'pluginId', $2::text),
    queue_name => 'plugin-tenant-lifecycle', max_attempts => 5,
    job_key => 'plugin-tenant-lifecycle-activation:' || $1::text || ':' || $2::text,
    run_at => now()
  )
  FROM intent
)
SELECT intent.plugin_id
FROM intent
CROSS JOIN enqueued;
`;

const createPersistPluginTenantLifecycleReconcileIntents =
  (
    executor: SqlExecutor
  ): InstanceRegistryRepository['persistPluginTenantLifecycleReconcileIntents'] =>
  async ({ instanceId, lifecycles, forcePluginIds }) => {
    const forced = new Set(forcePluginIds);
    const persisted: string[] = [];
    for (const lifecycle of [...lifecycles].sort((left, right) =>
      compareAlphabetically(left.pluginId, right.pluginId)
    )) {
      const rows = await queryRows<LifecycleIntentRow>(
        executor,
        statement(persistPluginTenantLifecycleReconcileIntentSql, [
          instanceId,
          lifecycle.pluginId,
          lifecycle.contractRevision,
          forced.has(lifecycle.pluginId),
        ])
      );
      if (rows[0]) persisted.push(rows[0].plugin_id);
    }
    return persisted;
  };

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
    const allManagedModuleIds = [
      ...new Set([...managedModuleIds, ...managedContracts.map((contract) => contract.moduleId)]),
    ].sort(compareAlphabetically);
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
      allManagedModuleIds,
      rolePermissionPairs
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
  persistPluginTenantLifecycleReconcileIntents:
    createPersistPluginTenantLifecycleReconcileIntents(executor),
  syncAssignedModuleIam: createSyncAssignedModuleIam(executor),
  syncProtectedSystemRolePermissions: createSyncProtectedSystemRolePermissions(executor),
});
