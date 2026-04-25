type QueryResult<TRow> = { rows: TRow[] };

type QueryClient = {
  query<TRow = unknown>(text: string, values?: readonly unknown[]): Promise<QueryResult<TRow>>;
};
import { IamSchemaDriftError } from './runtime-errors.js';

import {
  buildDirectPermissionRowsSql,
  buildPermissionRowsSql,
  buildPermissionTraceRowsSql,
} from './user-detail-permission-sql.js';
import type { UserDetailSchemaSupport, UserDetailSchemaSupportRow } from './user-detail-query.types.js';

const USER_DETAIL_SELECT_SQL = `
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
        'is_system_role', r.is_system_role,
        'valid_from', ar.valid_from::text,
        'valid_to', ar.valid_to::text
      )
    ) FILTER (WHERE r.id IS NOT NULL),
    '[]'::json
  ) AS role_rows,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'id', g.id,
        'group_key', g.group_key,
        'display_name', g.display_name,
        'group_type', g.group_type,
        'origin', ag.origin,
        'valid_from', ag.valid_from::text,
        'valid_to', ag.valid_until::text
      )
    ) FILTER (WHERE g.id IS NOT NULL),
    '[]'::json
  ) AS group_rows,
`;

const USER_DETAIL_FROM_SQL = `
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
LEFT JOIN iam.role_permissions rp
  ON rp.instance_id = r.instance_id
 AND rp.role_id = r.id
LEFT JOIN iam.account_groups ag
  ON ag.instance_id = im.instance_id
 AND ag.account_id = im.account_id
 AND (ag.valid_from IS NULL OR ag.valid_from <= NOW())
 AND (ag.valid_until IS NULL OR ag.valid_until > NOW())
LEFT JOIN iam.groups g
  ON g.instance_id = ag.instance_id
 AND g.id = ag.group_id
 AND g.is_active = true
LEFT JOIN iam.activity_logs al
  ON al.instance_id = im.instance_id
 AND al.account_id = a.id
 AND al.event_type = 'login'
WHERE a.id = $2::uuid
GROUP BY a.id;
`;

const buildUserDetailQuery = (includeDirectPermissions: boolean, includeStructuredPermissions: boolean): string =>
  [
    USER_DETAIL_SELECT_SQL,
    buildPermissionRowsSql(includeDirectPermissions),
    buildDirectPermissionRowsSql(includeDirectPermissions),
    buildPermissionTraceRowsSql(includeDirectPermissions, includeStructuredPermissions),
    USER_DETAIL_FROM_SQL,
  ].join('');

const USER_DETAIL_QUERY = buildUserDetailQuery(true, true);
const USER_DETAIL_SCHEMA_SUPPORT_QUERY = `
SELECT
  to_regclass('iam.account_permissions') IS NOT NULL AS account_permissions_exists,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'iam' AND table_name = 'permissions' AND column_name = 'action'
  ) AS permissions_action_exists,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'iam' AND table_name = 'permissions' AND column_name = 'resource_type'
  ) AS permissions_resource_type_exists,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'iam' AND table_name = 'permissions' AND column_name = 'resource_id'
  ) AS permissions_resource_id_exists,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'iam' AND table_name = 'permissions' AND column_name = 'effect'
  ) AS permissions_effect_exists,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'iam' AND table_name = 'permissions' AND column_name = 'scope'
  ) AS permissions_scope_exists;
`;

export const readUserDetailSchemaSupport = async (
  client: QueryClient
): Promise<UserDetailSchemaSupport> => {
  const result = await client.query<UserDetailSchemaSupportRow>(USER_DETAIL_SCHEMA_SUPPORT_QUERY);
  const row = result.rows[0];

  return {
    hasAccountPermissionsTable: row?.account_permissions_exists === true,
    hasStructuredPermissions:
      row?.permissions_action_exists === true &&
      row?.permissions_resource_type_exists === true &&
      row?.permissions_resource_id_exists === true &&
      row?.permissions_effect_exists === true &&
      row?.permissions_scope_exists === true,
  };
};

export const selectUserDetailQuery = (schemaSupport: UserDetailSchemaSupport): string => {
  if (schemaSupport.hasStructuredPermissions && schemaSupport.hasAccountPermissionsTable) {
    return USER_DETAIL_QUERY;
  }

  if (!schemaSupport.hasAccountPermissionsTable) {
    throw new IamSchemaDriftError({
      message: 'IAM user detail query requires iam.account_permissions',
      operation: 'resolve_user_detail',
      schemaObject: 'iam.account_permissions',
      expectedMigration: '0014_iam_groups.sql',
    });
  }

  throw new IamSchemaDriftError({
    message: 'IAM user detail query requires structured permission columns',
    operation: 'resolve_user_detail',
    schemaObject: 'iam.permissions.action/resource_type/resource_id/effect/scope',
  });
};
