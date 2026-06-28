import type { IamRolePermissionAssignmentScope } from '@sva/iam-core';

export type IamAccountStatus = 'active' | 'inactive' | 'pending';
export type IamPermissionRuntimeScope = 'instance' | 'record' | 'organization_context';

export type IamPermission = {
  readonly id: string;
  readonly instanceId: string;
  readonly permissionKey: string;
  readonly description?: string;
  readonly runtimeScope?: IamPermissionRuntimeScope;
  readonly isScopeAssignable?: boolean;
  readonly supportedAccessScopes?: readonly IamRolePermissionAssignmentScope[];
};

export type IamRolePermissionAssignment = {
  readonly permissionId: string;
  readonly accessScope: IamRolePermissionAssignmentScope;
};

export type IamRole = {
  readonly id: string;
  readonly instanceId: string;
  readonly roleName: string;
  readonly description?: string;
  readonly isSystemRole: boolean;
  readonly roleLevel?: number;
  readonly permissions: readonly (IamPermission & {
    readonly accessScope?: IamRolePermissionAssignmentScope;
  })[];
  readonly permissionAssignments?: readonly IamRolePermissionAssignment[];
};

export type IamAccountProfile = {
  readonly id: string;
  readonly keycloakSubject: string;
  readonly instanceId: string;
  readonly displayName: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly phone?: string;
  readonly position?: string;
  readonly department?: string;
  readonly preferredLanguage?: string;
  readonly timezone?: string;
  readonly status: IamAccountStatus;
  readonly roles: readonly IamRole[];
};
