import type { IamAdminGroupDetail } from './group-types.js';
import {
  mapGroupListItem,
  mapGroupMembership,
  type AccountGroupRow,
  type GroupRow,
} from './group-types.js';

export type GroupQueryClient = {
  readonly query: <TRow = unknown>(
    text: string,
    values?: readonly unknown[]
  ) => Promise<{ readonly rowCount: number; readonly rows: TRow[] }>;
};

const GROUP_SELECT_SQL = `
  g.id,
  g.instance_id,
  g.group_key,
  g.display_name,
  g.description,
  g.group_type,
  g.is_active,
  g.created_at,
  g.updated_at,
  COUNT(DISTINCT ag.account_id)::int AS member_count,
  COUNT(DISTINCT gr.role_id)::int    AS role_count
FROM iam.groups g
LEFT JOIN iam.account_groups ag
  ON ag.instance_id = g.instance_id
 AND ag.group_id = g.id
 AND (ag.valid_until IS NULL OR ag.valid_until > now())
LEFT JOIN iam.group_roles gr
  ON gr.instance_id = g.instance_id
 AND gr.group_id = g.id
WHERE g.instance_id = $1
GROUP BY g.id
`;

const GROUP_LIST_SQL = `
SELECT
${GROUP_SELECT_SQL}
ORDER BY g.display_name ASC
`;

const GROUP_DETAIL_SQL = `
SELECT
${GROUP_SELECT_SQL}
WHERE g.instance_id = $1
  AND g.id = $2::uuid
LIMIT 1
`;

const GROUP_MEMBERSHIPS_SQL = `
SELECT
  ag.instance_id,
  ag.account_id,
  ag.group_id,
  a.keycloak_subject,
  COALESCE(a.display_name, NULLIF(CONCAT_WS(' ', a.first_name, a.last_name), ''), a.email) AS display_name,
  ag.valid_from::text,
  ag.valid_until::text,
  ag.assigned_at::text,
  ag.assigned_by
FROM iam.account_groups ag
JOIN iam.accounts a
  ON a.id = ag.account_id
WHERE ag.instance_id = $1
  AND ag.group_id = $2::uuid
ORDER BY COALESCE(a.display_name, NULLIF(CONCAT_WS(' ', a.first_name, a.last_name), ''), a.email, a.keycloak_subject) ASC;
`;

export const loadGroupListItems = async (
  client: GroupQueryClient,
  instanceId: string
) => {
  const result = await client.query<GroupRow>(GROUP_LIST_SQL, [instanceId]);
  return result.rows.map(mapGroupListItem);
};

export const loadGroupDetail = async (
  client: GroupQueryClient,
  input: { readonly instanceId: string; readonly groupId: string }
): Promise<IamAdminGroupDetail | null> => {
  const rows = await client.query<GroupRow>(GROUP_DETAIL_SQL, [input.instanceId, input.groupId]);
  const row = rows.rows[0];
  if (!row) {
    return null;
  }

  const roleRows = await client.query<{ role_id: string }>(
    'SELECT role_id FROM iam.group_roles WHERE instance_id = $1 AND group_id = $2::uuid',
    [input.instanceId, input.groupId]
  );
  const membershipRows = await client.query<AccountGroupRow>(GROUP_MEMBERSHIPS_SQL, [
    input.instanceId,
    input.groupId,
  ]);

  return {
    ...mapGroupListItem(row),
    assignedRoleIds: roleRows.rows.map((role) => role.role_id),
    memberships: membershipRows.rows.map(mapGroupMembership),
  };
};
