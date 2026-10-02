import type {
  IamLegalTextTargeting,
  IamRolePermissionAssignmentScope,
  IamUuid,
} from '@sva/iam-core';
import type { IamPermissionRuntimeScope } from './account-management.js';
import type {
  IamKeycloakObjectDiagnostic,
  IamKeycloakObjectEditability,
} from './account-keycloak-contract.js';
import type {
  IamGroupType,
  IamRoleSyncError,
  IamRoleSyncState,
  IamUserGroupAssignment,
} from './account-user-contract.js';

export type IamRoleListItem = {
  readonly id: IamUuid;
  readonly roleKey: string;
  readonly roleName: string;
  readonly externalRoleName: string;
  readonly managedBy: 'studio' | 'external' | 'keycloak_builtin';
  readonly description?: string;
  readonly isSystemRole: boolean;
  readonly editability?: IamKeycloakObjectEditability;
  readonly diagnostics?: readonly IamKeycloakObjectDiagnostic[];
  readonly roleLevel: number;
  readonly memberCount: number;
  readonly syncState: IamRoleSyncState;
  readonly lastSyncedAt?: string;
  readonly syncError?: IamRoleSyncError;
  readonly permissions: readonly {
    readonly id: IamUuid;
    readonly permissionKey: string;
    readonly description?: string;
    readonly runtimeScope?: IamPermissionRuntimeScope;
    readonly isScopeAssignable?: boolean;
    readonly supportedAccessScopes?: readonly IamRolePermissionAssignmentScope[];
    readonly accessScope?: IamRolePermissionAssignmentScope;
  }[];
  readonly permissionAssignments?: readonly {
    readonly permissionId: IamUuid;
    readonly accessScope: IamRolePermissionAssignmentScope;
  }[];
};

export type IamRoleReconcileEntry = {
  readonly roleId?: IamUuid;
  readonly roleKey?: string;
  readonly externalRoleName: string;
  readonly action: 'noop' | 'create' | 'update' | 'report';
  readonly status: 'synced' | 'corrected' | 'failed' | 'requires_manual_action';
  readonly errorCode?: string;
  readonly diagnostics?: readonly IamKeycloakObjectDiagnostic[];
};

export type IamRoleReconcileReport = {
  readonly outcome: 'success' | 'partial_failure' | 'blocked' | 'failed';
  readonly checkedCount: number;
  readonly correctedCount: number;
  readonly failedCount: number;
  readonly manualReviewCount: number;
  readonly requiresManualActionCount: number;
  readonly roles: readonly IamRoleReconcileEntry[];
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
  readonly targets: IamLegalTextTargeting;
};

export type IamPendingLegalTextItem = {
  readonly id: IamUuid;
  readonly legalTextId: string;
  readonly name: string;
  readonly legalTextVersion: string;
  readonly locale: string;
  readonly contentHtml: string;
  readonly publishedAt?: string;
  readonly targets: IamLegalTextTargeting;
};
