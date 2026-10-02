import type {
  IamDsrCanonicalStatus,
  IamDsrCaseListItem,
  IamGovernanceCaseListItem,
  IamOrganizationMembershipVisibility,
  IamOrganizationType,
  IamRoleReconcileReport,
} from '@sva/core';

import type { IamRolePermissionAssignmentScope } from '@sva/iam-core';

export type BulkReprovisionMainserverUsersResult = Readonly<{
  successes: readonly { id: string }[];
  failures: readonly { id: string; code: string; message: string }[];
  successCount: number;
  failureCount: number;
}>;

export type CreateRolePayload = {
  readonly roleName?: string;
  readonly displayName?: string;
  readonly description?: string;
  readonly roleLevel?: number;
  readonly permissionIds?: readonly string[];
  readonly permissionAssignments?: readonly {
    readonly permissionId: string;
    readonly accessScope?: IamRolePermissionAssignmentScope;
  }[];
};

export type UpdateRolePayload = {
  readonly displayName?: string;
  readonly description?: string;
  readonly roleLevel?: number;
  readonly permissionIds?: readonly string[];
  readonly permissionAssignments?: readonly {
    readonly permissionId: string;
    readonly accessScope?: IamRolePermissionAssignmentScope;
  }[];
  readonly retrySync?: boolean;
};

export type RoleReconcileReport = IamRoleReconcileReport;

export type CreateGroupPayload = {
  readonly groupKey: string;
  readonly displayName: string;
  readonly description?: string;
  readonly roleIds?: readonly string[];
};

export type UpdateGroupPayload = {
  readonly displayName?: string;
  readonly description?: string;
  readonly roleIds?: readonly string[];
  readonly isActive?: boolean;
};

export type AssignGroupRolePayload = {
  readonly roleId: string;
};

export type AssignGroupMembershipPayload = {
  readonly keycloakSubject: string;
  readonly validFrom?: string;
  readonly validUntil?: string;
};

export type CreateLegalTextPayload = {
  readonly name: string;
  readonly legalTextVersion: string;
  readonly locale: string;
  readonly contentHtml: string;
  readonly status: 'draft' | 'valid' | 'archived';
  readonly publishedAt?: string;
  readonly targetRoleIds?: readonly string[];
  readonly targetGroupIds?: readonly string[];
};

export type UpdateLegalTextPayload = {
  readonly name?: string;
  readonly legalTextVersion?: string;
  readonly locale?: string;
  readonly contentHtml?: string;
  readonly status?: 'draft' | 'valid' | 'archived';
  readonly publishedAt?: string;
  readonly targetRoleIds?: readonly string[];
  readonly targetGroupIds?: readonly string[];
};

export type OrganizationsQuery = {
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly organizationType?: IamOrganizationType;
  readonly status?: 'active' | 'inactive';
  readonly sortBy: OrganizationSortField;
  readonly sortDirection: OrganizationSortDirection;
};

export type OrganizationSortField =
  'displayName' | 'parentDisplayName' | 'childCount' | 'membershipCount' | 'isActive';

export type OrganizationSortDirection = 'asc' | 'desc';

export type CreateOrganizationPayload = {
  readonly organizationKey: string;
  readonly displayName: string;
  readonly parentOrganizationId?: string;
  readonly organizationType: IamOrganizationType;
  readonly contentAuthorPolicy: 'org_only' | 'org_or_personal';
  readonly mainserverApplicationId?: string;
  readonly mainserverApplicationSecret?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type UpdateOrganizationPayload = Partial<CreateOrganizationPayload> & {
  readonly parentOrganizationId?: string | null;
  readonly isActive?: boolean;
};

export type AssignOrganizationMembershipPayload = {
  readonly accountId: string;
  readonly isDefaultContext?: boolean;
  readonly visibility?: IamOrganizationMembershipVisibility;
};

export type UpdateOrganizationMembershipPayload = {
  readonly isDefaultContext?: boolean;
  readonly visibility?: IamOrganizationMembershipVisibility;
};

export type GovernanceCasesQuery = {
  readonly page: number;
  readonly pageSize: number;
  readonly type?: IamGovernanceCaseListItem['type'];
  readonly status?: string;
  readonly search?: string;
  readonly sortBy: 'createdAt' | 'updatedAt';
  readonly sortDirection: 'asc' | 'desc';
};

export type DsrAdminCasesQuery = {
  readonly page: number;
  readonly pageSize: number;
  readonly type?: IamDsrCaseListItem['type'];
  readonly status?: IamDsrCanonicalStatus;
  readonly search?: string;
  readonly sortBy: 'createdAt' | 'completedAt';
  readonly sortDirection: 'asc' | 'desc';
};
