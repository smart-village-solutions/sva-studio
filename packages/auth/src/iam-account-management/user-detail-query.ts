import type {
  IamUserDetail,
  IamUserDirectPermissionAssignment,
  IamUserPermissionTraceItem,
  IamUserPermissionTraceStatus,
} from '@sva/core';
import { createSdkLogger } from '@sva/sdk/server';

import type { QueryClient } from '../shared/db-helpers.js';

import { revealField } from './encryption.js';
import type { UserStatus } from './types.js';
import { mapUserRowToListItem } from './user-mapping.js';

const logger = createSdkLogger({ component: 'iam-user-detail-query', level: 'info' });

type UserDetailRoleRow = {
  id: string;
  role_key: string;
  role_name: string;
  display_name: string | null;
  role_level: number;
  is_system_role: boolean;
  valid_from: string | null;
  valid_to: string | null;
};

type UserDetailGroupRow = {
  id: string;
  group_key: string;
  display_name: string;
  group_type: 'role_bundle';
  origin: 'manual' | 'seed' | 'sync';
  valid_from: string | null;
  valid_to: string | null;
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
  group_rows: UserDetailGroupRow[] | null;
  permission_rows: Array<{ permission_key: string }> | null;
  direct_permission_rows:
    | Array<{
        permission_id: string;
        permission_key: string;
        effect: 'allow' | 'deny';
        description: string | null;
      }>
    | null;
  permission_trace_rows:
    | Array<{
        permission_key: string;
        action: string;
        resource_type: string;
        resource_id: string | null;
        organization_id: string | null;
        effect: 'allow' | 'deny';
        scope: Record<string, unknown> | null;
        is_effective: boolean;
        status: IamUserPermissionTraceStatus;
        source_kind: 'direct_permission' | 'direct_role' | 'group_role';
        role_id: string | null;
        role_key: string | null;
        role_name: string | null;
        group_id: string | null;
        group_key: string | null;
        group_display_name: string | null;
        group_active: boolean | null;
        assignment_origin: 'manual' | 'seed' | 'sync' | null;
        valid_from: string | null;
        valid_to: string | null;
      }>
    | null;
};

type AccountPermissionsTableCheckRow = {
  exists: boolean;
};

type UserDetailSchemaSupportRow = {
  account_permissions_exists: boolean;
  permissions_action_exists: boolean;
  permissions_resource_type_exists: boolean;
  permissions_resource_id_exists: boolean;
  permissions_effect_exists: boolean;
  permissions_scope_exists: boolean;
};

const DIRECT_PERMISSION_KEYS_SQL = `
        UNION

        SELECT p.permission_key
        FROM iam.account_permissions ap
        JOIN iam.permissions p
          ON p.instance_id = ap.instance_id
         AND p.id = ap.permission_id
        WHERE ap.instance_id = im.instance_id
          AND ap.account_id = im.account_id
`;

const DIRECT_PERMISSION_ROWS_SQL = `
  COALESCE(
    (
      SELECT json_agg(
        DISTINCT jsonb_build_object(
          'permission_id', direct.permission_id,
          'permission_key', direct.permission_key,
          'effect', direct.effect,
          'description', direct.description
        )
      )
      FROM (
        SELECT
          p.id AS permission_id,
          p.permission_key,
          ap.effect,
          p.description
        FROM iam.account_permissions ap
        JOIN iam.permissions p
          ON p.instance_id = ap.instance_id
         AND p.id = ap.permission_id
        WHERE ap.instance_id = im.instance_id
          AND ap.account_id = im.account_id
      ) AS direct
    ),
    '[]'::json
  ) AS direct_permission_rows,
`;

const EMPTY_DIRECT_PERMISSION_ROWS_SQL = `
  '[]'::json AS direct_permission_rows,
`;

const buildPermissionProjection = (includeStructuredPermissions: boolean) =>
  includeStructuredPermissions
    ? {
        action: `COALESCE(p.action, p.permission_key)`,
        resourceType: `COALESCE(p.resource_type, split_part(p.permission_key, '.', 1))`,
        resourceId: `p.resource_id::text`,
        effect: `COALESCE(p.effect, 'allow')`,
        scope: `p.scope`,
      }
    : {
        action: `p.permission_key`,
        resourceType: `split_part(p.permission_key, '.', 1)`,
        resourceId: `NULL::text`,
        effect: `'allow'::text`,
        scope: `NULL::jsonb`,
      };

