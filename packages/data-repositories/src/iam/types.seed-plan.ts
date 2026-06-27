import type { PermissionKey } from './types.permissions.js';
import type {
  ContentAuthorPolicy,
  GeoUnitType,
  GroupMembershipOrigin,
  GroupType,
  IamInstanceId,
  IamUuid,
  MfaPolicy,
  OrganizationType,
  PersonaKey,
  PersonaScope,
} from './types.shared.js';

type PersonaSeed = {
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

type IamSeedContext = {
  readonly instanceId: IamInstanceId;
  readonly organizationId: IamUuid;
  readonly organizationKey: string;
};

type IamSeedPlan = {
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
    readonly scope: Readonly<Record<string, unknown>>;
    readonly description: string;
  }[];
};

export type { IamSeedContext, IamSeedPlan, PersonaSeed };
