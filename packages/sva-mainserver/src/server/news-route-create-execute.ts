import { completeIdempotency, type AuthenticatedRequestContext } from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';
import { isRecord, isResponse, json } from './content-route-core.js';
import { SvaMainserverError } from './errors.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';
import { authorizeOrResponse, NEWS_CONTENT_TYPE } from './news-route-access.js';
import { type ParsedNewsInput } from './news-route-input.js';
import { withoutEditorialAuthor } from './news-route-metadata.js';
import { emitNewsAuditEvent } from './news-route-workflow.js';
import {
  authorizeMainserverCreateForPrincipal,
  finalizeMainserverMutation,
  finalizeMainserverMutationFailure,
  recordCreatedMainserverDataProvider,
  type MainserverMutationActor,
} from './mutation-principal.js';
import {
  changeSvaMainserverNewsVisibility,
  createSvaMainserverNews,
  getSvaMainserverNews,
} from './service.js';

const logger = createSdkLogger({ component: 'sva-mainserver-news-route', level: 'info' });

const completeNewsCreateIdempotency = async (input: {
  readonly actorAccountId: string;
  readonly instanceId: string;
  readonly idempotencyKey: string;
  readonly responseBody: Record<string, unknown>;
  readonly responseStatus: number;
}) =>
  completeIdempotency({
    actorAccountId: input.actorAccountId,
    endpoint: 'POST:/api/v1/mainserver/news',
    idempotencyKey: input.idempotencyKey,
    instanceId: input.instanceId,
    responseBody: input.responseBody,
    responseStatus: input.responseStatus,
    status: input.responseStatus >= 400 ? 'FAILED' : 'COMPLETED',
  });

const readResponseBody = async (
  response: Response,
  fallback: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  const body = await response
    .clone()
    .json()
    .catch(() => fallback);
  return isRecord(body) ? body : fallback;
};

export type NewsCreateActorInfo = {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

type CreateExecutionInput = {
  request: Request;
  context: AuthenticatedRequestContext;
  actor: MainserverMutationActor;
  actorInfo: NewsCreateActorInfo;
  idempotencyKey: string;
  parsed: ParsedNewsInput;
  logSuccess: (operation: string, newsId?: string) => void;
};

const persistNewsCreate = async (input: CreateExecutionInput): Promise<Response> => {
  const { context, actor, actorInfo, idempotencyKey, parsed, logSuccess } = input;
  const principalAuthorization = await authorizeMainserverCreateForPrincipal({
    actor,
    action: 'news.create',
    contentType: NEWS_CONTENT_TYPE,
  });
  if (isResponse(principalAuthorization)) return principalAuthorization;
  const data = await createSvaMainserverNews({
    ...actor,
    news: withoutEditorialAuthor(parsed.news),
  });
  if (parsed.visible === false) {
    await changeSvaMainserverNewsVisibility({ ...actor, newsId: data.id, visible: false });
  }
  await emitNewsAuditEvent({
    ctx: context,
    instanceId: actor.instanceId,
    actionId: 'news.create',
    result: 'success',
    newsId: data.id,
  });
  if (parsed.news.pushNotification === true) {
    await emitNewsAuditEvent({
      ctx: context,
      instanceId: actor.instanceId,
      actionId: 'news.pushNotification',
      result: 'success',
      newsId: data.id,
    });
  }
  const bindingResult = await recordCreatedMainserverDataProvider({
    actor,
    created: data,
    reread: async () => await getSvaMainserverNews({ ...actor, newsId: data.id }),
    contentType: NEWS_CONTENT_TYPE,
  });
  await finalizeMainserverMutation({
    actor,
    providerOutcome: 'succeeded',
    reconciliationStatus:
      bindingResult.outcome === 'conflict' || bindingResult.outcome === 'reconciliation_required'
        ? 'reconciliation_required'
        : 'complete',
    completedSteps: ['provider_write', 'binding_observation'],
    contentId: data.id,
    observedDataProviderId: data.dataProvider?.id ?? bindingResult.observedDataProviderId,
  });
  const responseData = parsed.visible === undefined ? data : { ...data, visible: parsed.visible };
  logSuccess('mainserver_news_create', data.id);
  const responseBody = {
    data: responseData,
    ...(bindingResult.outcome === 'conflict' || bindingResult.outcome === 'reconciliation_required'
      ? { meta: { reconciliationStatus: 'reconciliation_required' } }
      : {}),
  };
  await completeNewsCreateIdempotency({
    actorAccountId: actorInfo.actorAccountId,
    instanceId: actorInfo.instanceId,
    idempotencyKey,
    responseBody,
    responseStatus: 201,
  });
  return json(responseBody, 201);
};

const respondToNewsCreateFailure = async (
  input: CreateExecutionInput,
  error: unknown
): Promise<Response> => {
  const { request, context, actor, actorInfo, idempotencyKey, parsed } = input;
  await finalizeMainserverMutationFailure({ actor, error });
  const response = toMainserverErrorResponse(error, 'Mainserver-News-Anfrage ist fehlgeschlagen.');
  const workspaceContext = getWorkspaceContext();
  logger.warn('Mainserver News create failed', {
    operation: 'mainserver_news_create',
    request_id: workspaceContext.requestId,
    trace_id: workspaceContext.traceId,
    actor_id: context.user.id,
    instance_id: context.user.instanceId,
    content_type: NEWS_CONTENT_TYPE,
    method: request.method,
    error_code: error instanceof SvaMainserverError ? error.code : 'internal_error',
  });
  await emitNewsAuditEvent({
    ctx: context,
    instanceId: actor.instanceId,
    actionId: 'news.create',
    result: 'failure',
    reasonCode: error instanceof SvaMainserverError ? error.code : 'internal_error',
  });
  if (parsed.news.pushNotification === true) {
    await emitNewsAuditEvent({
      ctx: context,
      instanceId: actor.instanceId,
      actionId: 'news.pushNotification',
      result: 'failure',
      reasonCode: error instanceof SvaMainserverError ? error.code : 'internal_error',
    });
  }
  await completeNewsCreateIdempotency({
    actorAccountId: actorInfo.actorAccountId,
    instanceId: actorInfo.instanceId,
    idempotencyKey,
    responseBody: await readResponseBody(response, {
      error: 'internal_error',
      message: 'Mainserver-News-Anfrage ist fehlgeschlagen.',
    }),
    responseStatus: response.status,
  });
  return response;
};

export const executeNewsCreate = async (input: CreateExecutionInput): Promise<Response> => {
  const { context, parsed } = input;
  if (parsed.news.pushNotification === true) {
    const pushAuthorization = await authorizeOrResponse(context, 'news.pushNotification');
    if (isResponse(pushAuthorization)) return pushAuthorization;
  }
  try {
    return await persistNewsCreate(input);
  } catch (error) {
    return await respondToNewsCreateFailure(input, error);
  }
};
