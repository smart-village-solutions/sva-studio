import type { IamInstanceId, IamUuid } from '../types.js';
import type { SqlStatement } from './types.js';
import type { RoleManagedBy, RoleSyncState } from './role-sync-types.js';

const defaultResourceType = (permissionKey: string) => permissionKey.split('.')[0] ?? permissionKey;

export const accessStatements = {
  upsertRole: (input: {
    id: IamUuid;
    instanceId: IamInstanceId;
    roleKey: string;
    roleName: string;
    description: string;
    isSystemRole: boolean;
    roleLevel: number;
    externalRoleName?: string;
    managedBy?: RoleManagedBy;
    syncState?: RoleSyncState;
  }): SqlStatement => ({
    text: `
INSERT INTO iam.roles (
  id,
  instance_id,
  role_key,
  role_name,
  display_name,
  external_role_name,
  description,
  is_system_role,
  role_level,
  managed_by,
  sync_state,
  last_synced_at,
  last_error_code
)
VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9, $10, NOW(), NULL)
ON CONFLICT (instance_id, role_key) DO UPDATE
SET
  role_name = EXCLUDED.role_name,
  display_name = EXCLUDED.display_name,
  external_role_name = EXCLUDED.external_role_name,
  description = EXCLUDED.description,
  is_system_role = EXCLUDED.is_system_role,
  role_level = EXCLUDED.role_level,
  managed_by = EXCLUDED.managed_by,
  sync_state = EXCLUDED.sync_state,
  last_synced_at = EXCLUDED.last_synced_at,
  last_error_code = NULL,
  updated_at = NOW();
`,
    values: [
      input.id,
      input.instanceId,
      input.roleKey,
      input.roleName,
      input.externalRoleName ?? input.roleKey,
      input.description,
      input.isSystemRole,
      input.roleLevel,
      input.managedBy ?? 'studio',
      input.syncState ?? 'pending',
    ],
  }),

  upsertGroup: (input: {
    id: IamUuid;
    instanceId: IamInstanceId;
    groupKey: string;
    displayName: string;
    description?: string;
    groupType?: 'role_bundle';
    isActive?: boolean;
  }): SqlStatement => ({
    text: `
INSERT INTO iam.groups (
  id,
  instance_id,
  group_key,
  display_name,
  description,
  group_type,
  is_active
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (instance_id, group_key) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  group_type = EXCLUDED.group_type,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
`,
    values: [
      input.id,
      input.instanceId,
      input.groupKey,
      input.displayName,
      input.description ?? null,
      input.groupType ?? 'role_bundle',
      input.isActive ?? true,
    ],
  }),

  upsertPermission: (input: {
    id: IamUuid;
    instanceId: IamInstanceId;
    permissionKey: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    scope?: Readonly<Record<string, unknown>>;
    description: string;
  }): SqlStatement => ({
    text: `
INSERT INTO iam.permissions (
  id,
  instance_id,
  permission_key,
  action,
  resource_type,
  resource_id,
  scope,
  description
)
VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
ON CONFLICT (instance_id, permission_key) DO UPDATE
SET
  action = EXCLUDED.action,
  resource_type = EXCLUDED.resource_type,
  resource_id = EXCLUDED.resource_id,
  scope = EXCLUDED.scope,
  description = EXCLUDED.description,
  updated_at = NOW();
`,
    values: [
      input.id, input.instanceId, input.permissionKey, input.action ?? input.permissionKey,
      input.resourceType ?? defaultResourceType(input.permissionKey), input.resourceId ?? null,
      JSON.stringify(input.scope ?? {}), input.description,
    ],
  }),
};
