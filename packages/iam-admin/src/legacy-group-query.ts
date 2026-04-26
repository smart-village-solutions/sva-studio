import type { IamGroupDetail, IamGroupListItem, IamUserGroupAssignment } from '@sva/core';

import type { QueryClient } from './query-client.js';

type GroupRoleRow = {
  role_id: string;
  role_key: string;
  role_name: string;
};

type GroupListRow = {
  id: string;
  group_key: string;
  display_name: string;
  description: string | null;
  group_type: 'role_bundle';
  is_active: boolean;
  member_count: number;
  role_rows: GroupRoleRow[] | null;
};

type GroupMemberRow = {
  account_id: string;
  group_id: string;
  group_key: string;
  display_name: string;
  group_type: 'role_bundle';
  origin: 'manual' | 'seed' | 'sync';
  valid_from: string | null;
  valid_to: string | null;
};

type GroupDetailRow = GroupListRow & {
  member_rows: GroupMemberRow[] | null;
};

const mapLegacyGroupListItem = (row: GroupListRow): IamGroupListItem => ({
  id: row.id,
  groupKey: row.group_key,
  displayName: row.display_name,
  description: row.description ?? undefined,
  groupType: row.group_type,
  isActive: row.is_active,
  memberCount: Number(row.member_count),
  roles:
    row.role_rows?.map((role) => ({
      roleId: role.role_id,
      roleKey: role.role_key,
      roleName: role.role_name,
    })) ?? [],
});

const mapLegacyGroupMemberRows = (rows: GroupMemberRow[] | null): readonly IamUserGroupAssignment[] =>
  rows?.map((row) => ({
    accountId: row.account_id,
    groupId: row.group_id,
    groupKey: row.group_key,
    displayName: row.display_name,
    groupType: row.group_type,
    origin: row.origin,
    validFrom: row.valid_from ?? undefined,
    validTo: row.valid_to ?? undefined,
  })) ?? [];

const mapLegacyGroupDetail = (row: GroupDetailRow): IamGroupDetail => ({
  ...mapLegacyGroupListItem(row),
  members: mapLegacyGroupMemberRows(row.member_rows),
});

const GROUP_LIST_QUERY = `
SELECT
  g.id,
  g.group_key,
  g.display_name,
  g.description,
  g.group_type,
  g.is_active,
  COUNT(DISTINCT ag.account_id)::int AS member_count,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'role_id', r.id,
        'role_key', r.role_key,
        'role_name', COALESCE(r.display_name, r.role_name)
      )
    ) FILTER (WHERE r.id IS NOT NULL),
    '[]'::json
  ) AS role_rows
FROM iam.groups g
LEFT JOIN iam.group_roles gr
  ON gr.instance_id = g.instance_id
 AND gr.group_id = g.id
LEFT JOIN iam.roles r
  ON r.instance_id = gr.instance_id
 AND r.id = gr.role_id
LEFT JOIN iam.account_groups ag
  ON ag.instance_id = g.instance_id
 AND ag.group_id = g.id
 AND (ag.valid_from IS NULL OR ag.valid_from <= NOW())
 AND (ag.valid_until IS NULL OR ag.valid_until > NOW())
WHERE g.instance_id = $1
GROUP BY g.id
ORDER BY g.is_active DESC, g.display_name ASC;
`;

const GROUP_DETAIL_QUERY = `
SELECT
  g.id,
  g.group_key,
  g.display_name,
  g.description,
  g.group_type,
  g.is_active,
  COUNT(DISTINCT ag.account_id)::int AS member_count,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'role_id', r.id,
        'role_key', r.role_key,
        'role_name', COALESCE(r.display_name, r.role_name)
      )
    ) FILTER (WHERE r.id IS NOT NULL),
    '[]'::json
  ) AS role_rows,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'group_id', g.id,
        'account_id', ag.account_id,
        'group_key', g.group_key,
        'display_name', g.display_name,
        'group_type', g.group_type,
        'origin', ag.origin,
        'valid_from', ag.valid_from::text,
        'valid_to', ag.valid_until::text
      )
    ) FILTER (WHERE ag.account_id IS NOT NULL),
    '[]'::json
  ) AS member_rows
FROM iam.groups g
LEFT JOIN iam.group_roles gr
  ON gr.instance_id = g.instance_id
 AND gr.group_id = g.id
LEFT JOIN iam.roles r
  ON r.instance_id = gr.instance_id
 AND r.id = gr.role_id
LEFT JOIN iam.account_groups ag
  ON ag.instance_id = g.instance_id
 AND ag.group_id = g.id
 AND (ag.valid_from IS NULL OR ag.valid_from <= NOW())
 AND (ag.valid_until IS NULL OR ag.valid_until > NOW())
WHERE g.instance_id = $1
  AND g.id = $2::uuid
GROUP BY g.id
LIMIT 1;
`;

export const loadLegacyGroups = async (
  client: QueryClient,
  instanceId: string
): Promise<readonly IamGroupListItem[]> => {
  const result = await client.query<GroupListRow>(GROUP_LIST_QUERY, [instanceId]);
  return result.rows.map(mapLegacyGroupListItem);
};

export const loadLegacyGroupById = async (
  client: QueryClient,
  input: { readonly instanceId: string; readonly groupId: string }
): Promise<IamGroupDetail | undefined> => {
  const result = await client.query<GroupDetailRow>(GROUP_DETAIL_QUERY, [input.instanceId, input.groupId]);
  const row = result.rows[0];
  return row ? mapLegacyGroupDetail(row) : undefined;
};
