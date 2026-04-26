import {
  createLegalTextsAdminActorResolver,
  createLegalTextsRequestContextHandlers,
  withLegalTextsRequestContext,
  type ResolvedLegalTextsActor,
} from '@sva/iam-governance/legal-text-request-context';

import { createApiError } from '../iam-account-management/api-helpers.js';
import { ADMIN_ROLES } from '../iam-account-management/constants.js';
import { ensureFeature, getFeatureFlags } from '../iam-account-management/feature-flags.js';
import { logger as accountLogger, requireRoles, resolveActorInfo } from '../iam-account-management/shared.js';
import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { withAuthenticatedUser } from '../middleware.server.js';

export { withLegalTextsRequestContext, type ResolvedLegalTextsActor };

const requestContextHandlers = createLegalTextsRequestContextHandlers<AuthenticatedRequestContext>({
  withAuthenticatedUser,
  logError: (message, fields) => accountLogger.error(message, fields),
});

export const { withAuthenticatedLegalTextsHandler } = requestContextHandlers;

export const resolveLegalTextsAdminActor = createLegalTextsAdminActorResolver<AuthenticatedRequestContext>({
  ensureFeature: (requestId) => ensureFeature(getFeatureFlags(), 'iam_admin', requestId),
  requireAdminRoles: (ctx, requestId) => requireRoles(ctx, ADMIN_ROLES, requestId),
  resolveActorInfo: (request, ctx) => resolveActorInfo(request, ctx, { requireActorMembership: true }),
  createApiError: (status, code, message, requestId) =>
    createApiError(status, code as Parameters<typeof createApiError>[1], message, requestId),
});
