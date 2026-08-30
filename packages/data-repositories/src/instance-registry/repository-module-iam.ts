import type { SqlExecutor } from '../iam/repositories/types.js';

import type {
  InstanceRegistryRepository,
  PermissionCatalogReconcileResult,
} from './repository-contract.js';
import {
  buildManagedPermissions,
  buildRolePermissionPairs,
  cleanupInactiveModulePermissions,
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

const createSyncAssignedModuleIam =
  (executor: SqlExecutor): InstanceRegistryRepository['syncAssignedModuleIam'] =>
  async ({ instanceId, managedModuleIds, managedContracts = [], contracts }) => {
    const permissions = buildManagedPermissions(contracts);
    const rolePermissionPairs = buildRolePermissionPairs(contracts);
    if (
      permissions.length === 0 &&
      rolePermissionPairs.length === 0 &&
      managedModuleIds.length === 0 &&
      managedContracts.length === 0
    ) {
      return emptyReconcileResult();
    }
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
    await cleanupModuleRolePermissions(
      executor,
      instanceId,
      managedModuleIds,
      contracts.map((contract) => contract.moduleId)
    );
    await cleanupInactiveModulePermissions(executor, instanceId, managedContracts, contracts);
    return reconcileResult;
  };

const createSyncProtectedSystemRolePermissions =
  (executor: SqlExecutor): InstanceRegistryRepository['syncProtectedSystemRolePermissions'] =>
  async ({ instanceId, role }) => {
    const permissions = [
      ...new Map(role.permissions.map((permission) => [permission.key, permission])).values(),
    ].sort((left, right) => compareAlphabetically(left.key, right.key));
    let reconcileResult = emptyReconcileResult();
    for (const permission of permissions) {
      reconcileResult = recordPermissionOutcome(
        reconcileResult,
        await upsertPermission(executor, instanceId, permission)
      );
    }
    await upsertProtectedRole(executor, instanceId, role);
    for (const permissionKey of [...new Set(role.grantPermissionKeys)].sort(
      compareAlphabetically
    )) {
      const inserted = await insertProtectedRolePermission(
        executor,
        instanceId,
        role.roleKey,
        permissionKey
      );
      reconcileResult = {
        ...reconcileResult,
        grantsInserted: reconcileResult.grantsInserted + (inserted ? 1 : 0),
        grantsUnchanged: reconcileResult.grantsUnchanged + (inserted ? 0 : 1),
      };
    }
    return reconcileResult;
  };

export const createModuleIamRepository = (executor: SqlExecutor): ModuleIamRepository => ({
  async getModuleActivationPolicy(instanceId, moduleId) {
    const rows = await queryRows<{
      activation_policy: 'optional' | 'automatic' | 'required';
      effective_active: boolean;
      state_revision: number | string;
    }>(
      executor,
      statement(
        `
SELECT activation_policy, effective_active, state_revision
FROM iam.instance_modules
WHERE instance_id = $1
  AND module_id = $2
LIMIT 1;
`,
        [instanceId, moduleId]
      )
    );
    const row = rows[0];
    if (!row) {
      return null;
    }
    return {
      activationPolicy: row.activation_policy,
      effectiveActive: row.effective_active,
      stateRevision:
        typeof row.state_revision === 'string'
          ? Number.parseInt(row.state_revision, 10)
          : row.state_revision,
    };
  },

  async assignModule(instanceId, moduleId) {
    const rows = await queryRows<{ acquired: boolean; changed: boolean }>(
      executor,
      statement(
        `
WITH module_lock AS (
  SELECT pg_try_advisory_xact_lock(
    hashtextextended(json_build_array($1::text, $2::text)::text, 0)
  ) AS acquired
),
mutation AS (
INSERT INTO iam.instance_modules (
  instance_id,
  module_id,
  activation_origin,
  effective_active,
  manual_override
)
SELECT $1, $2, 'manual', true, 'enabled'
FROM module_lock
WHERE acquired
ON CONFLICT (instance_id, module_id) DO UPDATE
SET
  activation_origin = 'manual',
  effective_active = true,
  manual_override = 'enabled',
  state_revision = iam.instance_modules.state_revision + 1,
  reconcile_id = NULL,
  reconciled_at = NULL,
  updated_at = now()
WHERE iam.instance_modules.activation_policy <> 'required'
  AND (
    NOT iam.instance_modules.effective_active
    OR iam.instance_modules.manual_override IS DISTINCT FROM 'enabled'
  )
RETURNING 1
)
SELECT
  acquired,
  EXISTS (SELECT 1 FROM mutation) AS changed
FROM module_lock;
`,
        [instanceId, moduleId]
      )
    );
    return rows[0]?.acquired === true && rows[0].changed;
  },

  async revokeModule(instanceId, moduleId) {
    const rows = await queryRows<{ acquired: boolean; changed: boolean }>(
      executor,
      statement(
        `
WITH module_lock AS (
  SELECT pg_try_advisory_xact_lock(
    hashtextextended(json_build_array($1::text, $2::text)::text, 0)
  ) AS acquired
),
mutation AS (
UPDATE iam.instance_modules
SET
  activation_origin = 'manual',
  effective_active = false,
  manual_override = 'disabled',
  state_revision = state_revision + 1,
  reconcile_id = NULL,
  reconciled_at = NULL,
  updated_at = now()
WHERE instance_id = $1
  AND module_id = $2
  AND activation_policy <> 'required'
  AND effective_active
  AND (SELECT acquired FROM module_lock)
RETURNING 1
)
SELECT
  acquired,
  EXISTS (SELECT 1 FROM mutation) AS changed
FROM module_lock;
`,
        [instanceId, moduleId]
      )
    );
    return rows[0]?.acquired === true && rows[0].changed;
  },

  async reconcileModuleActivationPolicies({ instanceId, policies, reconcileId, actorId }) {
    const changedModuleIds: string[] = [];
    const conflictModuleIds: string[] = [];
    const unchangedModuleIds: string[] = [];
    const orderedPolicies = [...policies].sort((left, right) =>
      compareAlphabetically(left.moduleId, right.moduleId)
    );

    for (const policy of orderedPolicies) {
      const rows = await queryRows<{ acquired: boolean; changed: boolean }>(
        executor,
        statement(
          `
WITH module_lock AS (
  SELECT pg_try_advisory_xact_lock(
    hashtextextended(json_build_array($1::text, $2::text)::text, 0)
  ) AS acquired
),
mutation AS (
INSERT INTO iam.instance_modules (
  instance_id,
  module_id,
  activation_policy,
  activation_origin,
  effective_active,
  manual_override,
  manifest_version,
  policy_revision,
  state_revision,
  reconcile_id,
  reconciled_at,
  updated_at,
  updated_by
)
SELECT
  $1,
  $2,
  $3,
  'policy_reconcile',
  $3 IN ('automatic', 'required'),
  NULL,
  $4,
  $5,
  1,
  $6,
  now(),
  now(),
  $7
FROM module_lock
WHERE acquired
ON CONFLICT (instance_id, module_id) DO UPDATE
SET
  activation_policy = EXCLUDED.activation_policy,
  activation_origin = 'policy_reconcile',
  effective_active = CASE
    WHEN EXCLUDED.activation_policy = 'required' THEN true
    WHEN iam.instance_modules.manual_override = 'enabled' THEN true
    WHEN iam.instance_modules.manual_override = 'disabled' THEN false
    ELSE EXCLUDED.activation_policy = 'automatic'
  END,
  manual_override = CASE
    WHEN EXCLUDED.activation_policy = 'required' THEN NULL
    ELSE iam.instance_modules.manual_override
  END,
  manifest_version = EXCLUDED.manifest_version,
  policy_revision = EXCLUDED.policy_revision,
  state_revision = iam.instance_modules.state_revision + 1,
  reconcile_id = EXCLUDED.reconcile_id,
  reconciled_at = EXCLUDED.reconciled_at,
  updated_at = EXCLUDED.updated_at,
  updated_by = EXCLUDED.updated_by
WHERE iam.instance_modules.activation_policy IS DISTINCT FROM EXCLUDED.activation_policy
  OR iam.instance_modules.effective_active IS DISTINCT FROM CASE
    WHEN EXCLUDED.activation_policy = 'required' THEN true
    WHEN iam.instance_modules.manual_override = 'enabled' THEN true
    WHEN iam.instance_modules.manual_override = 'disabled' THEN false
    ELSE EXCLUDED.activation_policy = 'automatic'
  END
  OR (
    EXCLUDED.activation_policy = 'required'
    AND iam.instance_modules.manual_override IS NOT NULL
  )
  OR iam.instance_modules.manifest_version IS DISTINCT FROM EXCLUDED.manifest_version
  OR iam.instance_modules.policy_revision IS DISTINCT FROM EXCLUDED.policy_revision
RETURNING 1
)
SELECT
  acquired,
  EXISTS (SELECT 1 FROM mutation) AS changed
FROM module_lock;
`,
          [
            instanceId,
            policy.moduleId,
            policy.activationPolicy,
            policy.manifestVersion,
            policy.policyRevision,
            reconcileId,
            actorId ?? null,
          ]
        )
      );
      const outcome = rows[0];
      if (!outcome?.acquired) {
        conflictModuleIds.push(policy.moduleId);
      } else {
        (outcome.changed ? changedModuleIds : unchangedModuleIds).push(policy.moduleId);
      }
    }

    return { changedModuleIds, conflictModuleIds, unchangedModuleIds };
  },

  syncAssignedModuleIam: createSyncAssignedModuleIam(executor),
  syncProtectedSystemRolePermissions: createSyncProtectedSystemRolePermissions(executor),
});
