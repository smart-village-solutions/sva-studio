import { createSdkLogger, toJsonErrorResponse, withRequestContext } from '@sva/sdk/server';

import {
  withAuthenticatedUser,
  type AuthenticatedRequestContext,
} from '../middleware.server';
import { buildLogContext } from '../shared/log-context';

import { getFeatureFlags } from './feature-flags';
import { liveInternal, readyInternal } from './platform-handlers';
import {
  createRoleInternal,
  deleteRoleInternal,
  listRolesInternal,
  updateRoleInternal,
} from './roles-handlers';
import { reconcilePlaceholderInternal } from './reconcile-handler';
import {
  bulkDeactivateInternal,
  createUserInternal,
  getMyProfileInternal,
  getUserInternal,
  getUserTimelineInternal,
  listUsersInternal,
  syncUsersFromKeycloakInternal,
  updateMyProfileInternal,
  updateUserInternal,
  deactivateUserInternal,
} from './users-handlers';
import type { FeatureFlags } from './types';

export { sanitizeRoleAuditDetails, sanitizeRoleErrorMessage } from './role-audit';
export { isTrustedRequestOrigin } from './csrf';
export { resolveUserDisplayName } from './user-mapping';

const logger = createSdkLogger({ component: 'iam-service', level: 'info' });

const withIamRequestContext = <T>(request: Request, work: () => Promise<T>): Promise<T> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, work);

const withAuthenticatedIamHandler = (
  request: Request,
  handler: (request: Request, ctx: AuthenticatedRequestContext) => Promise<Response>
): Promise<Response> =>
  withIamRequestContext(request, async () => {
    try {
      return await withAuthenticatedUser(request, (ctx) => handler(request, ctx));
    } catch (error) {
      const logContext = buildLogContext(undefined, { includeTraceId: true });
      logger.error('IAM request failed unexpectedly', {
        operation: 'iam_request',
        endpoint: request.url,
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        error_message: error instanceof Error ? error.message : String(error),
        ...logContext,
      });

      return toJsonErrorResponse(500, 'internal_error', 'Unbehandelter IAM-Fehler.', {
        requestId: logContext.request_id,
      });
    }
  });

export const listUsersHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, listUsersInternal);

export const getUserHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, getUserInternal);

export const getUserTimelineHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, getUserTimelineInternal);

export const createUserHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, createUserInternal);

export const updateUserHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, updateUserInternal);

export const deactivateUserHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, deactivateUserInternal);

export const bulkDeactivateUsersHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, bulkDeactivateInternal);

export const syncUsersFromKeycloakHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, syncUsersFromKeycloakInternal);

export const updateMyProfileHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, updateMyProfileInternal);

export const getMyProfileHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, getMyProfileInternal);

export const listRolesHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, listRolesInternal);

export const createRoleHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, createRoleInternal);

export const updateRoleHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, updateRoleInternal);

export const deleteRoleHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, deleteRoleInternal);

export const healthReadyHandler = async (request: Request): Promise<Response> =>
  withIamRequestContext(request, () => readyInternal(request));

export const healthLiveHandler = async (request: Request): Promise<Response> =>
  withIamRequestContext(request, () => liveInternal(request));

export const reconcileHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, reconcilePlaceholderInternal);

export const getIamFeatureFlags = (): FeatureFlags => getFeatureFlags();
