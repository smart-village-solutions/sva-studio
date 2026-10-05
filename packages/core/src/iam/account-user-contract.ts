import type { IamRolePermissionAssignmentScope, IamUuid } from '@sva/iam-core';
import type { IamPermissionRuntimeScope } from './account-management.js';
import type {
  IamKeycloakMappingStatus,
  IamKeycloakObjectDiagnostic,
  IamKeycloakObjectEditability,
  IamKeycloakUserFieldEditability,
} from './account-keycloak-contract.js';
import type { IamUserOrganizationMembership } from './account-organization-contract.js';

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
  readonly editability?: IamKeycloakObjectEditability;
  readonly diagnostics?: readonly IamKeycloakObjectDiagnostic[];
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

export type IamUserPermissionTraceSourceKind = 'direct_role' | 'group_role';
export type IamUserPermissionTraceStatus = 'effective' | 'inactive' | 'expired' | 'disabled';
export type IamUserPermissionTraceInactiveReason =
  | 'assignment_not_started'
  | 'assignment_expired'
  | 'membership_not_started'
  | 'membership_expired'
  | 'group_disabled'
  | 'hierarchy_restricted';

export type IamUserPermissionTraceItem = {
  readonly permissionKey: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly runtimeScope?: IamPermissionRuntimeScope;
  readonly organizationId?: IamUuid;
  readonly scope?: Readonly<Record<string, unknown>>;
  readonly accessScope?: IamRolePermissionAssignmentScope;
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
  readonly inheritedFromOrganizationId?: IamUuid;
  readonly inheritedFromGeoUnitId?: IamUuid;
  readonly restrictedByGeoUnitId?: IamUuid;
  readonly inactiveReason?: IamUserPermissionTraceInactiveReason;
  readonly validFrom?: string;
  readonly validTo?: string;
};

export type IamMainserverCredentialStatus =
  'complete' | 'missing_application_id' | 'missing_application_secret' | 'missing_both' | 'unknown';

export type IamUserListItem = {
  readonly id: IamUuid;
  readonly keycloakSubject: string;
  readonly displayName: string;
  readonly email?: string;
  readonly status: 'active' | 'inactive' | 'pending';
  readonly isTechnicalAccount: boolean;
  readonly mappingStatus?: IamKeycloakMappingStatus;
  readonly editability?: IamKeycloakObjectEditability;
  readonly diagnostics?: readonly IamKeycloakObjectDiagnostic[];
  readonly position?: string;
  readonly department?: string;
  readonly lastLoginAt?: string;
  readonly roles: readonly IamUserRoleAssignment[];
  readonly keycloakRoles?: readonly string[];
  readonly mainserverUserApplicationSecretSet: boolean;
  readonly mainserverCredentialStatus?: IamMainserverCredentialStatus;
};

export type IamUserDetail = IamUserListItem & {
  readonly invitationPurpose?: import('../instances/account-invitation-template.js').AccountInvitationPurpose;
  readonly username?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly phone?: string;
  readonly preferredLanguage?: string;
  readonly timezone?: string;
  readonly avatarUrl?: string;
  readonly notes?: string;
  readonly permissions?: readonly string[];
  readonly permissionTrace?: readonly IamUserPermissionTraceItem[];
  readonly groups?: readonly IamUserGroupAssignment[];
  readonly organizationMemberships?: readonly IamUserOrganizationMembership[];
  readonly mainserverUserApplicationId?: string;
  readonly mainserverUserApplicationSecretSet: boolean;
  readonly fieldEditability?: IamKeycloakUserFieldEditability;
};

export type IamUserInvitationStatus = 'not_requested' | 'sent' | 'failed';
export type IamUserInvitationErrorCode =
  | 'keycloak_user_not_ready'
  | 'keycloak_unavailable'
  | 'execute_actions_email_not_supported'
  | 'ssf_invitation_unavailable'
  | 'internal_error';

export type IamUserInvitationError = {
  readonly code: IamUserInvitationErrorCode;
  readonly message: string;
  readonly retryable: boolean;
};

export type IamCreateUserResult = {
  readonly user: IamUserDetail;
  readonly invitation: {
    readonly status: IamUserInvitationStatus;
    readonly error?: IamUserInvitationError;
  };
};
