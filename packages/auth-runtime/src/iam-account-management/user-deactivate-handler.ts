import { createDeactivateUserHandlerInternal } from '@sva/iam-admin';
import { getWorkspaceContext } from '@sva/server-runtime';

import type { AuthenticatedRequestContext } from '../middleware.js';
import { jsonResponse } from '../db.js';

import { asApiItem, createApiError } from './api-helpers.js';
import { ensureActorCanManageTarget, isSystemAdminAccount, resolveActorMaxRoleLevel, resolveSystemAdminCount } from './shared-actor-authorization.js';
import { emitActivityLog, notifyPermissionInvalidation } from './shared-activity.js';
import { iamUserOperationsCounter, logger, trackKeycloakCall } from './shared-observability.js';
import { withInstanceScopedDb } from './shared-runtime.js';
import { resolveUserDetail } from './user-detail-query.js';
import {
  isRecoverableUserProjectionError,
  mergeMainserverCredentialState,
  resolveProjectedMainserverCredentialState,
} from './user-projection.js';
import {
  resolveUserMutationTargetContext,
} from './user-mutation-request-context.shared.js';
import { createUnexpectedMutationErrorResponse, createUserMutationErrorResponse } from './user-mutation-errors.js';

const resolveDeactivateRequestContext = async (request: Request, ctx: AuthenticatedRequestContext) => {
  const requestContext = getWorkspaceContext();
  return resolveUserMutationTargetContext(request, ctx, {
    feature: 'iam_admin',
    scope: 'write',
    requestId: requestContext.requestId,
  });
};

export const deactivateUserInternal = createDeactivateUserHandlerInternal({
  asApiItem,
  createUnexpectedMutationErrorResponse,
  createUserMutationErrorResponse,
  emitActivityLog,
  ensureActorCanManageTarget,
  iamUserOperationsCounter,
  isRecoverableUserProjectionError,
  isSystemAdminAccount,
  jsonResponse,
  logger,
  mergeMainserverCredentialState,
  notifyPermissionInvalidation,
  notFoundResponse: (requestId) => createApiError(404, 'not_found', 'Nutzer nicht gefunden.', requestId),
  resolveActorMaxRoleLevel,
  resolveDeactivateRequestContext,
  resolveProjectedMainserverCredentialState,
  resolveSystemAdminCount,
  resolveUserDetail,
  trackKeycloakCall,
  withInstanceScopedDb,
});
