import { withRequestContext } from '@sva/sdk/server';

import type { AuthenticatedRequestContext } from '../middleware.server';
import { withAuthenticatedUser } from '../middleware.server';

import {
  assignOrganizationMembershipInternal,
  createOrganizationInternal,
  deactivateOrganizationInternal,
  getMyOrganizationContextInternal,
  getOrganizationInternal,
  listOrganizationsInternal,
  removeOrganizationMembershipInternal,
  updateMyOrganizationContextInternal,
  updateOrganizationInternal,
} from './handlers';

const withOrganizationsRequestContext = <T>(request: Request, work: () => Promise<T>): Promise<T> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, work);

const withAuthenticatedOrganizationsHandler = (
  request: Request,
  handler: (request: Request, ctx: AuthenticatedRequestContext) => Promise<Response>
): Promise<Response> =>
  withOrganizationsRequestContext(request, () => withAuthenticatedUser(request, (ctx) => handler(request, ctx)));

export const listOrganizationsHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedOrganizationsHandler(request, listOrganizationsInternal);

export const getOrganizationHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedOrganizationsHandler(request, getOrganizationInternal);

export const createOrganizationHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedOrganizationsHandler(request, createOrganizationInternal);

export const updateOrganizationHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedOrganizationsHandler(request, updateOrganizationInternal);

export const deactivateOrganizationHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedOrganizationsHandler(request, deactivateOrganizationInternal);

export const assignOrganizationMembershipHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedOrganizationsHandler(request, assignOrganizationMembershipInternal);

export const removeOrganizationMembershipHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedOrganizationsHandler(request, removeOrganizationMembershipInternal);

export const getMyOrganizationContextHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedOrganizationsHandler(request, getMyOrganizationContextInternal);

export const updateMyOrganizationContextHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedOrganizationsHandler(request, updateMyOrganizationContextInternal);
