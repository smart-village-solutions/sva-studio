import { withRequestContext } from '@sva/sdk/server';

import {
  withAuthenticatedUser,
  type AuthenticatedRequestContext,
} from '../middleware.server';

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
  listUsersInternal,
  updateMyProfileInternal,
  updateUserInternal,
  deactivateUserInternal,
} from './users-handlers';
import type { FeatureFlags } from './types';

export { sanitizeRoleAuditDetails, sanitizeRoleErrorMessage } from './role-audit';
export { isTrustedRequestOrigin } from './csrf';
export { resolveUserDisplayName } from './user-mapping';

const withIamRequestContext = <T>(request: Request, work: () => Promise<T>): Promise<T> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, work);

const withAuthenticatedIamHandler = (
  request: Request,
  handler: (request: Request, ctx: AuthenticatedRequestContext) => Promise<Response>
): Promise<Response> =>
  withIamRequestContext(request, () => withAuthenticatedUser(request, (ctx) => handler(request, ctx)));

export const listUsersHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, listUsersInternal);

export const getUserHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, getUserInternal);

export const createUserHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, createUserInternal);

export const updateUserHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, updateUserInternal);

export const deactivateUserHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, deactivateUserInternal);

export const bulkDeactivateUsersHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedIamHandler(request, bulkDeactivateInternal);

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
