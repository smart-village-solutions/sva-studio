import type { IamRoleListItem, IamRoleSyncState } from '@sva/core';

import type { QueryClient } from '../shared/db-helpers.js';

import { mapRoleListItem } from './role-audit.js';
import type { ManagedBy, ManagedRoleRow } from './types.js';

type RoleListItemRow = {
  id: string;
  role_key: string;
  role_name: string;
  display_name: string | null;
  external_role_name: string | null;
  managed_by: ManagedBy;
  description: string | null;
  is_system_role: boolean;
  role_level: number;
  member_count: number;
  sync_state: IamRoleSyncState;
  last_synced_at: string | null;
  last_error_code: string | null;
  permission_rows: Array<{ id: string; permission_key: string; description: string | null }> | null;
};

const ROLE_LIST_ITEM_SELECT_SQL = `
SELECT
  r.id,
  r.role_key,
  r.role_name,
  r.display_name,
  r.external_role_name,
  r.managed_by,
  r.description,
  r.is_system_role,
  r.role_level,
  COUNT(DISTINCT ar.account_id)::int AS member_count,
  r.sync_state,
  r.last_synced_at::text,
  r.last_error_code,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'id', p.id,
        'permission_key', p.permission_key,
        'description', p.description
      )
    ) FILTER (WHERE p.id IS NOT NULL),
    '[]'::json
  ) AS permission_rows
FROM iam.roles r
LEFT JOIN iam.account_roles ar
  ON ar.instance_id = r.instance_id
 AND ar.role_id = r.id
 AND ar.valid_from <= NOW()
 AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
LEFT JOIN iam.role_permissions rp
  ON rp.instance_id = r.instance_id
 AND rp.role_id = r.id
LEFT JOIN iam.permissions p
  ON p.instance_id = rp.instance_id
 AND p.id = rp.permission_id
`;

export const loadRoleListItems = async (
  client: QueryClient,
  instanceId: string
): Promise<readonly IamRoleListItem[]> => {
  const result = await client.query<RoleListItemRow>(
    `${ROLE_LIST_ITEM_SELECT_SQL}
WHERE r.instance_id = $1
GROUP BY r.id
ORDER BY r.role_level DESC, COALESCE(r.display_name, r.role_name) ASC;
`,
    [instanceId]
  );

  return result.rows.map(mapRoleListItem);
};

export const loadRoleById = async (
  client: QueryClient,
  input: { instanceId: string; roleId: string }
): Promise<ManagedRoleRow | undefined> => {
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
  AND id = $2::uuid
LIMIT 1;
`,
    [input.instanceId, input.roleId]
  );
  return result.rows[0];
};

export const loadRoleListItemById = async (
  client: QueryClient,
  input: { instanceId: string; roleId: string }
): Promise<IamRoleListItem | undefined> => {
  const result = await client.query<RoleListItemRow>(
    `${ROLE_LIST_ITEM_SELECT_SQL}
WHERE r.instance_id = $1
  AND r.id = $2::uuid
GROUP BY r.id
LIMIT 1;
`,
    [input.instanceId, input.roleId]
  );
  const row = result.rows[0];
  return row ? mapRoleListItem(row) : undefined;
};
