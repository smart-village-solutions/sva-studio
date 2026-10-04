import { createHash } from 'node:crypto';

import { isTenantManageableRole } from './role-governance.js';
import type { ManagedRoleRow } from './types.js';
import type { RoleCatalogReconciliationDeps } from './reconcile-types.js';

export const fingerprintRoleCatalog = (roles: readonly ManagedRoleRow[]): string =>
  createHash('sha256')
    .update(
      JSON.stringify(
        roles.map((role) => ({
          id: role.id,
          roleKey: role.role_key,
          roleName: role.role_name,
          displayName: role.display_name,
          externalRoleName: role.external_role_name,
          description: role.description,
          isSystemRole: role.is_system_role,
          roleLevel: role.role_level,
          managedBy: role.managed_by,
        }))
      )
    )
    .digest('hex');

export const loadManagedRoleCatalog = async (
  deps: RoleCatalogReconciliationDeps,
  instanceId: string
): Promise<readonly ManagedRoleRow[]> =>
  deps.withInstanceScopedDb(instanceId, async (client) => {
    const result = await client.query<ManagedRoleRow>(
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
ORDER BY role_level DESC, COALESCE(display_name, role_name) ASC, id ASC;
`,
      [instanceId]
    );
    return result.rows.filter((role) => isTenantManageableRole(role));
  });

export const readRoleCatalogFingerprint = async (input: {
  deps: RoleCatalogReconciliationDeps;
  instanceId: string;
}): Promise<string> =>
  fingerprintRoleCatalog(await loadManagedRoleCatalog(input.deps, input.instanceId));
