import type {
  IamUserDetail,
  IamUserDirectPermissionAssignment,
  IamUserPermissionTraceItem,
} from '@sva/core';

import { revealField } from './encryption.js';
import { mapUserRowToListItem } from './user-mapping.js';
import type {
  UserDetailDirectPermissionRow,
  UserDetailGroupRow,
  UserDetailPermissionTraceRow,
  UserDetailRoleRow,
  UserDetailRow,
} from './user-detail-query.types.js';
import { getManagedPermissionMetadata } from './managed-permissions.js';

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
  permissionRows: UserDetailDirectPermissionRow[] | null
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

const mapRuntimeScope = (entry: UserDetailPermissionTraceRow) =>
  getManagedPermissionMetadata(entry.permission_key)?.runtimeScope ??
  (entry.access_scope ? 'record' : 'instance');

const mapPermissionTraceScopeFields = (entry: UserDetailPermissionTraceRow) => ({
  resourceId: entry.resource_id ?? undefined,
  runtimeScope: mapRuntimeScope(entry),
  organizationId: entry.organization_id ?? undefined,
  scope: entry.scope ?? undefined,
  accessScope: entry.access_scope ?? undefined,
});

const mapPermissionTraceRoleFields = (entry: UserDetailPermissionTraceRow) => ({
  roleId: entry.role_id ?? undefined,
  roleKey: entry.role_key ?? undefined,
  roleName: entry.role_name ?? undefined,
});

const mapPermissionTraceGroupFields = (entry: UserDetailPermissionTraceRow) => ({
  groupId: entry.group_id ?? undefined,
  groupKey: entry.group_key ?? undefined,
  groupDisplayName: entry.group_display_name ?? undefined,
  groupActive: entry.group_active ?? undefined,
});

const mapPermissionTraceAssignmentFields = (entry: UserDetailPermissionTraceRow) => ({
  assignmentOrigin: entry.assignment_origin ?? undefined,
  inheritedFromOrganizationId: entry.inherited_from_organization_id ?? undefined,
  inheritedFromGeoUnitId: entry.inherited_from_geo_unit_id ?? undefined,
  restrictedByGeoUnitId: entry.restricted_by_geo_unit_id ?? undefined,
  inactiveReason: entry.inactive_reason ?? undefined,
});

const mapPermissionTraceValidityFields = (entry: UserDetailPermissionTraceRow) => ({
  validFrom: entry.valid_from ?? undefined,
  validTo: entry.valid_to ?? undefined,
});

const mapPermissionTraceRows = (
  permissionTraceRows: UserDetailPermissionTraceRow[] | null
): IamUserPermissionTraceItem[] =>
  permissionTraceRows?.map((entry) => ({
    permissionKey: entry.permission_key,
    action: entry.action,
    resourceType: entry.resource_type,
    ...mapPermissionTraceScopeFields(entry),
    effect: entry.effect,
    isEffective: entry.is_effective,
    status: entry.status,
    sourceKind: entry.source_kind,
    ...mapPermissionTraceRoleFields(entry),
    ...mapPermissionTraceGroupFields(entry),
    ...mapPermissionTraceAssignmentFields(entry),
    ...mapPermissionTraceValidityFields(entry),
  })) ?? [];

export const mapUserDetailRow = (row: UserDetailRow): IamUserDetail => {
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
