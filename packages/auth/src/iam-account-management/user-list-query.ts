import type { IamUserListItem } from '@sva/core';

import type { QueryClient } from '../shared/db-helpers';

import type { UserStatus } from './types';
import { mapUserRowToListItem } from './user-mapping';

type UserListRoleRow = {
  id: string;
  role_key: string;
  role_name: string;
  display_name: string | null;
  role_level: number;
  is_system_role: boolean;
};

type UserListRow = {
  id: string;
  keycloak_subject: string;
  display_name_ciphertext: string | null;
  first_name_ciphertext: string | null;
  last_name_ciphertext: string | null;
  email_ciphertext: string | null;
  position: string | null;
  department: string | null;
  status: UserStatus;
  last_login_at: string | null;
  role_rows: UserListRoleRow[] | null;
};

type UserListInput = {
  instanceId: string;
  page: number;
  pageSize: number;
  status?: UserStatus;
  role?: string;
  search?: string;
};

const COUNT_USERS_QUERY = `
SELECT COUNT(DISTINCT a.id)::int AS total
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1::uuid
LEFT JOIN iam.account_roles ar
  ON ar.instance_id = im.instance_id
 AND ar.account_id = im.account_id
 AND ar.valid_from <= NOW()
 AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
LEFT JOIN iam.roles r
  ON r.instance_id = ar.instance_id
 AND r.id = ar.role_id
WHERE ($2::text IS NULL OR a.status = $2)
  AND ($3::text IS NULL OR r.role_key = $3)
  AND (
    $4::text IS NULL OR
    a.keycloak_subject ILIKE '%' || $4 || '%' OR
    COALESCE(a.position, '') ILIKE '%' || $4 || '%' OR
    COALESCE(a.department, '') ILIKE '%' || $4 || '%'
  );
`;

const LIST_USERS_QUERY = `
SELECT
  a.id,
  a.keycloak_subject,
  a.display_name_ciphertext,
  a.first_name_ciphertext,
  a.last_name_ciphertext,
  a.email_ciphertext,
  a.position,
  a.department,
  a.status,
  MAX(al.created_at)::text AS last_login_at,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'id', r.id,
        'role_key', r.role_key,
        'role_name', r.role_name,
        'display_name', r.display_name,
        'role_level', r.role_level,
        'is_system_role', r.is_system_role
      )
    ) FILTER (WHERE r.id IS NOT NULL),
    '[]'::json
  ) AS role_rows
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1::uuid
LEFT JOIN iam.account_roles ar
  ON ar.instance_id = im.instance_id
 AND ar.account_id = im.account_id
 AND ar.valid_from <= NOW()
 AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
LEFT JOIN iam.roles r
  ON r.instance_id = ar.instance_id
 AND r.id = ar.role_id
LEFT JOIN iam.role_permissions rp
  ON rp.instance_id = r.instance_id
 AND rp.role_id = r.id
LEFT JOIN iam.permissions p
  ON p.instance_id = rp.instance_id
 AND p.id = rp.permission_id
LEFT JOIN iam.activity_logs al
  ON al.instance_id = im.instance_id
 AND al.account_id = a.id
 AND al.event_type = 'login'
WHERE ($2::text IS NULL OR a.status = $2)
  AND ($3::text IS NULL OR r.role_key = $3)
  AND (
    $4::text IS NULL OR
    a.keycloak_subject ILIKE '%' || $4 || '%' OR
    COALESCE(a.position, '') ILIKE '%' || $4 || '%' OR
    COALESCE(a.department, '') ILIKE '%' || $4 || '%'
  )
GROUP BY a.id
ORDER BY a.created_at DESC
LIMIT $5 OFFSET $6;
`;

const toUserListParams = (input: UserListInput, offset: number) => [
  input.instanceId,
  input.status ?? null,
  input.role ?? null,
  input.search ?? null,
  input.pageSize,
  offset,
];

const mapRoleRows = (roleRows: UserListRoleRow[] | null) =>
  roleRows?.map((entry) => ({
    id: entry.id,
    role_key: entry.role_key,
    role_name: entry.role_name,
    display_name: entry.display_name,
    role_level: Number(entry.role_level),
    is_system_role: Boolean(entry.is_system_role),
  })) ?? [];

const mapUserListRow = (row: UserListRow): IamUserListItem =>
  mapUserRowToListItem({
    ...row,
    roles: mapRoleRows(row.role_rows),
  });

export const resolveUsersWithPagination = async (
  client: QueryClient,
  input: UserListInput
): Promise<{ total: number; users: readonly IamUserListItem[] }> => {
  const offset = (input.page - 1) * input.pageSize;
  const baseParams = [
    input.instanceId,
    input.status ?? null,
    input.role ?? null,
    input.search ?? null,
  ];
  const totalResult = await client.query<{ total: number }>(COUNT_USERS_QUERY, baseParams);
  const rows = await client.query<UserListRow>(LIST_USERS_QUERY, toUserListParams(input, offset));

  return {
    total: totalResult.rows[0]?.total ?? 0,
    users: rows.rows.map(mapUserListRow),
  };
};
