import type { IamUuid } from './authorization-contract';

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
  | 'internal_error';

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
  readonly legalTextId: string;
  readonly legalTextVersion: string;
  readonly locale: string;
  readonly contentHash: string;
  readonly isActive: boolean;
  readonly publishedAt: string;
  readonly createdAt: string;
  readonly acceptanceCount: number;
  readonly activeAcceptanceCount: number;
  readonly lastAcceptedAt?: string;
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
