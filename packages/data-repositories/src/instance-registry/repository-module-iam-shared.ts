import type { SqlExecutor } from '../iam/repositories/types.js';

import type {
  InstanceModuleIamContractRecord,
  ProtectedSystemRolePermissionBundleRecord,
} from './repository-contract.js';
import { compareAlphabetically, createTextList, quoteSqlLiteral, statement } from './repository-shared.js';

export type RolePermissionPair = {
  moduleId: string;
  roleName: string;
  permissionId: string;
};

export const buildManagedPermissionKeys = (contracts: readonly InstanceModuleIamContractRecord[]): readonly string[] =>
  Array.from(new Set(contracts.flatMap((contract) => contract.permissionIds))).sort(compareAlphabetically);

export const buildRolePermissionPairs = (
  contracts: readonly InstanceModuleIamContractRecord[]
): readonly RolePermissionPair[] =>
  contracts.flatMap((contract) =>
    (contract.systemRoles ?? contract.tenantBootstrapRoles ?? []).flatMap((role) =>
      role.permissionIds.map((permissionId) => ({
        moduleId: contract.moduleId,
        roleName: role.roleName,
        permissionId,
      }))
    )
  );

export const upsertPermission = async (
  executor: SqlExecutor,
  instanceId: string,
  permissionKey: string,
  description: string
): Promise<void> => {
  await executor.execute(
    statement(
      `
INSERT INTO iam.permissions (
  id, instance_id, permission_key, action, resource_type, resource_id, effect, scope, description
)
VALUES (gen_random_uuid(), $1, $2, $2, split_part($2, '.', 1), NULL, 'allow', '{}'::jsonb, $3)
ON CONFLICT (instance_id, permission_key) DO UPDATE
SET
  action = EXCLUDED.action,
  resource_type = EXCLUDED.resource_type,
  resource_id = EXCLUDED.resource_id,
  effect = EXCLUDED.effect,
  scope = EXCLUDED.scope,
  description = EXCLUDED.description,
  updated_at = NOW();
`,
      [instanceId, permissionKey, description]
    )
  );
};

export const insertModuleRolePermission = async (
  executor: SqlExecutor,
  instanceId: string,
  pair: RolePermissionPair
): Promise<void> => {
  await executor.execute(
    statement(
      `
INSERT INTO iam.role_permissions (instance_id, role_id, permission_id, grant_origin_kind, grant_origin_module_id)
SELECT $1, role.id, permission.id, $4, $5
FROM iam.roles role
JOIN iam.permissions permission
  ON permission.instance_id = role.instance_id
WHERE role.instance_id = $1
  AND role.role_key = $2
  AND permission.permission_key = $3
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;
`,
      [instanceId, pair.roleName, pair.permissionId, 'module_sync', pair.moduleId]
    )
  );
};

export const cleanupModuleRolePermissions = async (
  executor: SqlExecutor,
  instanceId: string,
  managedModuleIds: readonly string[],
  rolePermissionPairs: readonly RolePermissionPair[]
): Promise<void> => {
  if (managedModuleIds.length === 0) {
    return;
  }
  const desiredPairSql =
    rolePermissionPairs.length > 0
      ? rolePermissionPairs
          .map((pair) => `(${quoteSqlLiteral(pair.moduleId)}, ${quoteSqlLiteral(pair.roleName)}, ${quoteSqlLiteral(pair.permissionId)})`)
          .join(', ')
      : null;
  await executor.execute(
    statement(
      `
DELETE FROM iam.role_permissions role_permission
USING iam.roles role, iam.permissions permission
WHERE role_permission.instance_id = $1
  AND role.instance_id = role_permission.instance_id
  AND role.id = role_permission.role_id
  AND permission.instance_id = role_permission.instance_id
  AND permission.id = role_permission.permission_id
  AND role_permission.grant_origin_kind = 'module_sync'
  AND role_permission.grant_origin_module_id IN (${createTextList(managedModuleIds)})
  ${desiredPairSql ? `AND (role_permission.grant_origin_module_id, role.role_key, permission.permission_key) NOT IN (${desiredPairSql})` : ''};
`,
      [instanceId]
    )
  );
};

export const cleanupModulePermissions = async (
  executor: SqlExecutor,
  instanceId: string,
  managedModuleIds: readonly string[],
  permissionKeys: readonly string[]
): Promise<void> => {
  if (managedModuleIds.length === 0) {
    return;
  }
  const managedPrefixConditions = managedModuleIds
    .map((moduleId) => `permission_key LIKE ${quoteSqlLiteral(`${moduleId}.%`)}`)
    .join(' OR ');
  const desiredPermissionFilter =
    permissionKeys.length > 0 ? `AND permission_key NOT IN (${createTextList(permissionKeys)})` : '';
  await executor.execute(
    statement(
      `
DELETE FROM iam.permissions
WHERE instance_id = $1
  ${desiredPermissionFilter}
  AND (${managedPrefixConditions});
`,
      [instanceId]
    )
  );
};

export const upsertProtectedRole = async (
  executor: SqlExecutor,
  instanceId: string,
  role: ProtectedSystemRolePermissionBundleRecord
): Promise<void> => {
  await executor.execute(
    statement(
      `
INSERT INTO iam.roles (
  id, instance_id, role_key, role_name, display_name, external_role_name, description,
  is_system_role, role_level, managed_by, sync_state, last_synced_at, last_error_code
)
VALUES (gen_random_uuid(), $1, $2, $2, $3, $2, $4, TRUE, $5, 'studio', 'pending', NOW(), NULL)
ON CONFLICT (instance_id, role_key) DO UPDATE
SET
  role_name = EXCLUDED.role_name,
  display_name = EXCLUDED.display_name,
  external_role_name = EXCLUDED.external_role_name,
  description = EXCLUDED.description,
  is_system_role = TRUE,
  role_level = EXCLUDED.role_level,
  updated_at = NOW();
`,
      [instanceId, role.roleKey, role.displayName, `Geschützte Systemrolle ${role.displayName}`, role.roleLevel]
    )
  );
};

export const cleanupProtectedRolePermissions = async (
  executor: SqlExecutor,
  instanceId: string,
  roleKey: string,
  permissionKeys: readonly string[]
): Promise<void> => {
  await executor.execute(
    statement(
      `
DELETE FROM iam.role_permissions role_permission
WHERE role_permission.instance_id = $1
  AND role_permission.role_id = (
    SELECT id FROM iam.roles WHERE instance_id = $1 AND role_key = $2 LIMIT 1
  )
  AND role_permission.grant_origin_kind = 'bootstrap'
  AND role_permission.grant_origin_module_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM iam.permissions permission
    WHERE permission.instance_id = role_permission.instance_id
      AND permission.id = role_permission.permission_id
      AND permission.permission_key = ANY($3::text[])
  );
`,
      [instanceId, roleKey, permissionKeys]
    )
  );
};

export const insertProtectedRolePermission = async (
  executor: SqlExecutor,
  instanceId: string,
  roleKey: string,
  permissionKey: string
): Promise<void> => {
  await executor.execute(
    statement(
      `
INSERT INTO iam.role_permissions (instance_id, role_id, permission_id, grant_origin_kind, grant_origin_module_id)
SELECT $1, iam_role.id, permission.id, 'bootstrap', NULL
FROM iam.roles iam_role
JOIN iam.permissions permission
  ON permission.instance_id = iam_role.instance_id
WHERE iam_role.instance_id = $1
  AND iam_role.role_key = $2
  AND permission.permission_key = $3
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;
`,
      [instanceId, roleKey, permissionKey]
    )
  );
};
