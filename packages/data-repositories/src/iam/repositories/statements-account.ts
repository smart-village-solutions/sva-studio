import type { IamInstanceId, IamUuid } from '../types.js';
import type { SqlStatement } from './types.js';

export const accountStatements = {
  upsertAccount: (input: {
    id: IamUuid;
    instanceId: IamInstanceId;
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
    instanceId: IamInstanceId;
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

  assignAccountRole: (input: { instanceId: IamInstanceId; accountId: IamUuid; roleId: IamUuid }): SqlStatement => ({
    text: `
INSERT INTO iam.account_roles (instance_id, account_id, role_id)
VALUES ($1, $2, $3)
ON CONFLICT (instance_id, account_id, role_id) DO NOTHING;
`,
    values: [input.instanceId, input.accountId, input.roleId],
  }),

  assignGroupRole: (input: { instanceId: IamInstanceId; groupId: IamUuid; roleId: IamUuid }): SqlStatement => ({
    text: `
INSERT INTO iam.group_roles (instance_id, group_id, role_id)
VALUES ($1, $2, $3)
ON CONFLICT (instance_id, group_id, role_id) DO NOTHING;
`,
    values: [input.instanceId, input.groupId, input.roleId],
  }),

  assignAccountGroup: (input: {
    instanceId: IamInstanceId;
    accountId: IamUuid;
    groupId: IamUuid;
    origin?: 'manual' | 'seed' | 'sync';
    validFrom?: string;
    validTo?: string;
  }): SqlStatement => ({
    text: `
INSERT INTO iam.account_groups (
  instance_id,
  account_id,
  group_id,
  origin,
  valid_from,
  valid_to
)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (instance_id, account_id, group_id) DO UPDATE
SET
  origin = EXCLUDED.origin,
  valid_from = EXCLUDED.valid_from,
  valid_to = EXCLUDED.valid_to;
`,
    values: [
      input.instanceId,
      input.accountId,
      input.groupId,
      input.origin ?? 'manual',
      input.validFrom ?? null,
      input.validTo ?? null,
    ],
  }),

  assignAccountOrganization: (input: {
    instanceId: IamInstanceId;
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

  assignRolePermission: (input: { instanceId: IamInstanceId; roleId: IamUuid; permissionId: IamUuid }): SqlStatement => ({
    text: `
INSERT INTO iam.role_permissions (instance_id, role_id, permission_id)
VALUES ($1, $2, $3)
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;
`,
    values: [input.instanceId, input.roleId, input.permissionId],
  }),
};
