export type IamUuid = string;
export type IamInstanceId = string;

export type IamAction = string;

export type IamResourceRef = {
  readonly type: string;
  readonly id?: string;
  readonly organizationId?: IamUuid;
  readonly attributes?: Readonly<Record<string, unknown>>;
};

export type AuthorizeRequest = {
  readonly instanceId: IamInstanceId;
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
  'cache_stale_guard',
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
] as const;
export type IamApiErrorCode = (typeof iamApiErrorCodes)[number];

export type IamApiErrorResponse = {
  readonly error: IamApiErrorCode;
};

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
};

export type IamPermissionEffect = 'allow' | 'deny';

export type EffectivePermission = {
  readonly action: IamAction;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly organizationId?: IamUuid;
  readonly effect?: IamPermissionEffect;
  readonly scope?: Readonly<Record<string, unknown>>;
  readonly sourceRoleIds: readonly IamUuid[];
};

export type MePermissionsRequest = {
  readonly instanceId: IamInstanceId;
  readonly organizationId?: IamUuid;
  readonly actingAsUserId?: string;
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
};
