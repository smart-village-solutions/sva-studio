import type { IamGroupMembershipOrigin, IamGroupType, IamRoleSyncState } from '@sva/core';

export const USER_STATUS = ['active', 'inactive', 'pending'] as const;
export type UserStatus = (typeof USER_STATUS)[number];

export type RateScope = 'read' | 'write' | 'bulk';

export type IdempotencyStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export type FeatureFlags = {
  readonly iamUiEnabled: boolean;
  readonly iamAdminEnabled: boolean;
  readonly iamBulkEnabled: boolean;
};

export type RateBucket = {
  windowStartedAt: number;
  count: number;
};

export type ActorInfo = {
  readonly instanceId: string;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly actorAccountId?: string;
};

export type ResolveActorOptions = {
  readonly createMissingInstanceFromKey?: boolean;
  readonly requireActorMembership?: boolean;
  readonly provisionMissingActorMembership?: boolean;
};

export type IamRoleRow = {
  id: string;
  role_key: string;
  role_name: string;
  display_name?: string | null;
  external_role_name?: string | null;
  role_level: number;
  is_system_role: boolean;
  valid_from?: string | null;
  valid_to?: string | null;
};

export type ManagedBy = 'studio' | 'external';

export type RoleSyncErrorCode =
  | 'IDP_UNAVAILABLE'
  | 'IDP_TIMEOUT'
  | 'IDP_FORBIDDEN'
  | 'IDP_CONFLICT'
  | 'IDP_NOT_FOUND'
  | 'IDP_UNKNOWN'
  | 'DB_WRITE_FAILED'
  | 'COMPENSATION_FAILED'
  | 'REQUIRES_MANUAL_ACTION';

export type ManagedRoleRow = IamRoleRow & {
  readonly description: string | null;
  readonly external_role_name: string;
  readonly managed_by: ManagedBy;
  readonly sync_state: IamRoleSyncState;
  readonly last_synced_at: string | null;
  readonly last_error_code: string | null;
};

export type IamGroupRow = {
  id: string;
  group_key: string;
  display_name: string;
  description: string | null;
  group_type: IamGroupType;
  is_active: boolean;
};

export type IamGroupMembershipRow = IamGroupRow & {
  origin: IamGroupMembershipOrigin;
  valid_from?: string | null;
  valid_to?: string | null;
};

export type IdempotencyReserveResult =
  | {
      status: 'reserved';
    }
  | {
      status: 'replay';
      responseStatus: number;
      responseBody: unknown;
    }
  | {
      status: 'conflict';
      message: string;
    };
