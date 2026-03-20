import { withRequestContext } from '@sva/sdk/server';

import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { withAuthenticatedUser } from '../middleware.server.js';

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
  handler: (request: Request, ctx: AuthenticatedRequestContext) => Promise<Response>
): Promise<Response> =>
  withGroupsRequestContext(request, () => withAuthenticatedUser(request, (ctx) => handler(request, ctx)));

export const listGroupsHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedGroupsHandler(request, listGroupsInternal);

export const getGroupHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedGroupsHandler(request, getGroupInternal);

export const createGroupHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedGroupsHandler(request, createGroupInternal);

export const deleteGroupHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedGroupsHandler(request, deleteGroupInternal);

export const updateGroupHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedGroupsHandler(request, updateGroupInternal);

export const assignGroupRoleHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedGroupsHandler(request, assignGroupRoleInternal);

export const removeGroupRoleHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedGroupsHandler(request, removeGroupRoleInternal);

export const assignGroupMembershipHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedGroupsHandler(request, assignGroupMembershipInternal);

export const removeGroupMembershipHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedGroupsHandler(request, removeGroupMembershipInternal);
