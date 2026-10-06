import { withRequestContext } from '@sva/server-runtime';

import type { AuthenticatedRequestContext, AuthenticatedUserOptions } from '../middleware.js';
import { withAuthenticatedUser } from '../middleware.js';

import {
  assignOrganizationMembershipInternal,
  createOrganizationInternal,
  deleteOrganizationInternal,
  getMyOrganizationContextInternal,
  getOrganizationInternal,
  listOrganizationsInternal,
  provisionOrganizationMainserverInternal,
  removeOrganizationMembershipInternal,
  updateOrganizationMembershipInternal,
  updateMyOrganizationContextInternal,
  updateOrganizationInternal,
} from './handlers.js';

const withOrganizationsRequestContext = <T>(request: Request, work: () => Promise<T>): Promise<T> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, work);

const withAuthenticatedOrganizationsHandler = (
  request: Request,
  handler: (request: Request, ctx: AuthenticatedRequestContext) => Promise<Response>,
  options: AuthenticatedUserOptions = {}
): Promise<Response> =>
  withOrganizationsRequestContext(request, () =>
    withAuthenticatedUser(request, (ctx) => handler(request, ctx), options)
  );

export const listOrganizationsHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedOrganizationsHandler(request, listOrganizationsInternal, {
    personalBearerRoute: { method: 'GET', path: '/api/v1/iam/organizations' },
  });

export const getOrganizationHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedOrganizationsHandler(request, getOrganizationInternal, {
    personalBearerRoute: { method: 'GET', path: '/api/v1/iam/organizations/$organizationId' },
  });

export const createOrganizationHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedOrganizationsHandler(request, createOrganizationInternal, {
    personalBearerRoute: { method: 'POST', path: '/api/v1/iam/organizations' },
  });

export const provisionOrganizationMainserverHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedOrganizationsHandler(request, provisionOrganizationMainserverInternal);

export const updateOrganizationHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedOrganizationsHandler(request, updateOrganizationInternal, {
    personalBearerRoute: { method: 'PATCH', path: '/api/v1/iam/organizations/$organizationId' },
  });

export const deleteOrganizationHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedOrganizationsHandler(request, deleteOrganizationInternal, {
    personalBearerRoute: { method: 'DELETE', path: '/api/v1/iam/organizations/$organizationId' },
  });

export const assignOrganizationMembershipHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedOrganizationsHandler(request, assignOrganizationMembershipInternal, {
    personalBearerRoute: { method: 'POST', path: '/api/v1/iam/organizations/$organizationId/memberships' },
  });

export const removeOrganizationMembershipHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedOrganizationsHandler(request, removeOrganizationMembershipInternal, {
    personalBearerRoute: { method: 'DELETE', path: '/api/v1/iam/organizations/$organizationId/memberships/$accountId' },
  });

export const updateOrganizationMembershipHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedOrganizationsHandler(request, updateOrganizationMembershipInternal, {
    personalBearerRoute: { method: 'PATCH', path: '/api/v1/iam/organizations/$organizationId/memberships/$accountId' },
  });

export const getMyOrganizationContextHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedOrganizationsHandler(request, getMyOrganizationContextInternal);

export const updateMyOrganizationContextHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedOrganizationsHandler(request, updateMyOrganizationContextInternal);
