import type { IamUuid } from './types';

export type SqlPrimitive = string | number | boolean | null;

export type SqlStatement = {
  readonly text: string;
  readonly values: readonly SqlPrimitive[];
};

export type SqlExecutionResult<TRow = Record<string, unknown>> = {
  readonly rowCount: number;
  readonly rows: readonly TRow[];
};

export type SqlExecutor = {
  execute<TRow = Record<string, unknown>>(statement: SqlStatement): Promise<SqlExecutionResult<TRow>>;
};

export type IamSeedRepository = {
  upsertInstance(input: { id: IamUuid; instanceKey: string; displayName: string }): Promise<void>;
  upsertOrganization(input: {
    id: IamUuid;
    instanceId: IamUuid;
    organizationKey: string;
    displayName: string;
    metadata: string;
  }): Promise<void>;
  upsertRole(input: {
    id: IamUuid;
    instanceId: IamUuid;
    roleName: string;
    description: string;
    isSystemRole: boolean;
    roleLevel: number;
  }): Promise<void>;
  upsertPermission(input: {
    id: IamUuid;
    instanceId: IamUuid;
    permissionKey: string;
    description: string;
  }): Promise<void>;
  upsertAccount(input: {
    id: IamUuid;
    instanceId: IamUuid;
    keycloakSubject: string;
    emailCiphertext: string;
    displayNameCiphertext: string;
  }): Promise<void>;
  upsertInstanceMembership(input: {
    instanceId: IamUuid;
    accountId: IamUuid;
    membershipType: string;
  }): Promise<void>;
  assignAccountRole(input: { instanceId: IamUuid; accountId: IamUuid; roleId: IamUuid }): Promise<void>;
  assignAccountOrganization(input: {
    instanceId: IamUuid;
    accountId: IamUuid;
    organizationId: IamUuid;
  }): Promise<void>;
  assignRolePermission(input: { instanceId: IamUuid; roleId: IamUuid; permissionId: IamUuid }): Promise<void>;
};

const statements = {
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
  }): SqlStatement => ({
    text: `
INSERT INTO iam.organizations (id, instance_id, organization_key, display_name, metadata)
VALUES ($1, $2, $3, $4, $5::jsonb)
ON CONFLICT (instance_id, organization_key) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();
`,
    values: [input.id, input.instanceId, input.organizationKey, input.displayName, input.metadata],
  }),

  upsertRole: (input: {
    id: IamUuid;
    instanceId: IamUuid;
    roleName: string;
    description: string;
    isSystemRole: boolean;
    roleLevel: number;
  }): SqlStatement => ({
    text: `
INSERT INTO iam.roles (id, instance_id, role_name, description, is_system_role, role_level)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (instance_id, role_name) DO UPDATE
SET
  description = EXCLUDED.description,
  is_system_role = EXCLUDED.is_system_role,
  role_level = EXCLUDED.role_level,
  updated_at = NOW();
`,
    values: [input.id, input.instanceId, input.roleName, input.description, input.isSystemRole, input.roleLevel],
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
  }): SqlStatement => ({
    text: `
INSERT INTO iam.account_organizations (instance_id, account_id, organization_id)
VALUES ($1, $2, $3)
ON CONFLICT (instance_id, account_id, organization_id) DO NOTHING;
`,
    values: [input.instanceId, input.accountId, input.organizationId],
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

export const createIamSeedRepository = (executor: SqlExecutor): IamSeedRepository => ({
  async upsertInstance(input) {
    await executor.execute(statements.upsertInstance(input));
  },
  async upsertOrganization(input) {
    await executor.execute(statements.upsertOrganization(input));
  },
  async upsertRole(input) {
    await executor.execute(statements.upsertRole(input));
  },
  async upsertPermission(input) {
    await executor.execute(statements.upsertPermission(input));
  },
  async upsertAccount(input) {
    await executor.execute(statements.upsertAccount(input));
  },
  async upsertInstanceMembership(input) {
    await executor.execute(statements.upsertInstanceMembership(input));
  },
  async assignAccountRole(input) {
    await executor.execute(statements.assignAccountRole(input));
  },
  async assignAccountOrganization(input) {
    await executor.execute(statements.assignAccountOrganization(input));
  },
  async assignRolePermission(input) {
    await executor.execute(statements.assignRolePermission(input));
  },
});

export const iamSeedStatements = statements;
