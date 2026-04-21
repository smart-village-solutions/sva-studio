import type { IamUserListItem } from '@sva/core';

import type { QueryClient } from '../shared/db-helpers.js';

import { mapUserRowToListItem } from './user-mapping.js';
import type { IamRoleRow, UserStatus } from './types.js';

type AccountProjectionRow = {
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
  role_rows: Array<{
    id: string;
    role_key: string;
    role_name: string;
    display_name: string | null;
    external_role_name: string | null;
    role_level: number;
    is_system_role: boolean;
  }> | null;
};

const mapRoleRows = (roleRows: AccountProjectionRow['role_rows']): readonly IamRoleRow[] =>
  roleRows?.map((entry) => ({
    id: entry.id,
    role_key: entry.role_key,
    role_name: entry.role_name,
    display_name: entry.display_name,
    external_role_name: entry.external_role_name,
    role_level: Number(entry.role_level),
    is_system_role: Boolean(entry.is_system_role),
  })) ?? [];

export const loadMappedUsersBySubject = async (
  client: QueryClient,
  input: { instanceId: string; subjects: readonly string[] }
): Promise<ReadonlyMap<string, IamUserListItem>> => {
  if (input.subjects.length === 0) {
    return new Map();
  }

  const result = await client.query<AccountProjectionRow>(
    `
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
        'external_role_name', r.external_role_name,
        'role_level', r.role_level,
        'is_system_role', r.is_system_role
      )
    ) FILTER (WHERE r.id IS NOT NULL),
    '[]'::json
  ) AS role_rows
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1
LEFT JOIN iam.account_roles ar
  ON ar.instance_id = im.instance_id
 AND ar.account_id = im.account_id
 AND ar.valid_from <= NOW()
 AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
LEFT JOIN iam.roles r
  ON r.instance_id = ar.instance_id
 AND r.id = ar.role_id
LEFT JOIN iam.activity_logs al
  ON al.instance_id = im.instance_id
 AND al.account_id = a.id
 AND al.event_type = 'login'
WHERE a.keycloak_subject = ANY($2::text[])
GROUP BY a.id;
`,
    [input.instanceId, input.subjects]
  );

  return new Map(
    result.rows.map((row) => [
      row.keycloak_subject,
      mapUserRowToListItem({
        ...row,
        roles: mapRoleRows(row.role_rows),
      }),
    ])
  );
};
