import { createHash } from 'node:crypto';
import {
  reserveIdempotency,
  resolveActorInfo,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createMutationWorkflow, createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';
import { errorJson, isResponse, json } from './content-route-core.js';
import { isUnexpectedMainserverError, SvaMainserverError } from './errors.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';
import { authorizeMutationOrResponse, NEWS_CONTENT_TYPE } from './news-route-access.js';
import { executeNewsCreate, type NewsCreateActorInfo } from './news-route-create-execute.js';
import { parseAuthorizedNewsInput, type ParsedNewsInput } from './news-route-input.js';
import { validateMutationRequest } from './news-route-workflow.js';
import type { MainserverMutationActor } from './mutation-principal.js';

const logger = createSdkLogger({ component: 'sva-mainserver-news-route', level: 'info' });
type NewsMutationActor = MainserverMutationActor;
const toPayloadHash = (rawBody: string): string =>
  createHash('sha256').update(rawBody).digest('hex');

const readIdempotencyKey = (request: Request): string | Response => {
  const key = request.headers.get('idempotency-key')?.trim();
  return key && key.length > 0
    ? key
    : errorJson(400, 'idempotency_key_required', 'Header Idempotency-Key ist erforderlich.');
};

type CreateNewsReservedMutation = {
  readonly actorInfo: NewsCreateActorInfo;
  readonly idempotencyKey: string;
  readonly parsed: ParsedNewsInput;
};

export const handleCollectionCreate = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  requestId: string | undefined,
  logSuccess: (operation: string, newsId?: string) => void
) => {
  const workflow = createMutationWorkflow<
    AuthenticatedRequestContext,
    Record<never, never>,
    {
      readonly actor: NewsMutationActor;
    },
    CreateNewsReservedMutation,
    ParsedNewsInput,
    Response
  >({
    prepare: async () => ({}),
    authorize: async ({ request: inputRequest, context }) => {
      const actor = await authorizeMutationOrResponse(inputRequest, context, 'news.create');
      return isResponse(actor) ? actor : { actor };
    },
    csrf: ({ request }) => validateMutationRequest(request, requestId) ?? undefined,
    idempotency: async ({ request, context }) => {
      const idempotencyKey = readIdempotencyKey(request);
      if (isResponse(idempotencyKey)) {
        return idempotencyKey;
      }

      const parsed = await parseAuthorizedNewsInput(request, context, {
        allowPushNotification: true,
      });
      if (isResponse(parsed)) {
        return parsed;
      }

      const actorInfo = await resolveActorInfo(request, context, { requireActorMembership: true });
      if ('error' in actorInfo) {
        return actorInfo.error;
      }

      if (!actorInfo.actor.actorAccountId) {
        return errorJson(403, 'forbidden', 'Keine Berechtigung für diese Inhaltsoperation.');
      }

      const preparedActorInfo: NewsCreateActorInfo = {
        ...actorInfo.actor,
        actorAccountId: actorInfo.actor.actorAccountId,
      };

      const idempotency = await reserveIdempotency({
        actorAccountId: preparedActorInfo.actorAccountId,
        endpoint: 'POST:/api/v1/mainserver/news',
        idempotencyKey,
        instanceId: preparedActorInfo.instanceId,
        payloadHash: toPayloadHash(parsed.rawBody),
      });
      if (idempotency.status === 'replay') {
        return json(idempotency.responseBody, idempotency.responseStatus);
      }
      if (idempotency.status === 'conflict') {
        return errorJson(409, 'idempotency_key_reuse', idempotency.message);
      }

      return { actorInfo: preparedActorInfo, idempotencyKey, parsed };
    },
    parse: async ({ parsed }) => parsed,
    execute: async ({ context, actor, actorInfo, idempotencyKey, input: parsed }) =>
      executeNewsCreate({ request, context, actor, actorInfo, idempotencyKey, parsed, logSuccess }),
    mapError: (error) => {
      const logFailure = isUnexpectedMainserverError(error) ? logger.error : logger.warn;
      logFailure('Mainserver News route failed', {
        operation: 'mainserver_news_create',
        request_id: requestId,
        trace_id: getWorkspaceContext().traceId,
        actor_id: ctx.user.id,
        instance_id: ctx.user.instanceId,
        content_type: NEWS_CONTENT_TYPE,
        method: request.method,
        error_code: error instanceof SvaMainserverError ? error.code : 'internal_error',
      });
      return toMainserverErrorResponse(error, 'Mainserver-News-Anfrage ist fehlgeschlagen.');
    },
    respond: (response) => response,
  });

  return workflow(request, ctx);
};
