import {
  authorizeContentPrimitiveForUser,
  validateCsrf,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createMutationWorkflow, createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import { errorJson } from './content-route-core.js';
import { isMainserverMutationCapabilityEnabled } from './mainserver-mutation-capabilities.js';
import {
  resolveMainserverMutationActor,
  runMainserverMutationWithFailureFinalization,
  type MainserverMutationActor,
} from './mutation-principal.js';
import { toSurveyRouteErrorResponse } from './surveys-route-helpers.js';

export const SURVEYS_CONTENT_TYPE = 'surveys.survey';
export const SURVEYS_COLLECTION_PATH = '/api/v1/mainserver/surveys';

const logger = createSdkLogger({ component: 'sva-mainserver-surveys-route', level: 'info' });

export type SurveyContentActor = Readonly<{
  instanceId: string;
  keycloakSubject: string;
  activeOrganizationId?: string;
}>;

type AuthorizationDecision = Awaited<ReturnType<typeof authorizeContentPrimitiveForUser>>;
export type SurveyAuthorizationFailure = Extract<AuthorizationDecision, { readonly ok: false }>;

export const authorizeSurveyOrResponse = async (
  ctx: AuthenticatedRequestContext,
  action: 'read' | 'create' | 'update' | 'delete' | 'moderate',
  contentId?: string
): Promise<SurveyContentActor | Response> => {
  if (!ctx.user.instanceId) {
    return errorJson(400, 'invalid_instance_id', 'Kein Instanzkontext für Umfragen vorhanden.');
  }
  const result = await authorizeContentPrimitiveForUser({
    ctx,
    action: `surveys.${action}`,
    resource: {
      contentType: SURVEYS_CONTENT_TYPE,
      ...(contentId ? { contentId } : {}),
    },
    credentialVisibleCompatibility: action !== 'read',
  });
  if (!result.ok) {
    const workspaceContext = getWorkspaceContext();
    logger.warn('Mainserver survey local authorization denied', {
      operation: 'mainserver_survey_authorize',
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      content_type: SURVEYS_CONTENT_TYPE,
      content_id: contentId,
      action,
      error_code: result.error,
    });
    return errorJson(result.status, result.error, result.message);
  }
  return {
    instanceId: result.actor.instanceId,
    keycloakSubject: result.actor.keycloakSubject,
    ...((result.actor.organizationId ?? ctx.activeOrganizationId)
      ? { activeOrganizationId: result.actor.organizationId ?? ctx.activeOrganizationId }
      : {}),
  };
};

export const isSurveyAuthorizationDenial = (result: SurveyAuthorizationFailure): boolean =>
  result.status === 403 && result.error === 'forbidden';

export const toSurveyAuthorizationFailureResponse = (
  result: SurveyAuthorizationFailure
): Response => errorJson(result.status, result.error, result.message);

const authorizeSurveyMutation = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  action: 'create' | 'update' | 'delete' | 'moderate',
  contentId?: string
): Promise<MainserverMutationActor | Response> => {
  if (validateCsrf(request, getWorkspaceContext().requestId)) {
    return errorJson(403, 'csrf_validation_failed', 'Sicherheitsprüfung fehlgeschlagen.');
  }
  const actionId = `surveys.${action}`;
  if (!isMainserverMutationCapabilityEnabled(actionId)) {
    return errorJson(
      503,
      'mainserver_capability_unconfirmed',
      'Diese Mainserver-Aktion ist bis zur Bestätigung des Upstream-Vertrags deaktiviert.'
    );
  }
  const authorizedActor = await authorizeSurveyOrResponse(ctx, action, contentId);
  return authorizedActor instanceof Response
    ? authorizedActor
    : resolveMainserverMutationActor({ request, ctx, authorizedActor });
};

export const createSurveyMutationHandler = <TInput>(input: {
  readonly action: 'create' | 'update' | 'delete' | 'moderate';
  readonly contentId?: string;
  readonly parse: (request: Request) => Promise<TInput | Response>;
  readonly execute: (actor: MainserverMutationActor, parsed: TInput) => Promise<Response>;
}) => {
  const workflow = createMutationWorkflow<
    AuthenticatedRequestContext,
    { readonly requestId?: string; readonly contentId?: string },
    { readonly actor: MainserverMutationActor },
    Record<never, never>,
    TInput,
    Response
  >({
    prepare: () => ({
      requestId: getWorkspaceContext().requestId,
      ...(input.contentId ? { contentId: input.contentId } : {}),
    }),
    authorize: async ({ request, context, contentId }) => {
      const actor = await authorizeSurveyMutation(request, context, input.action, contentId);
      return actor instanceof Response ? actor : { actor };
    },
    parse: ({ request }) => input.parse(request),
    execute: ({ actor, input: parsed, contentId }) =>
      runMainserverMutationWithFailureFinalization({
        actor,
        contentId,
        operation: async () => input.execute(actor, parsed),
      }),
    mapError: toSurveyRouteErrorResponse,
    respond: (response) => response,
  });
  return (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> =>
    workflow(request, ctx);
};
