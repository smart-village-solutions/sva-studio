import type { AuthenticatedRequestContext } from '../middleware.js';
import type { IdentityManagedRoleAttributes } from '../identity-provider-port.js';

import { SYSTEM_ADMIN_ROLES } from './constants.js';
import { requireMutationIdentityProvider, requireMutationPathId, resolveMutationActorWithAccount, type MutationActorWithAccount } from './mutation-request-context.shared.js';

export type RoleMutationActor = MutationActorWithAccount;

export const resolveRoleMutationActor = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  requestId?: string
): Promise<{ actor: RoleMutationActor } | { response: Response }> => {
  return resolveMutationActorWithAccount(request, ctx, {
    allowedRoles: SYSTEM_ADMIN_ROLES,
    feature: 'iam_admin',
    scope: 'write',
    requestId,
  });
};

export const requireRoleId = (request: Request, requestId?: string): string | Response => {
  return requireMutationPathId(request, { paramName: 'roleId', requestId });
};

export const requireRoleIdentityProvider = async (instanceId: string, requestId?: string) => {
  return requireMutationIdentityProvider(instanceId, requestId, {
    syncError: { code: 'IDP_UNAVAILABLE' },
    syncState: 'failed',
  });
};

export const buildRoleAttributes = (input: {
  instanceId: string;
  roleKey: string;
  displayName: string;
}): IdentityManagedRoleAttributes => {
  return {
    managedBy: 'studio',
    instanceId: input.instanceId,
    roleKey: input.roleKey,
    displayName: input.displayName,
  };
};
