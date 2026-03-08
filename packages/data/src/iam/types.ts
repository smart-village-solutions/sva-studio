export type IamUuid = string;

export type PersonaKey =
  | 'system_admin'
  | 'app_manager'
  | 'feature_manager'
  | 'interface_manager'
  | 'designer'
  | 'editor'
  | 'moderator';

export type PersonaScope = 'instance' | 'org';
export type MfaPolicy = 'required' | 'recommended' | 'optional';
export type RoleSyncState = 'synced' | 'pending' | 'failed';
export type RoleManagedBy = 'studio' | 'external';
export type OrganizationType = 'county' | 'municipality' | 'district' | 'company' | 'agency' | 'other';
export type ContentAuthorPolicy = 'org_only' | 'org_or_personal';
export type OrganizationMembershipVisibility = 'internal' | 'external';

export type PermissionKey =
  | 'iam.user.read'
  | 'iam.user.write'
  | 'iam.role.read'
  | 'iam.role.write'
  | 'iam.org.read'
  | 'iam.org.write'
  | 'content.read'
  | 'content.create'
  | 'content.update'
  | 'content.publish'
  | 'content.moderate'
  | 'integration.manage'
  | 'feature.toggle';

export type PersonaSeed = {
  readonly personaKey: PersonaKey;
  readonly roleSlug: string;
  readonly roleLevel: number;
  readonly displayName: string;
  readonly scopeDefault: PersonaScope;
  readonly mfaPolicy: MfaPolicy;
  readonly permissionKeys: readonly PermissionKey[];
  readonly accountId: IamUuid;
  readonly keycloakSubject: string;
  readonly seedEmailPlaceholder: string;
  readonly seedDisplayNamePlaceholder: string;
};

export type IamSeedContext = {
  readonly instanceId: IamUuid;
  readonly instanceKey: string;
  readonly organizationId: IamUuid;
  readonly organizationKey: string;
};

export type IamSeedPlan = {
  readonly context: IamSeedContext;
  readonly organizations: readonly {
    readonly id: IamUuid;
    readonly organizationKey: string;
    readonly displayName: string;
    readonly organizationType: OrganizationType;
    readonly parentOrganizationId?: IamUuid;
    readonly hierarchyPath: readonly IamUuid[];
    readonly depth: number;
    readonly contentAuthorPolicy: ContentAuthorPolicy;
    readonly isActive: boolean;
    readonly metadata: Readonly<Record<string, unknown>>;
  }[];
  readonly personas: readonly PersonaSeed[];
  readonly permissions: readonly {
    readonly id: IamUuid;
    readonly key: PermissionKey;
    readonly description: string;
  }[];
};
