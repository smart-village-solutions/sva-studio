import type { IamUserRoleAssignment } from '@sva/core';

import type { QueryClient } from '../shared/db-helpers';

import { getRoleDisplayName } from './role-audit';

type BulkUserRoleRow = {
  id: string;
  role_key: string;
  role_name: string;
  display_name: string | null;
  role_level: number;
};

type BulkUserRow = {
  id: string;
  keycloak_subject: string;
  status: 'active' | 'inactive' | 'pending';
  role_rows: BulkUserRoleRow[] | null;
};

export type BulkUserAccess = {
  id: string;
  keycloakSubject: string;
  status: 'active' | 'inactive' | 'pending';
  roles: readonly IamUserRoleAssignment[];
};

const BULK_USERS_QUERY = `
SELECT
  a.id,
  a.keycloak_subject,
  a.status,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'id', r.id,
        'role_key', r.role_key,
        'role_name', r.role_name,
        'display_name', r.display_name,
        'role_level', r.role_level
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
WHERE a.id = ANY($2::uuid[])
GROUP BY a.id;
`;

const mapRoles = (rows: BulkUserRoleRow[] | null): readonly IamUserRoleAssignment[] =>
  rows?.map((row) => ({
    roleId: row.id,
    roleKey: row.role_key,
    roleName: getRoleDisplayName({
      display_name: row.display_name,
      role_name: row.role_name,
    }),
    roleLevel: Number(row.role_level),
  })) ?? [];

const mapBulkUser = (row: BulkUserRow): BulkUserAccess => ({
  id: row.id,
  keycloakSubject: row.keycloak_subject,
  status: row.status,
  roles: mapRoles(row.role_rows),
});

export const resolveUsersForBulkDeactivation = async (
  client: QueryClient,
  input: { instanceId: string; userIds: readonly string[] }
): Promise<readonly BulkUserAccess[]> => {
  if (input.userIds.length === 0) {
    return [];
  }

  const result = await client.query<BulkUserRow>(BULK_USERS_QUERY, [input.instanceId, input.userIds]);
  const usersById = new Map(result.rows.map((row) => [row.id, mapBulkUser(row)]));

  return input.userIds
    .map((userId) => usersById.get(userId))
    .filter((user): user is BulkUserAccess => Boolean(user));
};
