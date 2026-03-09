import type { IamUserDetail } from '@sva/core';

import type { QueryClient } from '../shared/db-helpers';

import { revealField } from './encryption';
import type { UserStatus } from './types';
import { mapUserRowToListItem } from './user-mapping';

type UserDetailRoleRow = {
  id: string;
  role_key: string;
  role_name: string;
  display_name: string | null;
  role_level: number;
  is_system_role: boolean;
};

type UserDetailRow = {
  id: string;
  keycloak_subject: string;
  username_ciphertext: string | null;
  display_name_ciphertext: string | null;
  email_ciphertext: string | null;
  first_name_ciphertext: string | null;
  last_name_ciphertext: string | null;
  phone_ciphertext: string | null;
  position: string | null;
  department: string | null;
  preferred_language: string | null;
  timezone: string | null;
  avatar_url: string | null;
  notes: string | null;
  status: UserStatus;
  last_login_at: string | null;
  role_rows: UserDetailRoleRow[] | null;
  permission_rows: Array<{ permission_key: string }> | null;
};

const USER_DETAIL_QUERY = `
SELECT
  a.id,
  a.keycloak_subject,
  a.username_ciphertext,
  a.display_name_ciphertext,
  a.email_ciphertext,
  a.first_name_ciphertext,
  a.last_name_ciphertext,
  a.phone_ciphertext,
  a.position,
  a.department,
  a.preferred_language,
  a.timezone,
  a.avatar_url,
  a.notes,
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
  ) AS role_rows,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'permission_key', p.permission_key
      )
    ) FILTER (WHERE p.permission_key IS NOT NULL),
    '[]'::json
  ) AS permission_rows
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
WHERE a.id = $2::uuid
GROUP BY a.id;
`;

const mapRoleRows = (roleRows: UserDetailRoleRow[] | null) =>
  roleRows?.map((entry) => ({
    id: entry.id,
    role_key: entry.role_key,
    role_name: entry.role_name,
    display_name: entry.display_name,
    role_level: Number(entry.role_level),
    is_system_role: Boolean(entry.is_system_role),
  })) ?? [];

const mapPermissionRows = (permissionRows: UserDetailRow['permission_rows']) =>
  permissionRows?.map((entry) => entry.permission_key) ?? [];

const mapUserDetailRow = (row: UserDetailRow): IamUserDetail => {
  const base = mapUserRowToListItem({
    id: row.id,
    keycloak_subject: row.keycloak_subject,
    display_name_ciphertext: row.display_name_ciphertext,
    first_name_ciphertext: row.first_name_ciphertext,
    last_name_ciphertext: row.last_name_ciphertext,
    email_ciphertext: row.email_ciphertext,
    position: row.position,
    department: row.department,
    status: row.status,
    last_login_at: row.last_login_at,
    roles: mapRoleRows(row.role_rows),
  });

  return {
    ...base,
    username: revealField(row.username_ciphertext, `iam.accounts.username:${row.keycloak_subject}`),
    firstName: revealField(row.first_name_ciphertext, `iam.accounts.first_name:${row.keycloak_subject}`),
    lastName: revealField(row.last_name_ciphertext, `iam.accounts.last_name:${row.keycloak_subject}`),
    phone: revealField(row.phone_ciphertext, `iam.accounts.phone:${row.keycloak_subject}`),
    preferredLanguage: row.preferred_language ?? undefined,
    timezone: row.timezone ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    notes: row.notes ?? undefined,
    permissions: mapPermissionRows(row.permission_rows),
  };
};

export const resolveUserDetail = async (
  client: QueryClient,
  input: { instanceId: string; userId: string }
): Promise<IamUserDetail | undefined> => {
  const result = await client.query<UserDetailRow>(USER_DETAIL_QUERY, [input.instanceId, input.userId]);
  const row = result.rows[0];
  return row ? mapUserDetailRow(row) : undefined;
};
