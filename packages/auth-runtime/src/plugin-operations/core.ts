import { type StudioPluginOperationStartRequest } from '@sva/core';
import { createMutationWorkflow, getWorkspaceContext } from '@sva/server-runtime';
import { z } from 'zod';

import {
  createApiError, parseRequestBody, requireIdempotencyKey,
} from '../shared/request-helpers.js';
import { withAuthenticatedUser } from '../middleware.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import { validateCsrf } from '../shared/request-security.js';
import {
  executeStartPluginOperationJob, reserveStartIdempotency, validateStartRequestData,
} from './core.start.js';
import {
  cancelPluginOperationJobHandler,
  deletePluginOperationJobHandler,
  getPluginOperationJobHandler,
  listPluginOperationJobsHandler,
  requireActorInstanceId, requireMonitoringAccess,
} from './core.monitoring.js';

export {
  cancelPluginOperationJobHandler,
  deletePluginOperationJobHandler,
  getPluginOperationJobHandler,
  listPluginOperationJobsHandler,
};

const MONITORING_WRITE_ACTION = 'iam.monitoring.write';
const getRequestId = (): string | undefined => getWorkspaceContext().requestId;

const startPluginOperationJobSchema = z.object({
  pluginId: z.string().trim().min(1),
  jobTypeId: z.string().trim().min(1),
  importProfileId: z.string().trim().min(1).optional(),
  correlationId: z.string().trim().min(1).optional(),
  parentJobId: z.string().trim().uuid().optional(),
  input: z.record(z.string(), z.unknown()),
}) satisfies z.ZodType<StudioPluginOperationStartRequest>;

export const startPluginOperationJobHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, (ctx) =>
    createMutationWorkflow<
      AuthenticatedRequestContext,
      {
        readonly requestId?: string;
        readonly instanceId: string;
        readonly actorAccountId: string;
      },
      Record<never, never>,
      {
        readonly idempotencyKey: string;
      },
      {
        readonly data: StudioPluginOperationStartRequest;
        readonly rawBody: string;
      },
      Response
    >({
      prepare: ({ context }) => {
        const requestId = getRequestId();
        const instanceId = requireActorInstanceId(context.user.instanceId);
        if (instanceId instanceof Response) {
          return instanceId;
        }
        return {
          requestId,
          instanceId,
          actorAccountId: context.user.id,
        };
      },
      authorize: async ({ context }) => (await requireMonitoringAccess(context, MONITORING_WRITE_ACTION)) ?? {},
      csrf: ({ request, requestId }) => validateCsrf(request, requestId) ?? undefined,
      idempotency: ({ request, requestId }) => {
        const idempotency = requireIdempotencyKey(request, requestId);
        return 'error' in idempotency ? idempotency.error : { idempotencyKey: idempotency.key };
      },
      parse: async ({ request, requestId }) => {
        const parsed = await parseRequestBody(request, startPluginOperationJobSchema);
        if (!parsed.ok) {
          return createApiError(400, 'invalid_request', parsed.message, requestId);
        }

        const validationError = validateStartRequestData(parsed.data, requestId);
        if (validationError) {
          return validationError;
        }

        return parsed;
      },
      execute: async ({ instanceId, actorAccountId, idempotencyKey, requestId, input }) => {
        const replayOrConflictResponse = await reserveStartIdempotency({
          instanceId,
          actorAccountId,
          idempotencyKey,
          rawBody: input.rawBody,
          requestId,
        });
        if (replayOrConflictResponse) {
          return replayOrConflictResponse;
        }

        return executeStartPluginOperationJob({
          instanceId,
          actorAccountId,
          idempotencyKey,
          requestId,
          scheduledAt: new Date().toISOString(),
          data: input.data,
        });
      },
      mapError: (_error, state) =>
        createApiError(503, 'database_unavailable', 'Der Plugin-Job konnte nicht angelegt werden.', state.requestId),
      respond: (response) => response,
    })(request, ctx)
  );
