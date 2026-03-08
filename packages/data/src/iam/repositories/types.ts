import type {
  ContentAuthorPolicy,
  IamUuid,
  OrganizationMembershipVisibility,
  OrganizationType,
} from '../types';

export type SqlPrimitive = string | number | boolean | null | readonly string[];
type RoleManagedBy = 'studio' | 'external';
type RoleSyncState = 'synced' | 'pending' | 'failed';

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
    organizationType: OrganizationType;
    contentAuthorPolicy: ContentAuthorPolicy;
    parentOrganizationId?: IamUuid;
    hierarchyPath: readonly IamUuid[];
    depth: number;
    isActive?: boolean;
  }): Promise<void>;
  upsertRole(input: {
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
    isDefaultContext?: boolean;
    membershipVisibility?: OrganizationMembershipVisibility;
  }): Promise<void>;
  assignRolePermission(input: { instanceId: IamUuid; roleId: IamUuid; permissionId: IamUuid }): Promise<void>;
};
