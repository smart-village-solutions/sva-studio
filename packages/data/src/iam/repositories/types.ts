import type {
  ContentAuthorPolicy,
  IamInstanceId,
  IamUuid,
  OrganizationMembershipVisibility,
  OrganizationType,
  PermissionEffect,
} from '../types';
import type { RoleManagedBy, RoleSyncState } from './role-sync-types';

type SqlArrayPrimitive = Readonly<{
  sqlType: 'uuid[]';
  values: readonly string[];
}>;

export type SqlPrimitive = string | number | boolean | null | SqlArrayPrimitive;

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
  upsertInstance(input: { id: IamInstanceId; displayName: string }): Promise<void>;
  upsertOrganization(input: {
    id: IamUuid;
    instanceId: IamInstanceId;
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
    instanceId: IamInstanceId;
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
    instanceId: IamInstanceId;
    permissionKey: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    effect?: PermissionEffect;
    scope?: Readonly<Record<string, unknown>>;
    description: string;
  }): Promise<void>;
  upsertAccount(input: {
    id: IamUuid;
    instanceId: IamInstanceId;
    keycloakSubject: string;
    emailCiphertext: string;
    displayNameCiphertext: string;
  }): Promise<void>;
  upsertInstanceMembership(input: {
    instanceId: IamInstanceId;
    accountId: IamUuid;
    membershipType: string;
  }): Promise<void>;
  assignAccountRole(input: { instanceId: IamInstanceId; accountId: IamUuid; roleId: IamUuid }): Promise<void>;
  assignAccountOrganization(input: {
    instanceId: IamInstanceId;
    accountId: IamUuid;
    organizationId: IamUuid;
    isDefaultContext?: boolean;
    membershipVisibility?: OrganizationMembershipVisibility;
  }): Promise<void>;
  assignRolePermission(input: { instanceId: IamInstanceId; roleId: IamUuid; permissionId: IamUuid }): Promise<void>;
};
