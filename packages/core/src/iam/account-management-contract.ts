import type { IamUuid } from './authorization-contract';

export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'invalid_request'
  | 'invalid_instance_id'
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

export type IamUserRoleAssignment = {
  readonly roleId: IamUuid;
  readonly roleKey: string;
  readonly roleName: string;
  readonly roleLevel: number;
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
  readonly firstName?: string;
  readonly lastName?: string;
  readonly phone?: string;
  readonly preferredLanguage?: string;
  readonly timezone?: string;
  readonly avatarUrl?: string;
  readonly notes?: string;
  readonly permissions?: readonly string[];
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
