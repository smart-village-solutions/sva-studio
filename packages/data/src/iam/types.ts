export type IamUuid = string;
export type IamInstanceId = string;

export type PersonaKey =
  | 'system_admin'
  | 'instance_registry_admin'
  | 'app_manager'
  | 'feature_manager'
  | 'interface_manager'
  | 'designer'
  | 'editor'
  | 'moderator';

type PersonaScope = 'instance' | 'org';
export type MfaPolicy = 'required' | 'recommended' | 'optional';
export type OrganizationType = 'county' | 'municipality' | 'district' | 'company' | 'agency' | 'other';
export type ContentAuthorPolicy = 'org_only' | 'org_or_personal';
export type OrganizationMembershipVisibility = 'internal' | 'external';
export type GroupType = 'role_bundle';
export type GroupMembershipOrigin = 'manual' | 'seed' | 'sync';
export type GeoUnitType = 'country' | 'state' | 'county' | 'municipality' | 'district' | 'custom';

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
  | 'feature.toggle'
  | 'instance.registry.manage';

export type PermissionEffect = 'allow' | 'deny';

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
  readonly instanceId: IamInstanceId;
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
  readonly groups?: readonly {
    readonly id: IamUuid;
    readonly groupKey: string;
    readonly displayName: string;
    readonly description?: string;
    readonly groupType: GroupType;
    readonly isActive: boolean;
    readonly roleIds: readonly IamUuid[];
    readonly memberAssignments?: readonly {
      readonly accountId: IamUuid;
      readonly origin: GroupMembershipOrigin;
      readonly validFrom?: string;
      readonly validTo?: string;
    }[];
  }[];
  readonly geoUnits?: readonly {
    readonly id: IamUuid;
    readonly geoKey: string;
    readonly displayName: string;
    readonly geoType: GeoUnitType;
    readonly parentGeoUnitId?: IamUuid;
    readonly hierarchyPath: readonly IamUuid[];
    readonly depth: number;
    readonly isActive: boolean;
    readonly metadata: Readonly<Record<string, unknown>>;
  }[];
  readonly personas: readonly PersonaSeed[];
  readonly permissions: readonly {
    readonly id: IamUuid;
    readonly key: PermissionKey;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId?: string;
    readonly effect: PermissionEffect;
    readonly scope: Readonly<Record<string, unknown>>;
    readonly description: string;
  }[];
};
