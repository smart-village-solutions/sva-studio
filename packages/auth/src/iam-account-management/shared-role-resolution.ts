import type { QueryClient } from '../shared/db-helpers.js';

import type { IamGroupRow, IamRoleRow } from './types.js';

export const resolveRolesByIds = async (
  client: QueryClient,
  input: { instanceId: string; roleIds: readonly string[] }
): Promise<readonly IamRoleRow[]> => {
  if (input.roleIds.length === 0) {
    return [];
  }

  const result = await client.query<IamRoleRow>(
    `
SELECT id, role_key, role_name, display_name, external_role_name, role_level, is_system_role
FROM iam.roles
WHERE instance_id = $1
  AND id = ANY($2::uuid[]);
`,
    [input.instanceId, input.roleIds]
  );
  return result.rows;
};

export const resolveRolesByExternalNames = async (
  client: QueryClient,
  input: { instanceId: string; externalRoleNames: readonly string[] }
): Promise<readonly IamRoleRow[]> => {
  if (input.externalRoleNames.length === 0) {
    return [];
  }

  const result = await client.query<IamRoleRow>(
    `
SELECT id, role_key, role_name, display_name, external_role_name, role_level, is_system_role
FROM iam.roles
WHERE instance_id = $1
  AND COALESCE(external_role_name, role_key) = ANY($2::text[]);
`,
    [input.instanceId, input.externalRoleNames]
  );
  return result.rows;
};

export const resolveGroupsByIds = async (
  client: QueryClient,
  input: { instanceId: string; groupIds: readonly string[] }
): Promise<readonly IamGroupRow[]> => {
  const uniqueGroupIds = [...new Set(input.groupIds)];
  if (uniqueGroupIds.length === 0) {
    return [];
  }

  const result = await client.query<IamGroupRow>(
    `
SELECT id, group_key, display_name, description, group_type, is_active
FROM iam.groups
WHERE instance_id = $1
  AND is_active = true
  AND id = ANY($2::uuid[]);
`,
    [input.instanceId, uniqueGroupIds]
  );

  return result.rows;
};

export const resolveRoleIdsForGroups = async (
  client: QueryClient,
  input: { instanceId: string; groupIds: readonly string[] }
): Promise<readonly string[]> => {
  const uniqueGroupIds = [...new Set(input.groupIds)];
  if (uniqueGroupIds.length === 0) {
    return [];
  }

  const result = await client.query<{ role_id: string }>(
    `
SELECT DISTINCT gr.role_id
FROM iam.group_roles gr
JOIN iam.groups g
  ON g.instance_id = gr.instance_id
 AND g.id = gr.group_id
 AND g.is_active = true
WHERE gr.instance_id = $1
  AND gr.group_id = ANY($2::uuid[]);
`,
    [input.instanceId, uniqueGroupIds]
  );

  return result.rows.map((row) => row.role_id);
};
