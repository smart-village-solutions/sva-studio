import {
  createLegalTextsAdminActorResolver,
  createLegalTextsRequestContextHandlers,
  withLegalTextsRequestContext,
  type ResolvedLegalTextsActor,
} from '@sva/iam-governance/legal-text-request-context';

import { createApiError } from '../iam-account-management/api-helpers.js';
import { ensureFeature, getFeatureFlags } from '../iam-account-management/feature-flags.js';
import { logger as accountLogger, resolveActorInfo } from '../iam-account-management/shared.js';
import {
  authorizeInstancePermissionForUser,
  toInstancePermissionApiErrorCode,
} from '../instance-permission-authorization.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import { withAuthenticatedUser } from '../middleware.js';

export { withLegalTextsRequestContext, type ResolvedLegalTextsActor };

const requestContextHandlers = createLegalTextsRequestContextHandlers<AuthenticatedRequestContext>({
  withAuthenticatedUser,
  logError: (message, fields) => accountLogger.error(message, fields),
});

export const { withAuthenticatedLegalTextsHandler } = requestContextHandlers;

export const resolveLegalTextsAdminActor = createLegalTextsAdminActorResolver<AuthenticatedRequestContext>({
  ensureFeature: (requestId) => ensureFeature(getFeatureFlags(), 'iam_admin', requestId),
  requireAdminAccess: async (ctx, requestId, options) => {
    const authorization = await authorizeInstancePermissionForUser({
      ctx,
      action: options.requireActorAccountId ? 'iam.legalText.write' : 'iam.legalText.read',
    });
    if (authorization.ok) {
      return null;
    }

    return createApiError(
      authorization.status,
      toInstancePermissionApiErrorCode(authorization.error),
      authorization.message,
      requestId
    );
  },
  resolveActorInfo: (request, ctx) => resolveActorInfo(request, ctx, { requireActorMembership: true }),
  createApiError: (status, code, message, requestId) =>
    createApiError(status, code as Parameters<typeof createApiError>[1], message, requestId),
});
