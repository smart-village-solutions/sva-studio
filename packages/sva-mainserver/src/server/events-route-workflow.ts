import type { AuthenticatedRequestContext } from '@sva/auth-runtime/server';
import { createMutationWorkflow, createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import { isResponse } from './content-route-core.js';
import { isUnexpectedMainserverError, SvaMainserverError } from './errors.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';
import {
  runMainserverMutationWithFailureFinalization,
  type MainserverMutationActor,
} from './mutation-principal.js';
import {
  authorizeMutationOrResponse,
  contentTypeFor,
  pluginActionFor,
  validateMutationRequest,
  type RouteMatch,
} from './events-route-access.js';

const logger = createSdkLogger({ component: 'sva-mainserver-events-route', level: 'info' });
type ContentKind = 'events';

const logMutationWorkflowFailure = (input: {
  readonly request: Request;
  readonly context: AuthenticatedRequestContext;
  readonly contentKind: ContentKind;
  readonly contentId?: string;
  readonly requestId?: string;
  readonly error: unknown;
}) => {
  const logFailure = isUnexpectedMainserverError(input.error) ? logger.error : logger.warn;
  logFailure('Mainserver content route failed', {
    operation: 'mainserver_content_request',
    request_id: input.requestId,
    trace_id: getWorkspaceContext().traceId,
    actor_id: input.context.user.id,
    instance_id: input.context.user.instanceId,
    content_type: contentTypeFor(input.contentKind),
    content_id: input.contentId,
    method: input.request.method,
    error_code: input.error instanceof SvaMainserverError ? input.error.code : 'internal_error',
  });
};

export const createContentMutationHandler = <TInput>(input: {
  readonly route: Extract<RouteMatch, { readonly kind: 'collection' | 'item' }>;
  readonly action: 'create' | 'update' | 'delete';
  readonly requestId?: string;
  readonly parse: (request: Request) => Promise<TInput | Response>;
  readonly execute: (actor: MainserverMutationActor, parsed: TInput) => Promise<Response>;
}) => {
  const workflow = createMutationWorkflow<
    AuthenticatedRequestContext,
    {
      readonly requestId?: string;
      readonly contentId?: string;
    },
    {
      readonly actor: MainserverMutationActor;
    },
    Record<never, never>,
    TInput,
    Response
  >({
    prepare: () => ({
      requestId: input.requestId,
      ...(input.route.kind === 'item' ? { contentId: input.route.itemId } : {}),
    }),
    authorize: async ({ request, context, contentId }) => {
      const actor = await authorizeMutationOrResponse(
        request,
        context,
        input.route.contentKind,
        pluginActionFor(input.route.contentKind, input.action),
        contentId
      );
      return isResponse(actor) ? actor : { actor };
    },
    csrf: ({ request, requestId }) => validateMutationRequest(request, requestId) ?? undefined,
    parse: ({ request }) => input.parse(request),
    execute: async ({ actor, input: parsed, contentId }) =>
      runMainserverMutationWithFailureFinalization({
        actor,
        contentId,
        operation: async () => await input.execute(actor, parsed),
      }),
    mapError: (error, state) => {
      logMutationWorkflowFailure({
        request: state.request,
        context: state.context,
        contentKind: input.route.contentKind,
        contentId: state.contentId,
        requestId: state.requestId,
        error,
      });
      return toMainserverErrorResponse(error, 'Mainserver-Anfrage ist fehlgeschlagen.');
    },
    respond: (response) => response,
  });

  return (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> =>
    workflow(request, ctx);
};
