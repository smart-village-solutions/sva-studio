import type { IamUserDetail } from '@sva/core';
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
    valid_from: entry.valid_from,
    valid_to: entry.valid_to,
  })) ?? [];

const mapPermissionRows = (permissionRows: UserDetailRow['permission_rows']) =>
  permissionRows?.map((entry) => entry.permission_key) ?? [];

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
    groups: mapGroupRows(row.group_rows),
    mainserverUserApplicationSecretSet: false,
  };
};

export const resolveUserDetail = async (
  client: QueryClient,
  input: { instanceId: string; userId: string }
): Promise<IamUserDetail | undefined> => {
  try {
    const result = await client.query<UserDetailRow>(USER_DETAIL_QUERY, [input.instanceId, input.userId]);
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
