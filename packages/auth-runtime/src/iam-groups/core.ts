import { withRequestContext } from '@sva/server-runtime';

import type { AuthenticatedRequestContext, AuthenticatedUserOptions } from '../middleware.js';
import { withAuthenticatedUser } from '../middleware.js';

import {
  assignGroupMembershipInternal,
  assignGroupRoleInternal,
  createGroupInternal,
  deleteGroupInternal,
  getGroupInternal,
  listGroupsInternal,
  removeGroupMembershipInternal,
  removeGroupRoleInternal,
  updateGroupInternal,
} from './handlers.js';

const withGroupsRequestContext = <T>(request: Request, work: () => Promise<T>): Promise<T> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, work);

const withAuthenticatedGroupsHandler = (
  request: Request,
  handler: (request: Request, ctx: AuthenticatedRequestContext) => Promise<Response>,
  options: AuthenticatedUserOptions = {}
): Promise<Response> =>
  withGroupsRequestContext(request, () => withAuthenticatedUser(request, (ctx) => handler(request, ctx), options));

export const listGroupsHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedGroupsHandler(request, listGroupsInternal, {
    personalBearerRoute: { method: 'GET', path: '/api/v1/iam/groups' },
  });

export const getGroupHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedGroupsHandler(request, getGroupInternal, {
    personalBearerRoute: { method: 'GET', path: '/api/v1/iam/groups/$groupId' },
  });

export const createGroupHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedGroupsHandler(request, createGroupInternal, {
    personalBearerRoute: { method: 'POST', path: '/api/v1/iam/groups' },
  });

export const deleteGroupHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedGroupsHandler(request, deleteGroupInternal, {
    personalBearerRoute: { method: 'DELETE', path: '/api/v1/iam/groups/$groupId' },
  });

export const updateGroupHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedGroupsHandler(request, updateGroupInternal, {
    personalBearerRoute: { method: 'PATCH', path: '/api/v1/iam/groups/$groupId' },
  });

export const assignGroupRoleHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedGroupsHandler(request, assignGroupRoleInternal, {
    personalBearerRoute: { method: 'POST', path: '/api/v1/iam/groups/$groupId/roles' },
  });

export const removeGroupRoleHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedGroupsHandler(request, removeGroupRoleInternal, {
    personalBearerRoute: { method: 'DELETE', path: '/api/v1/iam/groups/$groupId/roles/$roleId' },
  });

export const assignGroupMembershipHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedGroupsHandler(request, assignGroupMembershipInternal, {
    personalBearerRoute: { method: 'POST', path: '/api/v1/iam/groups/$groupId/memberships' },
  });

export const removeGroupMembershipHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedGroupsHandler(request, removeGroupMembershipInternal, {
    personalBearerRoute: { method: 'DELETE', path: '/api/v1/iam/groups/$groupId/memberships' },
  });
