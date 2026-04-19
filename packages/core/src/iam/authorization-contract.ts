export type IamUuid = string;
export type IamInstanceId = string;

/**
 * Canonical IAM action identifier.
 *
 * Target model:
 * - Authorizable actions use the fully-qualified format `<namespace>.<actionName>`.
 * - This applies to both core actions (for example `content.read`) and plugin actions
 *   (for example `news.create`).
 * - Legacy short forms such as `read` or `write` may still exist during migration,
 *   but callers must not rely on implicit namespace mapping.
 */
export type IamAction = string;

export type IamResourceRef = {
  readonly type: string;
  readonly id?: string;
  readonly organizationId?: IamUuid;
  readonly attributes?: Readonly<Record<string, unknown>>;
};

export type AuthorizeRequest = {
  readonly instanceId: IamInstanceId;
  /**
   * Action to authorize.
   *
   * Target format is `<namespace>.<actionName>` without implicit remapping.
   * Examples:
   * - `content.read`
   * - `iam.users.manage`
   * - `news.create`
   */
  readonly action: IamAction;
  readonly resource: IamResourceRef;
  readonly context?: {
    readonly organizationId?: IamUuid;
    readonly requestId?: string;
    readonly traceId?: string;
    readonly actingAsUserId?: string;
    readonly attributes?: Readonly<Record<string, unknown>>;
  };
};

export const allowReasonCodes = ['allowed_by_rbac', 'allowed_by_abac'] as const;
export type AllowReasonCode = (typeof allowReasonCodes)[number];

export const denyReasonCodes = [
  'permission_missing',
  'instance_scope_mismatch',
  'context_attribute_missing',
  'abac_condition_unmet',
  'hierarchy_restriction',
  'policy_conflict_restrictive_wins',
  'geo_scope_mismatch',
  'group_restriction',
  'legal_acceptance_required',
] as const;
export type DenyReasonCode = (typeof denyReasonCodes)[number];

export type AuthorizeReasonCode = AllowReasonCode | DenyReasonCode;

export const iamApiErrorCodes = [
  'unauthorized',
  'invalid_request',
  'invalid_instance_id',
  'invalid_organization_id',
  'instance_scope_mismatch',
  'impersonation_not_active',
  'impersonation_expired',
  'database_unavailable',
  'legal_acceptance_required',
  'geo_depth_exceeded',
  'snapshot_integrity_error',
] as const;
export type IamApiErrorCode = (typeof iamApiErrorCodes)[number];

export type IamApiErrorResponse = {
  readonly error: IamApiErrorCode;
};

export type IamPermissionSourceKind = 'direct_user' | 'direct_role' | 'group_role';

export type IamPermissionProvenance = {
  readonly sourceKinds?: readonly IamPermissionSourceKind[];
  readonly inheritedFromOrganizationId?: IamUuid;
  readonly inheritedFromGeoUnitId?: IamUuid;
  readonly restrictedByGeoUnitId?: IamUuid;
};

export type SnapshotCacheStatus = 'hit' | 'miss' | 'recompute' | 'degraded' | 'warming' | 'empty';

export type AuthorizeResponse = {
  readonly allowed: boolean;
  readonly reason: AuthorizeReasonCode;
  readonly instanceId: IamInstanceId;
  readonly action: IamAction;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly evaluatedAt: string;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
  // Paket 4: Snapshot-Metadaten (optionale additive Felder)
  readonly snapshotVersion?: string;
  readonly cacheStatus?: SnapshotCacheStatus;
  readonly matchedPermissions?: readonly MatchedPermissionSummary[];
  readonly denialCode?: DenyReasonCode;
  readonly provenance?: IamPermissionProvenance;
};

export type MatchedPermissionSummary = {
  readonly action: IamAction;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly effect: IamPermissionEffect;
  readonly source: 'user' | 'role' | 'group' | 'delegation';
  readonly sourceId?: IamUuid;
  readonly sourceName?: string;
  readonly geoScope?: string;
};

export type IamPermissionEffect = 'allow' | 'deny';

export type EffectivePermission = {
  readonly action: IamAction;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly organizationId?: IamUuid;
  readonly effect?: IamPermissionEffect;
  readonly scope?: Readonly<Record<string, unknown>>;
  readonly sourceUserIds?: readonly IamUuid[];
  readonly sourceRoleIds?: readonly IamUuid[];
  readonly sourceGroupIds?: readonly IamUuid[];
  readonly groupName?: string;
  readonly geoScope?: string;
  readonly provenance?: IamPermissionProvenance;
};

export type MePermissionsRequest = {
  readonly instanceId: IamInstanceId;
  readonly organizationId?: IamUuid;
  readonly actingAsUserId?: string;
  readonly geoUnitId?: IamUuid;
  readonly geoHierarchy?: readonly IamUuid[];
};

export type MePermissionsSubject = {
  readonly actorUserId: string;
  readonly effectiveUserId: string;
  readonly isImpersonating: boolean;
};

