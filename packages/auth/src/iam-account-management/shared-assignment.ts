import type { QueryClient } from '../shared/db-helpers.js';

export const assignRoles = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string; roleIds: readonly string[]; assignedBy?: string }
) => {
  await client.query('DELETE FROM iam.account_roles WHERE instance_id = $1 AND account_id = $2::uuid;', [
    input.instanceId,
    input.accountId,
  ]);
  if (input.roleIds.length === 0) {
    return;
  }

  await client.query(
    `
INSERT INTO iam.account_roles (
  instance_id,
  account_id,
  role_id,
  assigned_by,
  valid_from
)
SELECT $1, $2::uuid, role_id, $3::uuid, NOW()
FROM unnest($4::uuid[]) AS role_id;
`,
    [input.instanceId, input.accountId, input.assignedBy ?? null, input.roleIds]
  );
};

export const assignGroups = async (
  client: QueryClient,
  input: {
    instanceId: string;
    accountId: string;
    groupIds: readonly string[];
    origin?: 'manual' | 'seed' | 'sync';
  }
) => {
  const uniqueGroupIds = [...new Set(input.groupIds)];
  await client.query('DELETE FROM iam.account_groups WHERE instance_id = $1 AND account_id = $2::uuid;', [
    input.instanceId,
    input.accountId,
  ]);
  if (uniqueGroupIds.length === 0) {
    return;
  }

  await client.query(
    `
INSERT INTO iam.account_groups (
  instance_id,
  account_id,
  group_id,
  origin,
  valid_from
)
SELECT $1, $2::uuid, group_id, $3, NOW()
FROM (
  SELECT DISTINCT group_id
  FROM unnest($4::uuid[]) AS input_groups(group_id)
) AS unique_group_ids;
`,
    [input.instanceId, input.accountId, input.origin ?? 'manual', uniqueGroupIds]
  );
};
