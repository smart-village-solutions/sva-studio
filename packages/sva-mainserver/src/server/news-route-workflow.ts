import {
  emitAuthAuditEvent,
  validateCsrf,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createMutationWorkflow, createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';
import { errorJson, isResponse } from './content-route-core.js';
import { isUnexpectedMainserverError, SvaMainserverError } from './errors.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';
import {
  authorizeMutationOrResponse,
  NEWS_CONTENT_TYPE,
  type RouteMatch,
} from './news-route-access.js';
import type { MainserverMutationActor } from './mutation-principal.js';

const logger = createSdkLogger({ component: 'sva-mainserver-news-route', level: 'info' });
type NewsMutationActor = MainserverMutationActor;

export const validateMutationRequest = (request: Request, requestId?: string): Response | null => {
  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return errorJson(403, 'csrf_validation_failed', 'Sicherheitsprüfung fehlgeschlagen.');
  }
  return null;
};

export const emitNewsAuditEvent = async (input: {
  readonly ctx: AuthenticatedRequestContext;
  readonly instanceId: string;
  readonly actionId:
    | 'news.create'
    | 'news.update'
    | 'news.delete'
    | 'news.pushNotification'
    | 'news.visibility.update';
  readonly result: 'success' | 'failure';
  readonly newsId?: string;
  readonly reasonCode?: string;
}) => {
  const workspaceContext = getWorkspaceContext();
  await emitAuthAuditEvent({
    eventType: input.result === 'success' ? 'plugin_action_authorized' : 'plugin_action_failed',
    actorUserId: input.ctx.user.id,
    actorEmail: input.ctx.user.email,
    actorDisplayName: input.ctx.user.displayName,
    scope: { kind: 'instance', instanceId: input.instanceId },
    workspaceId: input.instanceId,
    outcome: input.result,
    requestId: workspaceContext.requestId,
    traceId: workspaceContext.traceId,
    pluginAction: {
      actionId: input.actionId,
      actionNamespace: 'news',
      actionOwner: 'sva-mainserver',
      result: input.result,
      reasonCode: input.reasonCode,
      resourceType: 'news',
      resourceId: input.newsId,
    },
  });
};

export const createNewsItemMutationHandler = <TInput>(input: {
  readonly route: Extract<RouteMatch, { readonly kind: 'item' | 'itemVisibility' }>;
  readonly action: 'news.update' | 'news.delete';
  readonly requestId?: string;
  readonly parse: (request: Request) => Promise<TInput | Response>;
  readonly execute: (actor: NewsMutationActor, parsed: TInput) => Promise<Response>;
}) => {
  const operation =
    input.route.kind === 'itemVisibility'
      ? 'mainserver_news_visibility_update'
      : input.action === 'news.delete'
        ? 'mainserver_news_delete'
        : 'mainserver_news_update';
  const workflow = createMutationWorkflow<
    AuthenticatedRequestContext,
    {
      readonly newsId: string;
      readonly requestId?: string;
    },
    {
      readonly actor: NewsMutationActor;
    },
    Record<never, never>,
    TInput,
    Response
  >({
    prepare: () => ({
      newsId: input.route.newsId,
      requestId: input.requestId,
    }),
    authorize: async ({ request, context, newsId }) => {
      const actor = await authorizeMutationOrResponse(request, context, input.action, newsId);
      return isResponse(actor) ? actor : { actor };
    },
    csrf: ({ request, requestId }) => validateMutationRequest(request, requestId) ?? undefined,
    parse: ({ request }) => input.parse(request),
    execute: async ({ actor, input: parsed }) => input.execute(actor, parsed),
    mapError: (error, state) => {
      const logFailure = isUnexpectedMainserverError(error) ? logger.error : logger.warn;
      logFailure('Mainserver News route failed', {
        operation,
        request_id: state.requestId,
        trace_id: getWorkspaceContext().traceId,
        actor_id: state.context.user.id,
        instance_id: state.context.user.instanceId,
        content_type: NEWS_CONTENT_TYPE,
        content_id: state.newsId,
        method: state.request.method,
        error_code: error instanceof SvaMainserverError ? error.code : 'internal_error',
      });
      return toMainserverErrorResponse(error, 'Mainserver-News-Anfrage ist fehlgeschlagen.');
    },
    respond: (response) => response,
  });

  return (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> =>
    workflow(request, ctx);
};