const buildDirectPermissionTraceSql = (includeStructuredPermissions: boolean) => {
  const projection = buildPermissionProjection(includeStructuredPermissions);
  return `

        UNION ALL

        SELECT
          p.permission_key,
          ${projection.action} AS action,
          ${projection.resourceType} AS resource_type,
          ${projection.resourceId} AS resource_id,
          NULL::text AS organization_id,
          ap.effect,
          ${projection.scope} AS scope,
          TRUE AS is_effective,
          'effective'::text AS status,
          'direct_permission'::text AS source_kind,
          NULL::text AS role_id,
          NULL::text AS role_key,
          NULL::text AS role_name,
          NULL::text AS group_id,
          NULL::text AS group_key,
          NULL::text AS group_display_name,
          NULL::boolean AS group_active,
          NULL::text AS assignment_origin,
          NULL::text AS valid_from,
          NULL::text AS valid_to
        FROM iam.account_permissions ap
        JOIN iam.permissions p
          ON p.instance_id = ap.instance_id
         AND p.id = ap.permission_id
        WHERE ap.instance_id = im.instance_id
          AND ap.account_id = im.account_id
`;
};

const buildUserDetailQuery = (includeDirectPermissions: boolean, includeStructuredPermissions: boolean): string => `
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
  COALESCE(
    (
      SELECT json_agg(
        DISTINCT jsonb_build_object(
          'permission_key', trace.permission_key
        )
      )
      FROM (
        SELECT p.permission_key
        FROM iam.account_roles ar
        JOIN iam.roles r
          ON r.instance_id = ar.instance_id
         AND r.id = ar.role_id
        JOIN iam.role_permissions rp
          ON rp.instance_id = r.instance_id
         AND rp.role_id = r.id
        JOIN iam.permissions p
          ON p.instance_id = rp.instance_id
         AND p.id = rp.permission_id
        WHERE ar.instance_id = im.instance_id
          AND ar.account_id = im.account_id
          AND ar.valid_from <= NOW()
          AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
${includeDirectPermissions ? DIRECT_PERMISSION_KEYS_SQL : ''}

        UNION

        SELECT p.permission_key
        FROM iam.account_groups ag
        JOIN iam.groups g
          ON g.instance_id = ag.instance_id
         AND g.id = ag.group_id
         AND g.is_active = true
        JOIN iam.group_roles gr
          ON gr.instance_id = ag.instance_id
         AND gr.group_id = ag.group_id
        JOIN iam.roles r
          ON r.instance_id = gr.instance_id
         AND r.id = gr.role_id
        JOIN iam.role_permissions rp
          ON rp.instance_id = r.instance_id
         AND rp.role_id = r.id
        JOIN iam.permissions p
          ON p.instance_id = rp.instance_id
         AND p.id = rp.permission_id
        WHERE ag.instance_id = im.instance_id
          AND ag.account_id = im.account_id
          AND (ag.valid_from IS NULL OR ag.valid_from <= NOW())
          AND (ag.valid_until IS NULL OR ag.valid_until > NOW())

      ) AS trace
    ),
    '[]'::json
  ) AS permission_rows,
${includeDirectPermissions ? DIRECT_PERMISSION_ROWS_SQL : EMPTY_DIRECT_PERMISSION_ROWS_SQL}
  COALESCE(
    (
      SELECT json_agg(
        DISTINCT jsonb_build_object(
          'permission_key', trace.permission_key,
          'action', trace.action,
          'resource_type', trace.resource_type,
          'resource_id', trace.resource_id,
          'organization_id', trace.organization_id,
          'effect', trace.effect,
          'scope', trace.scope,
          'is_effective', trace.is_effective,
          'status', trace.status,
          'source_kind', trace.source_kind,
          'role_id', trace.role_id,
          'role_key', trace.role_key,
          'role_name', trace.role_name,
          'group_id', trace.group_id,
          'group_key', trace.group_key,
          'group_display_name', trace.group_display_name,
          'group_active', trace.group_active,
          'assignment_origin', trace.assignment_origin,
          'valid_from', trace.valid_from,
          'valid_to', trace.valid_to
        )
      )
      FROM (
        SELECT
          p.permission_key,
          ${buildPermissionProjection(includeStructuredPermissions).action} AS action,
          ${buildPermissionProjection(includeStructuredPermissions).resourceType} AS resource_type,
          ${buildPermissionProjection(includeStructuredPermissions).resourceId} AS resource_id,
          ao.organization_id::text AS organization_id,
          ${buildPermissionProjection(includeStructuredPermissions).effect} AS effect,
          ${buildPermissionProjection(includeStructuredPermissions).scope} AS scope,
          (ar.valid_from <= NOW() AND (ar.valid_to IS NULL OR ar.valid_to > NOW())) AS is_effective,
          CASE
            WHEN ar.valid_from > NOW() THEN 'inactive'
            WHEN ar.valid_to IS NOT NULL AND ar.valid_to <= NOW() THEN 'expired'
            ELSE 'effective'
          END::text AS status,
          'direct_role'::text AS source_kind,
          r.id::text AS role_id,
          r.role_key,
          r.role_name,
          NULL::text AS group_id,
          NULL::text AS group_key,
          NULL::text AS group_display_name,
          NULL::boolean AS group_active,
          NULL::text AS assignment_origin,
          ar.valid_from::text,
          ar.valid_to::text
        FROM iam.account_roles ar
        JOIN iam.roles r
          ON r.instance_id = ar.instance_id
         AND r.id = ar.role_id
        JOIN iam.role_permissions rp
          ON rp.instance_id = r.instance_id
         AND rp.role_id = r.id
        JOIN iam.permissions p
          ON p.instance_id = rp.instance_id
         AND p.id = rp.permission_id
        LEFT JOIN iam.account_organizations ao
          ON ao.instance_id = ar.instance_id
         AND ao.account_id = ar.account_id
        WHERE ar.instance_id = im.instance_id
          AND ar.account_id = im.account_id

        UNION ALL

        SELECT
          p.permission_key,
          ${buildPermissionProjection(includeStructuredPermissions).action} AS action,
          ${buildPermissionProjection(includeStructuredPermissions).resourceType} AS resource_type,
          ${buildPermissionProjection(includeStructuredPermissions).resourceId} AS resource_id,
          ao.organization_id::text AS organization_id,
          ${buildPermissionProjection(includeStructuredPermissions).effect} AS effect,
          ${buildPermissionProjection(includeStructuredPermissions).scope} AS scope,
          (
            g.is_active = true
            AND (ag.valid_from IS NULL OR ag.valid_from <= NOW())
            AND (ag.valid_until IS NULL OR ag.valid_until > NOW())
          ) AS is_effective,
          CASE
            WHEN g.is_active IS NOT TRUE THEN 'disabled'
            WHEN ag.valid_from IS NOT NULL AND ag.valid_from > NOW() THEN 'inactive'
            WHEN ag.valid_until IS NOT NULL AND ag.valid_until <= NOW() THEN 'expired'
            ELSE 'effective'
          END::text AS status,
          'group_role'::text AS source_kind,
          r.id::text AS role_id,
          r.role_key,
          r.role_name,
          g.id::text AS group_id,
          g.group_key,
          g.display_name AS group_display_name,
          g.is_active AS group_active,
          ag.origin::text AS assignment_origin,
          ag.valid_from::text,
          ag.valid_until::text AS valid_to
        FROM iam.account_groups ag
        JOIN iam.groups g
          ON g.instance_id = ag.instance_id
         AND g.id = ag.group_id
        JOIN iam.group_roles gr
          ON gr.instance_id = ag.instance_id
         AND gr.group_id = ag.group_id
        JOIN iam.roles r
          ON r.instance_id = gr.instance_id
         AND r.id = gr.role_id
        JOIN iam.role_permissions rp
          ON rp.instance_id = r.instance_id
         AND rp.role_id = r.id
        JOIN iam.permissions p
          ON p.instance_id = rp.instance_id
         AND p.id = rp.permission_id
        LEFT JOIN iam.account_organizations ao
          ON ao.instance_id = ag.instance_id
         AND ao.account_id = ag.account_id
        WHERE ag.instance_id = im.instance_id
          AND ag.account_id = im.account_id
${includeDirectPermissions ? buildDirectPermissionTraceSql(includeStructuredPermissions) : ''}
      ) AS trace
    ),
    '[]'::json
  ) AS permission_trace_rows
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

const USER_DETAIL_QUERY = buildUserDetailQuery(true, true);
const USER_DETAIL_QUERY_NO_DIRECT_PERMISSIONS = buildUserDetailQuery(false, true);
const USER_DETAIL_QUERY_LEGACY = buildUserDetailQuery(false, false);
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

const readUserDetailSchemaSupport = async (
  client: QueryClient
): Promise<{ hasAccountPermissionsTable: boolean; hasStructuredPermissions: boolean }> => {
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

const mapRoleRows = (roleRows: UserDetailRoleRow[] | null) =>
  roleRows?.map((entry) => ({
    id: entry.id,
    role_key: entry.role_key,
    role_name: entry.role_name,
    display_name: entry.display_name,
    role_level: Number(entry.role_level),
    is_system_role: Boolean(entry.is_system_role),
    valid_from: entry.valid_from,
    valid_to: entry.valid_to,
  })) ?? [];

const mapPermissionRows = (permissionRows: UserDetailRow['permission_rows']) =>
  permissionRows?.map((entry) => entry.permission_key) ?? [];

const mapDirectPermissionRows = (
  permissionRows: UserDetailRow['direct_permission_rows']
): IamUserDirectPermissionAssignment[] =>
  permissionRows?.map((entry) => ({
    permissionId: entry.permission_id,
    permissionKey: entry.permission_key,
    effect: entry.effect,
    ...(entry.description ? { description: entry.description } : {}),
  })) ?? [];

const mapGroupRows = (groupRows: UserDetailGroupRow[] | null) =>
  groupRows?.map((entry) => ({
    groupId: entry.id,
    groupKey: entry.group_key,
    displayName: entry.display_name,
    groupType: entry.group_type,
    origin: entry.origin,
    validFrom: entry.valid_from ?? undefined,
    validTo: entry.valid_to ?? undefined,
  })) ?? [];

const mapPermissionTraceRows = (
  permissionTraceRows: UserDetailRow['permission_trace_rows']
): IamUserPermissionTraceItem[] =>
  permissionTraceRows?.map((entry) => ({
    permissionKey: entry.permission_key,
    action: entry.action,
    resourceType: entry.resource_type,
    resourceId: entry.resource_id ?? undefined,
    organizationId: entry.organization_id ?? undefined,
    effect: entry.effect,
    scope: entry.scope ?? undefined,
    isEffective: entry.is_effective,
    status: entry.status,
    sourceKind: entry.source_kind,
    roleId: entry.role_id ?? undefined,
    roleKey: entry.role_key ?? undefined,
    roleName: entry.role_name ?? undefined,
    groupId: entry.group_id ?? undefined,
    groupKey: entry.group_key ?? undefined,
    groupDisplayName: entry.group_display_name ?? undefined,
    groupActive: entry.group_active ?? undefined,
    assignmentOrigin: entry.assignment_origin ?? undefined,
    validFrom: entry.valid_from ?? undefined,
    validTo: entry.valid_to ?? undefined,
  })) ?? [];

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
    directPermissions: mapDirectPermissionRows(row.direct_permission_rows),
    permissionTrace: mapPermissionTraceRows(row.permission_trace_rows),
    groups: mapGroupRows(row.group_rows),
    mainserverUserApplicationSecretSet: false,
  };
};

export const resolveUserDetail = async (
  client: QueryClient,
  input: { instanceId: string; userId: string }
): Promise<IamUserDetail | undefined> => {
  try {
    const schemaSupport = await readUserDetailSchemaSupport(client);
    if (!schemaSupport.hasAccountPermissionsTable) {
      logger.warn('IAM user detail query fell back to legacy schema without direct permissions', {
        operation: 'resolve_user_detail',
        instance_id: input.instanceId,
        user_id: input.userId,
        missing_schema_object: 'iam.account_permissions',
      });
    }
    if (!schemaSupport.hasStructuredPermissions) {
      logger.warn('IAM user detail query fell back to legacy permission projection', {
        operation: 'resolve_user_detail',
        instance_id: input.instanceId,
        user_id: input.userId,
        missing_schema_object: 'iam.permissions.action/resource_type/resource_id/effect/scope',
      });
    }
    const detailQuery =
      schemaSupport.hasStructuredPermissions && schemaSupport.hasAccountPermissionsTable
        ? USER_DETAIL_QUERY
        : schemaSupport.hasStructuredPermissions
          ? USER_DETAIL_QUERY_NO_DIRECT_PERMISSIONS
          : USER_DETAIL_QUERY_LEGACY;
    const result = await client.query<UserDetailRow>(detailQuery, [input.instanceId, input.userId]);
    const row = result.rows[0];
    if (!row) {
      logger.info('IAM user detail query returned no row', {
        operation: 'resolve_user_detail',
        instance_id: input.instanceId,
        user_id: input.userId,
      });
      return undefined;
    }

    try {
      return mapUserDetailRow(row);
    } catch (error) {
      logger.error('IAM user detail mapping failed', {
        operation: 'resolve_user_detail',
        instance_id: input.instanceId,
        user_id: input.userId,
        keycloak_subject: row.keycloak_subject,
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        error: error instanceof Error ? error.message : String(error),
        error_stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  } catch (error) {
    logger.error('IAM user detail query failed', {
      operation: 'resolve_user_detail',
      instance_id: input.instanceId,
      user_id: input.userId,
      error_type: error instanceof Error ? error.constructor.name : typeof error,
      error: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};
