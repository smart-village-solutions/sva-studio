import type { IamPermissionEffect, IamUuid } from './authorization-contract';

export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'invalid_request'
  | 'invalid_instance_id'
  | 'invalid_organization_id'
  | 'organization_inactive'
  | 'rate_limited'
  | 'csrf_validation_failed'
  | 'idempotency_key_required'
  | 'idempotency_key_reuse'
  | 'idempotency_in_progress'
  | 'keycloak_unavailable'
  | 'database_unavailable'
  | 'last_admin_protection'
  | 'self_protection'
  | 'feature_disabled'
  | 'conflict'
  | 'legal_acceptance_required'
  | 'reauth_required'
  | 'internal_error';

export type InstanceStatus =
  | 'requested'
  | 'validated'
  | 'provisioning'
  | 'active'
  | 'failed'
  | 'suspended'
  | 'archived';

export type ApiPagination = {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
};

export type ApiItemResponse<TItem> = {
  readonly data: TItem;
  readonly requestId?: string;
};

export type ApiListResponse<TItem> = {
  readonly data: readonly TItem[];
  readonly pagination: ApiPagination;
  readonly requestId?: string;
};

export type ApiErrorResponse = {
  readonly error: {
    readonly code: ApiErrorCode;
    readonly message: string;
    readonly details?: Readonly<Record<string, unknown>>;
  };
  readonly requestId?: string;
};

export type IamRoleSyncState = 'synced' | 'pending' | 'failed';

export type IamRoleSyncError = {
  readonly code: string;
};

export type IamGroupType = 'role_bundle';
export type IamGroupMembershipOrigin = 'manual' | 'seed' | 'sync';

export type IamUserRoleAssignment = {
  readonly roleId: IamUuid;
  readonly roleKey: string;
  readonly roleName: string;
  readonly roleLevel: number;
  readonly validFrom?: string;
  readonly validTo?: string;
};

export type IamUserGroupAssignment = {
  readonly accountId?: IamUuid;
  readonly groupId: IamUuid;
  readonly groupKey: string;
  readonly displayName: string;
  readonly groupType: IamGroupType;
  readonly origin: IamGroupMembershipOrigin;
  readonly validFrom?: string;
  readonly validTo?: string;
};

export type IamUserDirectPermissionAssignment = {
  readonly permissionId: IamUuid;
  readonly permissionKey: string;
  readonly effect: IamPermissionEffect;
  readonly description?: string;
};

export type IamUserPermissionTraceSourceKind = 'direct_permission' | 'direct_role' | 'group_role';
export type IamUserPermissionTraceStatus = 'effective' | 'inactive' | 'expired' | 'disabled';

export type IamUserPermissionTraceItem = {
  readonly permissionKey: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly organizationId?: IamUuid;
  readonly effect: IamPermissionEffect;
  readonly scope?: Readonly<Record<string, unknown>>;
  readonly isEffective: boolean;
  readonly status: IamUserPermissionTraceStatus;
  readonly sourceKind: IamUserPermissionTraceSourceKind;
  readonly roleId?: IamUuid;
  readonly roleKey?: string;
  readonly roleName?: string;
  readonly groupId?: IamUuid;
  readonly groupKey?: string;
  readonly groupDisplayName?: string;
  readonly groupActive?: boolean;
  readonly assignmentOrigin?: IamGroupMembershipOrigin;
  readonly validFrom?: string;
  readonly validTo?: string;
};

export type IamUserListItem = {
  readonly id: IamUuid;
  readonly keycloakSubject: string;
  readonly displayName: string;
  readonly email?: string;
  readonly status: 'active' | 'inactive' | 'pending';
  readonly position?: string;
  readonly department?: string;
  readonly lastLoginAt?: string;
  readonly roles: readonly IamUserRoleAssignment[];
};

export type IamUserDetail = IamUserListItem & {
  readonly username?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly phone?: string;
  readonly preferredLanguage?: string;
  readonly timezone?: string;
  readonly avatarUrl?: string;
  readonly notes?: string;
  readonly permissions?: readonly string[];
  readonly directPermissions?: readonly IamUserDirectPermissionAssignment[];
  readonly permissionTrace?: readonly IamUserPermissionTraceItem[];
  readonly groups?: readonly IamUserGroupAssignment[];
  readonly mainserverUserApplicationId?: string;
  readonly mainserverUserApplicationSecretSet: boolean;
};

export type IamUserImportSyncReport = {
  readonly importedCount: number;
  readonly updatedCount: number;
  readonly skippedCount: number;
  readonly totalKeycloakUsers: number;
};

