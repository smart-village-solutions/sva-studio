import type { IamUuid } from '../types';
import type { SqlStatement } from './types';
import type { RoleManagedBy, RoleSyncState } from './role-sync-types';

const asUuidArrayParameter = (values: readonly IamUuid[]) => ({
  sqlType: 'uuid[]' as const,
  values,
});

export const iamSeedStatements = {
  upsertInstance: (input: { id: IamUuid; instanceKey: string; displayName: string }): SqlStatement => ({
    text: `
INSERT INTO iam.instances (id, instance_key, display_name)
VALUES ($1, $2, $3)
ON CONFLICT (instance_key) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  updated_at = NOW();
`,
    values: [input.id, input.instanceKey, input.displayName],
  }),

  upsertOrganization: (input: {
    id: IamUuid;
    instanceId: IamUuid;
    organizationKey: string;
    displayName: string;
    metadata: string;
    organizationType: 'county' | 'municipality' | 'district' | 'company' | 'agency' | 'other';
    contentAuthorPolicy: 'org_only' | 'org_or_personal';
    parentOrganizationId?: IamUuid;
    hierarchyPath: readonly IamUuid[];
    depth: number;
    isActive?: boolean;
  }): SqlStatement => ({
    text: `
INSERT INTO iam.organizations (
  id,
  instance_id,
  organization_key,
  display_name,
  metadata,
  organization_type,
  content_author_policy,
  parent_organization_id,
  hierarchy_path,
  depth,
  is_active
)
VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9::uuid[], $10, $11)
ON CONFLICT (instance_id, organization_key) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  metadata = EXCLUDED.metadata,
  organization_type = EXCLUDED.organization_type,
  content_author_policy = EXCLUDED.content_author_policy,
  parent_organization_id = EXCLUDED.parent_organization_id,
  hierarchy_path = EXCLUDED.hierarchy_path,
  depth = EXCLUDED.depth,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
`,
    values: [
      input.id,
      input.instanceId,
      input.organizationKey,
      input.displayName,
      input.metadata,
      input.organizationType,
      input.contentAuthorPolicy,
      input.parentOrganizationId ?? null,
      asUuidArrayParameter(input.hierarchyPath),
      input.depth,
      input.isActive ?? true,
    ],
  }),

  upsertRole: (input: {
    id: IamUuid;
    instanceId: IamUuid;
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

  upsertPermission: (input: {
    id: IamUuid;
    instanceId: IamUuid;
    permissionKey: string;
    description: string;
  }): SqlStatement => ({
    text: `
INSERT INTO iam.permissions (id, instance_id, permission_key, description)
VALUES ($1, $2, $3, $4)
ON CONFLICT (instance_id, permission_key) DO UPDATE
SET
  description = EXCLUDED.description,
  updated_at = NOW();
`,
    values: [input.id, input.instanceId, input.permissionKey, input.description],
  }),

  upsertAccount: (input: {
    id: IamUuid;
    instanceId: IamUuid;
    keycloakSubject: string;
    emailCiphertext: string;
    displayNameCiphertext: string;
  }): SqlStatement => ({
    text: `
INSERT INTO iam.accounts (id, instance_id, keycloak_subject, email_ciphertext, display_name_ciphertext)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (keycloak_subject, instance_id) WHERE instance_id IS NOT NULL DO UPDATE
SET
  email_ciphertext = EXCLUDED.email_ciphertext,
  display_name_ciphertext = EXCLUDED.display_name_ciphertext,
  updated_at = NOW();
`,
    values: [input.id, input.instanceId, input.keycloakSubject, input.emailCiphertext, input.displayNameCiphertext],
  }),

  upsertInstanceMembership: (input: {
    instanceId: IamUuid;
    accountId: IamUuid;
    membershipType: string;
  }): SqlStatement => ({
    text: `
INSERT INTO iam.instance_memberships (instance_id, account_id, membership_type)
VALUES ($1, $2, $3)
ON CONFLICT (instance_id, account_id) DO UPDATE
SET
  membership_type = EXCLUDED.membership_type;
`,
    values: [input.instanceId, input.accountId, input.membershipType],
  }),

  assignAccountRole: (input: { instanceId: IamUuid; accountId: IamUuid; roleId: IamUuid }): SqlStatement => ({
    text: `
INSERT INTO iam.account_roles (instance_id, account_id, role_id)
VALUES ($1, $2, $3)
ON CONFLICT (instance_id, account_id, role_id) DO NOTHING;
`,
    values: [input.instanceId, input.accountId, input.roleId],
  }),

  assignAccountOrganization: (input: {
    instanceId: IamUuid;
    accountId: IamUuid;
    organizationId: IamUuid;
    isDefaultContext?: boolean;
    membershipVisibility?: 'internal' | 'external';
  }): SqlStatement => ({
    text: `
INSERT INTO iam.account_organizations (
  instance_id,
  account_id,
  organization_id,
  is_default_context,
  membership_visibility
)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (instance_id, account_id, organization_id) DO UPDATE
SET
  is_default_context = EXCLUDED.is_default_context,
  membership_visibility = EXCLUDED.membership_visibility;
`,
    values: [
      input.instanceId,
      input.accountId,
      input.organizationId,
      input.isDefaultContext ?? false,
      input.membershipVisibility ?? 'internal',
    ],
  }),

  assignRolePermission: (input: { instanceId: IamUuid; roleId: IamUuid; permissionId: IamUuid }): SqlStatement => ({
    text: `
INSERT INTO iam.role_permissions (instance_id, role_id, permission_id)
VALUES ($1, $2, $3)
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;
`,
    values: [input.instanceId, input.roleId, input.permissionId],
  }),
};
