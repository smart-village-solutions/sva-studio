import type { AuthenticatedRequestContext } from './types.js';
import { createApiError, readPathSegment } from '@sva/server-runtime';
import { validateCsrf } from './host-controls.js';
import { authorizeWasteManagementAction, getAuthorizedWasteManagementInstanceId } from './auth.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId } from './utils.js';

type WasteAuthorizedMutationContext = {
  readonly instanceId: string;
  readonly requestId: string | undefined;
};

type WasteAuthorizedMutationPathContext = WasteAuthorizedMutationContext & {
  readonly resourceId: string;
};

type WasteMutationGuardOptions = {
  readonly resourceIdName?: string;
  readonly resourcePathIndex?: number;
};

const getWasteAuthorizedMutationContext = async (
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps
): Promise<WasteAuthorizedMutationContext | Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(ctx, 'waste-management.master-data.manage', deps, requestId);
  if (authError) {
    return authError;
  }

  return {
    instanceId: getAuthorizedWasteManagementInstanceId(ctx),
    requestId,
  };
};

const validateWasteMutationCsrf = (
  deps: WasteManagementHandlerDeps,
  request: Request,
  requestId: string | undefined
): Response | null => validateCsrf(deps, request, requestId);

export const authorizeWasteMasterDataMutationRequest = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps
): Promise<WasteAuthorizedMutationContext | Response> => {
  const authorized = await getWasteAuthorizedMutationContext(ctx, deps);
  if (authorized instanceof Response) {
    return authorized;
  }

  const csrfError = validateWasteMutationCsrf(deps, request, authorized.requestId);
  if (csrfError) {
    return csrfError;
  }

  return authorized;
};

export const authorizeWasteMasterDataMutationPathRequest = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps,
  options: WasteMutationGuardOptions
): Promise<WasteAuthorizedMutationPathContext | Response> => {
  const authorized = await getWasteAuthorizedMutationContext(ctx, deps);
  if (authorized instanceof Response) {
    return authorized;
  }

  const resourceIdName = options.resourceIdName?.trim();
  if (!resourceIdName) {
    return createApiError(500, 'internal_error', 'resourceIdName fehlt für die Mutation-Guard-Konfiguration.', authorized.requestId);
  }

  const resourceId = readPathSegment(request, options.resourcePathIndex ?? 4)?.trim();
  if (!resourceId) {
    return createApiError(400, 'invalid_request', `${resourceIdName} fehlt im Pfad.`, authorized.requestId);
  }

  const csrfError = validateWasteMutationCsrf(deps, request, authorized.requestId);
  if (csrfError) {
    return csrfError;
  }

  return {
    ...authorized,
    resourceId,
  };
};
