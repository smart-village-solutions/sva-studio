export type IamAccountStatus = 'active' | 'inactive' | 'pending';

export type IamPermission = {
  readonly id: string;
  readonly instanceId: string;
  readonly permissionKey: string;
  readonly description?: string;
};

export type IamRole = {
  readonly id: string;
  readonly instanceId: string;
  readonly roleName: string;
  readonly description?: string;
  readonly isSystemRole: boolean;
  readonly roleLevel?: number;
  readonly permissions: readonly IamPermission[];
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