export type IamRoleListItem = {
  readonly id: IamUuid;
  readonly roleKey: string;
  readonly roleName: string;
  readonly externalRoleName: string;
  readonly managedBy: 'studio' | 'external';
  readonly description?: string;
  readonly isSystemRole: boolean;
  readonly roleLevel: number;
  readonly memberCount: number;
  readonly syncState: IamRoleSyncState;
  readonly lastSyncedAt?: string;
  readonly syncError?: IamRoleSyncError;
  readonly permissions: readonly {
    readonly id: IamUuid;
    readonly permissionKey: string;
    readonly description?: string;
  }[];
};

export type IamGroupListItem = {
  readonly id: IamUuid;
  readonly groupKey: string;
  readonly displayName: string;
  readonly description?: string;
  readonly groupType: IamGroupType;
  readonly isActive: boolean;
  readonly memberCount: number;
  readonly roles: readonly {
    readonly roleId: IamUuid;
    readonly roleKey: string;
    readonly roleName: string;
  }[];
};

export type IamGroupDetail = IamGroupListItem & {
  readonly members: readonly IamUserGroupAssignment[];
};

export type IamLegalTextListItem = {
  readonly id: IamUuid;
  readonly name: string;
  readonly legalTextVersion: string;
  readonly locale: string;
  readonly contentHtml: string;
  readonly status: 'draft' | 'valid' | 'archived';
  readonly publishedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly acceptanceCount: number;
  readonly activeAcceptanceCount: number;
  readonly lastAcceptedAt?: string;
};

export type IamPendingLegalTextItem = {
  readonly id: IamUuid;
  readonly legalTextId: string;
  readonly name: string;
  readonly legalTextVersion: string;
  readonly locale: string;
  readonly contentHtml: string;
  readonly publishedAt?: string;
};

export type IamOrganizationType =
  | 'county'
  | 'municipality'
  | 'district'
  | 'company'
  | 'agency'
  | 'other';

export type IamContentAuthorPolicy = 'org_only' | 'org_or_personal';

export type IamOrganizationMembershipVisibility = 'internal' | 'external';

export type IamOrganizationListItem = {
  readonly id: IamUuid;
  readonly organizationKey: string;
  readonly displayName: string;
  readonly parentOrganizationId?: IamUuid;
  readonly parentDisplayName?: string;
  readonly organizationType: IamOrganizationType;
  readonly contentAuthorPolicy: IamContentAuthorPolicy;
  readonly isActive: boolean;
  readonly depth: number;
  readonly hierarchyPath: readonly IamUuid[];
  readonly childCount: number;
  readonly membershipCount: number;
};

export type IamOrganizationMembership = {
  readonly accountId: IamUuid;
  readonly keycloakSubject: string;
  readonly displayName: string;
  readonly email?: string;
  readonly visibility: IamOrganizationMembershipVisibility;
  readonly isDefaultContext: boolean;
  readonly createdAt: string;
};

export type IamInstanceProvisioningOperation = 'create' | 'activate' | 'suspend' | 'archive';

export type IamInstanceProvisioningRun = {
  readonly id: string;
  readonly instanceId: string;
  readonly operation: IamInstanceProvisioningOperation;
  readonly status: InstanceStatus;
  readonly stepKey?: string;
  readonly idempotencyKey: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly requestId?: string;
  readonly actorId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type IamInstanceAuditEvent = {
  readonly id: string;
  readonly instanceId: string;
  readonly eventType: string;
  readonly actorId?: string;
  readonly requestId?: string;
  readonly details: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
};

export type IamInstanceListItem = {
  readonly instanceId: string;
  readonly displayName: string;
  readonly status: InstanceStatus;
  readonly parentDomain: string;
  readonly primaryHostname: string;
  readonly authRealm: string;
  readonly authClientId: string;
  readonly authIssuerUrl?: string;
  readonly themeKey?: string;
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly mainserverConfigRef?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly latestProvisioningRun?: IamInstanceProvisioningRun;
};

export type IamInstanceDetail = IamInstanceListItem & {
  readonly hostnames: readonly {
    readonly hostname: string;
    readonly isPrimary: boolean;
    readonly createdAt: string;
  }[];
  readonly provisioningRuns: readonly IamInstanceProvisioningRun[];
  readonly auditEvents: readonly IamInstanceAuditEvent[];
};

export type IamOrganizationChildItem = {
  readonly id: IamUuid;
  readonly organizationKey: string;
  readonly displayName: string;
  readonly isActive: boolean;
};

export type IamOrganizationDetail = IamOrganizationListItem & {
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly memberships: readonly IamOrganizationMembership[];
  readonly children: readonly IamOrganizationChildItem[];
};

export type IamOrganizationContextOption = {
  readonly organizationId: IamUuid;
  readonly organizationKey: string;
  readonly displayName: string;
  readonly organizationType: IamOrganizationType;
  readonly isActive: boolean;
  readonly isDefaultContext: boolean;
};

export type IamOrganizationContext = {
  readonly activeOrganizationId?: IamUuid;
  readonly organizations: readonly IamOrganizationContextOption[];
};
