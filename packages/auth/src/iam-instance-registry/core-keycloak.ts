import { asApiItem, createApiError } from '../iam-account-management/api-helpers.js';
import { validateCsrf } from '../iam-account-management/csrf.js';
import { jsonResponse } from '../shared/db-helpers.js';
import { getWorkspaceContext } from '@sva/server-runtime';

import type { AuthenticatedRequestContext } from '../middleware.server.js';
import {
  ensurePlatformAccess,
  readDetailInstanceId,
  readKeycloakRunId,
  requireFreshReauth,
} from './http.js';
import { executeInstanceKeycloakProvisioningMutation, mapInstanceMutationError, reconcileInstanceKeycloakMutation } from './core-mutations.js';
import { withRegistryService } from './repository.js';

const readInstanceIdOrError = (request: Request): string | Response => {
  const instanceId = readDetailInstanceId(request);
  return instanceId ?? createApiError(400, 'invalid_instance_id', 'Instanz-ID fehlt.', getWorkspaceContext().requestId);
};

const guardKeycloakReadRequest = (
  request: Request,
  ctx: AuthenticatedRequestContext,
  requireMutationGuards = false
): string | Response => {
  const accessError = ensurePlatformAccess(request, ctx);
  if (accessError) {
    return accessError;
  }
  if (requireMutationGuards) {
    const csrfError = validateCsrf(request, getWorkspaceContext().requestId);
    if (csrfError) {
      return csrfError;
    }
    const reauthError = requireFreshReauth(request);
    if (reauthError) {
      return reauthError;
    }
  }
  return readInstanceIdOrError(request);
};

const respondWithInstanceLookup = async <T>(
  request: Request,
  ctx: AuthenticatedRequestContext,
  work: (instanceId: string) => Promise<T | null>,
  notFoundMessage: string,
  requireMutationGuards = false
): Promise<Response> => {
  const guarded = guardKeycloakReadRequest(request, ctx, requireMutationGuards);
  if (guarded instanceof Response) {
    return guarded;
  }

  try {
    const value = await work(guarded);
    if (!value) {
      return createApiError(404, 'not_found', notFoundMessage, getWorkspaceContext().requestId);
    }
    return jsonResponse(200, asApiItem(value, getWorkspaceContext().requestId));
  } catch (error) {
    return mapInstanceMutationError(error);
  }
};

export const getInstanceKeycloakStatusInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> =>
  respondWithInstanceLookup(
    request,
    ctx,
    async (instanceId) => withRegistryService((service) => service.getKeycloakStatus(instanceId)),
    'Instanz wurde nicht gefunden.'
  );

export const getInstanceKeycloakPreflightInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> =>
  respondWithInstanceLookup(
    request,
    ctx,
    async (instanceId) => withRegistryService((service) => service.getKeycloakPreflight(instanceId)),
    'Instanz wurde nicht gefunden.'
  );

export const planInstanceKeycloakProvisioningInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> =>
  respondWithInstanceLookup(
    request,
    ctx,
    async (instanceId) => withRegistryService((service) => service.planKeycloakProvisioning(instanceId)),
    'Instanz wurde nicht gefunden.',
    true
  );

export const executeInstanceKeycloakProvisioningInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => executeInstanceKeycloakProvisioningMutation(request, ctx);

export const getInstanceKeycloakProvisioningRunInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const guarded = guardKeycloakReadRequest(request, ctx);
  if (guarded instanceof Response) {
    return guarded;
  }

  const runId = readKeycloakRunId(request);
  if (!runId) {
    return createApiError(400, 'invalid_request', 'Provisioning-Run-ID fehlt.', getWorkspaceContext().requestId);
  }

  try {
    const run = await withRegistryService((service) => service.getKeycloakProvisioningRun(guarded, runId));
    if (!run) {
      return createApiError(404, 'not_found', 'Provisioning-Run wurde nicht gefunden.', getWorkspaceContext().requestId);
    }
    return jsonResponse(200, asApiItem(run, getWorkspaceContext().requestId));
  } catch (error) {
    return mapInstanceMutationError(error);
  }
};

export const reconcileInstanceKeycloakInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => reconcileInstanceKeycloakMutation(request, ctx);
