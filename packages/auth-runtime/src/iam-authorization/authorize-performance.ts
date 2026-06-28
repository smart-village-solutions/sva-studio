import type { AuthorizePerformanceRequest } from '@sva/iam-core';
import { z } from 'zod';

import { createSdkLogger, getWorkspaceContext, withRequestContext } from '@sva/server-runtime';

import { withAuthenticatedUser } from '../middleware.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import { createJsonItemResponse } from '../plugin-operations/core.shared.js';
import { createApiError, parseRequestBody } from '../shared/request-helpers.js';
import { validateCsrf } from '../shared/request-security.js';
import {
  authorizeInstancePermissionForUser,
  toInstancePermissionApiErrorCode,
} from '../instance-permission-authorization.js';
import {
  readLatestAuthorizePerformanceBenchmark,
  runAuthorizePerformanceBenchmark,
} from './authorize-performance.server.js';

const MONITORING_READ_ACTION = 'iam.monitoring.read';
const MONITORING_WRITE_ACTION = 'iam.monitoring.write';
const logger = createSdkLogger({ component: 'iam-authorize-performance', level: 'info' });

const authorizePerformanceRequestSchema = z.object({
  action: z.string().trim().min(3).max(120),
  resourceType: z.string().trim().min(1).max(120),
  resourceId: z.string().trim().min(1).max(120).optional(),
  organizationId: z.string().trim().min(1).max(120).optional(),
  measuredRequests: z.number().int().min(3).max(30).optional(),
  warmupRequests: z.number().int().min(1).max(5).optional(),
}) satisfies z.ZodType<AuthorizePerformanceRequest>;

const getRequestId = (): string | undefined => getWorkspaceContext().requestId;

const requireMonitoringAccess = async (
  ctx: AuthenticatedRequestContext,
  action: string
): Promise<Response | null> => {
  const authorization = await authorizeInstancePermissionForUser({ ctx, action });
  return authorization.ok
    ? null
    : createApiError(
        authorization.status,
        toInstancePermissionApiErrorCode(authorization.error),
        'Keine Berechtigung für Authorize-Performance-Monitoring.',
        getRequestId()
      );
};

const requireActorInstanceId = (instanceId: string | null | undefined): string | Response =>
  instanceId && instanceId.trim().length > 0
    ? instanceId
    : createApiError(400, 'invalid_instance_id', 'Instanzkontext fehlt.', getRequestId());

export const startAuthorizePerformanceRunHandler = async (request: Request): Promise<Response> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async (ctx) => {
      const authorizationError = await requireMonitoringAccess(ctx, MONITORING_WRITE_ACTION);
      if (authorizationError) {
        return authorizationError;
      }

      const instanceId = requireActorInstanceId(ctx.user.instanceId);
      if (instanceId instanceof Response) {
        return instanceId;
      }

      const csrfError = validateCsrf(request, getRequestId());
      if (csrfError) {
        return csrfError;
      }

      const parsed = await parseRequestBody(request, authorizePerformanceRequestSchema);
      if (!parsed.ok) {
        return createApiError(400, 'invalid_request', parsed.message, getRequestId());
      }

      try {
        const result = await runAuthorizePerformanceBenchmark({
          actor: {
            id: ctx.user.id,
            instanceId,
          },
          request: parsed.data,
          requestHeaders: request.headers,
          requestUrl: request.url,
        });

        return createJsonItemResponse(200, result, getRequestId());
      } catch (error) {
        logger.error('Authorize performance benchmark failed', {
          operation: 'authorize_performance_run',
          instance_id: instanceId,
          actor_keycloak_subject: ctx.user.id,
          action: parsed.data.action,
          resource_type: parsed.data.resourceType,
          resource_id: parsed.data.resourceId,
          organization_id: parsed.data.organizationId,
          measured_requests: parsed.data.measuredRequests,
          warmup_requests: parsed.data.warmupRequests,
          request_id: getRequestId(),
          error: error instanceof Error ? error.message : String(error),
        });
        return createApiError(
          503,
          'database_unavailable',
          'Der Authorize-Performance-Lauf konnte nicht abgeschlossen werden.',
          getRequestId()
        );
      }
    });
  });

export const getLatestAuthorizePerformanceRunHandler = async (request: Request): Promise<Response> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async (ctx) => {
      const authorizationError = await requireMonitoringAccess(ctx, MONITORING_READ_ACTION);
      if (authorizationError) {
        return authorizationError;
      }

      const instanceId = requireActorInstanceId(ctx.user.instanceId);
      if (instanceId instanceof Response) {
        return instanceId;
      }

      return createJsonItemResponse(
        200,
        readLatestAuthorizePerformanceBenchmark({
          instanceId,
          keycloakSubject: ctx.user.id,
        }),
        getRequestId()
      );
    });
  });
