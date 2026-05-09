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

export class GroupQueryExecutionError extends Error {
  readonly stage: 'group_detail' | 'group_memberships' | 'group_roles';
  readonly cause: unknown;

  constructor(
    stage: 'group_detail' | 'group_memberships' | 'group_roles',
    cause: unknown
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'GroupQueryExecutionError';
    this.stage = stage;
    this.cause = cause;
  }
}

const compareMembershipDisplayNames = (
  left: { readonly displayName?: string; readonly keycloakSubject: string },
  right: { readonly displayName?: string; readonly keycloakSubject: string }
): number => {
  const leftLabel = left.displayName ?? left.keycloakSubject;
  const rightLabel = right.displayName ?? right.keycloakSubject;
  const labelComparison = leftLabel.localeCompare(rightLabel, 'de');
  if (labelComparison !== 0) {
    return labelComparison;
  }

  return left.keycloakSubject.localeCompare(right.keycloakSubject, 'de');
};

const GROUP_SELECT_COLUMNS_SQL = `
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
`;

const GROUP_FROM_AND_JOINS_SQL = `
FROM iam.groups g
LEFT JOIN iam.account_groups ag
  ON ag.instance_id = g.instance_id
 AND ag.group_id = g.id
 AND (ag.valid_until IS NULL OR ag.valid_until > now())
LEFT JOIN iam.group_roles gr
  ON gr.instance_id = g.instance_id
 AND gr.group_id = g.id
`;

const GROUP_LIST_SQL = `
SELECT
${GROUP_SELECT_COLUMNS_SQL}
${GROUP_FROM_AND_JOINS_SQL}
WHERE g.instance_id = $1
GROUP BY g.id
ORDER BY g.display_name ASC
`;

const GROUP_DETAIL_SQL = `
SELECT
${GROUP_SELECT_COLUMNS_SQL}
${GROUP_FROM_AND_JOINS_SQL}
WHERE g.instance_id = $1
  AND g.id = $2::uuid
GROUP BY g.id
LIMIT 1
`;

const GROUP_MEMBERSHIPS_SQL = `
SELECT
  ag.instance_id,
  ag.account_id,
  ag.group_id,
  a.keycloak_subject,
  a.display_name_ciphertext,
  a.first_name_ciphertext,
  a.last_name_ciphertext,
  a.email_ciphertext,
  ag.valid_from::text,
  ag.valid_until::text,
  ag.assigned_at::text,
  ag.assigned_by
FROM iam.account_groups ag
JOIN iam.accounts a
  ON a.id = ag.account_id
WHERE ag.instance_id = $1
  AND ag.group_id = $2::uuid
ORDER BY a.keycloak_subject ASC;
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
  let rows;
  try {
    rows = await client.query<GroupRow>(GROUP_DETAIL_SQL, [input.instanceId, input.groupId]);
  } catch (error) {
    throw new GroupQueryExecutionError('group_detail', error);
  }
  const row = rows.rows[0];
  if (!row) {
    return null;
  }

  let roleRows;
  try {
    roleRows = await client.query<{ role_id: string }>(
      'SELECT role_id FROM iam.group_roles WHERE instance_id = $1 AND group_id = $2::uuid',
      [input.instanceId, input.groupId]
    );
  } catch (error) {
    throw new GroupQueryExecutionError('group_roles', error);
  }
  let membershipRows;
  try {
    membershipRows = await loadGroupMembershipRows(client, input);
  } catch (error) {
    throw new GroupQueryExecutionError('group_memberships', error);
  }
  const memberships = membershipRows.rows
    .map(mapGroupMembership)
    .sort(compareMembershipDisplayNames);

  return {
    ...mapGroupListItem(row),
    assignedRoleIds: roleRows.rows.map((role) => role.role_id),
    memberships,
  };
};

export const loadGroupMembershipRows = (
  client: GroupQueryClient,
  input: { readonly instanceId: string; readonly groupId: string }
) => client.query<AccountGroupRow>(GROUP_MEMBERSHIPS_SQL, [input.instanceId, input.groupId]);
