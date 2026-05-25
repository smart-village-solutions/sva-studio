import type { QueryClient } from '../db.js';

import { diffAssignments } from './assignment-diff.js';

export const assignRoles = async (
  client: QueryClient,
  input: {
    instanceId: string;
    accountId: string;
    roleIds: readonly string[];
    existingRoleIds?: readonly string[];
    assignedBy?: string;
  }
) => {
  const normalizedRoleIds = [...new Set(input.roleIds)];
  const diff = input.existingRoleIds
    ? diffAssignments(input.existingRoleIds, normalizedRoleIds)
    : {
        deleteIds: [] as readonly string[],
        insertIds: normalizedRoleIds,
      };

  if (input.existingRoleIds === undefined) {
    await client.query(
      `
DELETE FROM iam.account_roles
WHERE instance_id = $1
  AND account_id = $2::uuid
  AND (
    cardinality($3::uuid[]) = 0
    OR role_id <> ALL($3::uuid[])
  );
`,
      [input.instanceId, input.accountId, normalizedRoleIds]
    );
  } else if (diff.deleteIds.length > 0) {
    await client.query(
      `
DELETE FROM iam.account_roles
WHERE instance_id = $1
  AND account_id = $2::uuid
  AND role_id = ANY($3::uuid[]);
`,
      [input.instanceId, input.accountId, diff.deleteIds]
    );
  }

  if (diff.insertIds.length === 0) {
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
ON CONFLICT (instance_id, account_id, role_id)
DO UPDATE
SET assigned_by = EXCLUDED.assigned_by,
    valid_from = NOW(),
    valid_until = NULL;
`,
    [input.instanceId, input.accountId, input.assignedBy ?? null, diff.insertIds]
  );
};

export const assignGroups = async (
  client: QueryClient,
  input: {
    instanceId: string;
    accountId: string;
    groupIds: readonly string[];
    existingGroupIds?: readonly string[];
    origin?: 'manual' | 'seed' | 'sync';
  }
) => {
  const normalizedGroupIds = [...new Set(input.groupIds)];
  const diff = input.existingGroupIds
    ? diffAssignments(input.existingGroupIds, normalizedGroupIds)
    : {
        deleteIds: [] as readonly string[],
        insertIds: normalizedGroupIds,
      };

  if (input.existingGroupIds === undefined) {
    await client.query(
      `
DELETE FROM iam.account_groups
WHERE instance_id = $1
  AND account_id = $2::uuid
  AND (
    cardinality($3::uuid[]) = 0
    OR group_id <> ALL($3::uuid[])
  );
`,
      [input.instanceId, input.accountId, normalizedGroupIds]
    );
  } else if (diff.deleteIds.length > 0) {
    await client.query(
      `
DELETE FROM iam.account_groups
WHERE instance_id = $1
  AND account_id = $2::uuid
  AND group_id = ANY($3::uuid[]);
`,
      [input.instanceId, input.accountId, diff.deleteIds]
    );
  }

  if (diff.insertIds.length === 0) {
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
ON CONFLICT (instance_id, account_id, group_id)
DO UPDATE
SET origin = EXCLUDED.origin,
    valid_from = NOW(),
    valid_until = NULL;
`,
    [input.instanceId, input.accountId, input.origin ?? 'manual', diff.insertIds]
  );
};
