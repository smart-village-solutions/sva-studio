import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import type { ContentOwnershipRouteMatch } from './content-ownership-route-contract.js';
import { SvaMainserverError } from './errors.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';
import type { MainserverMutationActor } from './mutation-principal.js';

const logger = createSdkLogger({
  component: 'sva-mainserver-content-ownership-route',
  level: 'info',
});

export const ownershipRouteFailureResponse = (
  error: unknown,
  actor: MainserverMutationActor,
  route: ContentOwnershipRouteMatch,
  fallbackMessage: string
): Response => {
  const context = getWorkspaceContext();
  logger.warn('Mainserver content ownership route failed', {
    operation: 'mainserver_content_ownership',
    request_id: context.requestId,
    trace_id: context.traceId,
    instance_id: actor.instanceId,
    content_type: route.contentType,
    content_id: route.contentId,
    route_operation: route.operation,
    error_code: error instanceof SvaMainserverError ? error.code : 'internal_error',
    error_message: error instanceof Error ? error.message : String(error),
  });
  return toMainserverErrorResponse(error, fallbackMessage);
};
