import type {
  AuthorizeRequest,
  AuthorizeReasonCode,
  EffectivePermission,
  IamApiErrorCode,
  IamApiErrorResponse,
  MePermissionsResponse,
  SnapshotCacheStatus,
} from '@sva/iam-core';
import { getWorkspaceContext } from '@sva/server-runtime';

import { jsonResponse } from '../db.js';
import { authorizeRequestSchema } from '../shared/schemas.js';

export const loadAuthorizeRequest = async (request: Request): Promise<AuthorizeRequest | null> => {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return null;
  }

  const parsed = authorizeRequestSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
};

export const errorResponse = (status: number, error: IamApiErrorCode) =>
  jsonResponse(status, { error } satisfies IamApiErrorResponse);

export const buildMePermissionsResponse = (input: {
  instanceId: string;
  organizationId?: string;
  permissions: readonly EffectivePermission[];
  actorUserId: string;
  effectiveUserId: string;
  isImpersonating: boolean;
  snapshotVersion?: string;
  cacheStatus?: SnapshotCacheStatus;
  permissionRevision: Readonly<{
    instanceRevision: number;
    userRevision: number;
  }>;
}): MePermissionsResponse => ({
  instanceId: input.instanceId,
  organizationId: input.organizationId,
  permissions: input.permissions,
  subject: {
    actorUserId: input.actorUserId,
    effectiveUserId: input.effectiveUserId,
    isImpersonating: input.isImpersonating,
  },
  evaluatedAt: new Date().toISOString(),
  requestId: getWorkspaceContext().requestId,
  traceId: getWorkspaceContext().traceId,
  snapshotVersion: input.snapshotVersion,
  cacheStatus: input.cacheStatus,
  permissionRevision: input.permissionRevision,
  provenance: {
    hasGroupDerivedPermissions: input.permissions.some(
      (permission) => (permission.sourceGroupIds?.length ?? 0) > 0
    ),
    hasGeoInheritance: input.permissions.some((permission) => {
      const scope = permission.scope;
      if (!scope) {
        return false;
      }
      return Array.isArray(scope.allowedGeoUnitIds) || Array.isArray(scope.restrictedGeoUnitIds);
    }),
  },
});

export type DeniedAuthorizeResponseInput = {
  reason: AuthorizeReasonCode;
  instanceId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  requestId?: string;
  traceId?: string;
  diagnostics?: Record<string, string>;
};
