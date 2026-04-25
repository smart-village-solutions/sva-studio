import type {
  IamUserPermissionTraceStatus,
} from '@sva/core';

import type { UserStatus } from './types.js';

export type UserDetailRoleRow = {
  id: string;
  role_key: string;
  role_name: string;
  display_name: string | null;
  role_level: number;
  is_system_role: boolean;
  valid_from: string | null;
  valid_to: string | null;
};

export type UserDetailGroupRow = {
  id: string;
  group_key: string;
  display_name: string;
  group_type: 'role_bundle';
  origin: 'manual' | 'seed' | 'sync';
  valid_from: string | null;
  valid_to: string | null;
};

export type UserDetailDirectPermissionRow = {
  permission_id: string;
  permission_key: string;
  effect: 'allow' | 'deny';
  description: string | null;
};

export type UserDetailPermissionTraceRow = {
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
};

export type UserDetailRow = {
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
  direct_permission_rows: UserDetailDirectPermissionRow[] | null;
  permission_trace_rows: UserDetailPermissionTraceRow[] | null;
};

export type UserDetailSchemaSupportRow = {
  account_permissions_exists: boolean;
  permissions_action_exists: boolean;
  permissions_resource_type_exists: boolean;
  permissions_resource_id_exists: boolean;
  permissions_effect_exists: boolean;
  permissions_scope_exists: boolean;
};

export type UserDetailSchemaSupport = {
  hasAccountPermissionsTable: boolean;
  hasStructuredPermissions: boolean;
};