export type MePermissionsResponse = {
  readonly instanceId: IamInstanceId;
  readonly organizationId?: IamUuid;
  readonly permissions: readonly EffectivePermission[];
  readonly subject: MePermissionsSubject;
  readonly evaluatedAt: string;
  readonly requestId?: string;
  readonly traceId?: string;
  // Paket 4: Snapshot-Metadaten
  readonly snapshotVersion?: string;
  readonly cacheStatus?: SnapshotCacheStatus;
  readonly provenance?: Readonly<{
    readonly hasDirectUserPermissions: boolean;
    readonly hasGroupDerivedPermissions: boolean;
    readonly hasGeoInheritance: boolean;
  }>;
};

// Paket 3: Gruppen-Kontrakt-Typen
export type IamGroupType = 'custom' | 'system' | 'geo' | 'org';

export type IamGroupListItem = {
  readonly id: IamUuid;
  readonly instanceId: IamInstanceId;
  readonly groupKey: string;
  readonly displayName: string;
  readonly description?: string;
  readonly groupType: IamGroupType;
  readonly isActive: boolean;
  readonly memberCount: number;
  readonly roleCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type IamGroupDetail = IamGroupListItem & {
  readonly assignedRoleIds: readonly IamUuid[];
  readonly memberships: readonly IamGroupMembership[];
};

export type IamGroupMembership = {
  readonly instanceId: IamInstanceId;
  readonly accountId: IamUuid;
  readonly groupId: IamUuid;
  readonly keycloakSubject: string;
  readonly displayName?: string;
  readonly validFrom?: string;
  readonly validUntil?: string;
  readonly assignedAt: string;
  readonly assignedByAccountId?: IamUuid;
};

// Paket 3: Geo-Kontrakt-Typen
export type IamGeoNodeType = 'country' | 'state' | 'district' | 'municipality' | 'locality';

export type IamGeoNode = {
  readonly id: IamUuid;
  readonly instanceId: IamInstanceId;
  readonly key: string;
  readonly displayName: string;
  readonly nodeType: IamGeoNodeType;
};

export type IamGeoHierarchyEntry = {
  readonly ancestorId: IamUuid;
  readonly descendantId: IamUuid;
  readonly depth: number;
};

// Paket 5: Legal-Text-Kontrakt-Typen
export type LegalAcceptanceActionType = 'accepted' | 'revoked' | 'prompted';

export type LegalConsentExportRecord = {
  readonly id: IamUuid;
  readonly workspaceId?: string;
  readonly subjectId: string;
  readonly legalTextId: string;
  readonly legalTextVersion: string;
  readonly actionType: LegalAcceptanceActionType;
  readonly acceptedAt: string;
  readonly revokedAt?: string;
};

export type ReadinessStatus = 'ready' | 'warming' | 'empty' | 'degraded' | 'failed';

export type HealthReadyResponse = {
  readonly status: 'ok' | 'degraded' | 'failed';
  readonly cacheStatus: ReadinessStatus;
  readonly checkedAt: string;
};

export type RuntimeDependencyStatus = 'ready' | 'degraded' | 'not_ready' | 'unknown';

export type RuntimeDependencyKey = 'authorizationCache' | 'database' | 'keycloak' | 'redis';

export type RuntimeDependencyHealth = {
  readonly reasonCode?: string;
  readonly status: RuntimeDependencyStatus;
};

export type RuntimeHealthServices = Readonly<Record<RuntimeDependencyKey, RuntimeDependencyHealth>>;

export type RuntimeHealthResponse = {
  readonly checks: {
    readonly authorizationCache: {
      readonly coldStart: boolean;
      readonly consecutiveRedisFailures: number;
      readonly lastRedisLatencyMs?: number;
      readonly recomputePerMinute: number;
      readonly status: ReadinessStatus;
    };
    readonly auth: {
      readonly realm?: string;
      readonly activeRealm?: string;
      readonly scopeKind?: 'platform' | 'instance';
      readonly login?: {
        readonly realm?: string;
        readonly clientId?: string;
        readonly configured: boolean;
      };
      readonly tenantAdmin?: {
        readonly realm?: string;
        readonly clientId?: string;
        readonly configured: boolean;
        readonly secretConfigured: boolean;
        readonly executionMode: 'tenant_admin';
        readonly fallbackToLoginClient: boolean;
      };
      readonly platformAdmin?: {
        readonly realm?: string;
        readonly clientId?: string;
        readonly configured: boolean;
        readonly executionMode: 'platform_admin';
      };
      readonly breakGlass?: {
        readonly realm?: string;
        readonly clientId?: string;
        readonly configured: boolean;
        readonly executionMode: 'break_glass';
      };
    };
    readonly db: boolean;
    readonly diagnostics?: Record<string, unknown>;
    readonly errors: Readonly<Record<string, string>>;
    readonly keycloak: boolean;
    readonly redis: boolean;
    readonly services: RuntimeHealthServices;
  };
  readonly path: string;
  readonly requestId?: string;
  readonly status: 'ready' | 'degraded' | 'not_ready';
  readonly timestamp: string;
};
