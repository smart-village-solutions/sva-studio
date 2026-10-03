import { createMutationWorkflow } from '@sva/server-runtime';

import type {
  OrganizationMutationActor,
  OrganizationMutationAuthenticatedRequestContext,
  OrganizationMutationHandlerDeps,
  PreparedOrganizationMutationActor,
} from './organization-mutation-handlers.js';

const createMissingOrganizationMutationAuthorizerResponse = <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  requestId?: string
): Response =>
  deps.createApiError(
    403,
    'forbidden',
    'Autorisierungsstrategie für Organisationsmutationen ist nicht konfiguriert.',
    requestId,
    {
      reason_code: 'missing_organization_mutation_authorizer',
    }
  );

const prepareAdminMutation = async <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  request: Request,
  ctx: OrganizationMutationAuthenticatedRequestContext
): Promise<
  { readonly actor: PreparedOrganizationMutationActor } | { readonly error: Response }
> => {
  const requestContext = deps.getWorkspaceContext();
  const featureCheck = deps.ensureFeature(
    deps.getFeatureFlags(),
    'iam_admin',
    requestContext.requestId
  );
  if (featureCheck) {
    return { error: featureCheck };
  }
  const accessCheck = deps.authorizeOrganizationMutationAccess
    ? await deps.authorizeOrganizationMutationAccess(request, ctx, requestContext.requestId)
    : createMissingOrganizationMutationAuthorizerResponse(deps, requestContext.requestId);
  if (accessCheck) {
    return { error: accessCheck };
  }

  const actorResolution = await deps.resolveActorInfo(request, ctx, {
    requireActorMembership: true,
    provisionMissingActorMembership: true,
  });
  if ('error' in actorResolution) {
    return actorResolution;
  }
  if (!actorResolution.actor.actorAccountId) {
    return {
      error: deps.createApiError(
        403,
        'forbidden',
        'Akteur-Account nicht gefunden.',
        actorResolution.actor.requestId,
        deps.createActorResolutionDetails({
          actorResolution: 'missing_actor_account',
          instanceId: actorResolution.actor.instanceId,
        })
      ),
    };
  }

  return {
    actor: { ...actorResolution.actor, actorAccountId: actorResolution.actor.actorAccountId },
  };
};

const consumeWriteRateLimit = <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  actor: OrganizationMutationActor,
  ctx: OrganizationMutationAuthenticatedRequestContext
): Response | null =>
  deps.consumeRateLimit({
    instanceId: actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actor.requestId,
  });

export const readOrganizationId = <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  request: Request,
  requestId?: string
): string | Response => {
  const organizationId = deps.readPathSegment(request, 4);
  if (!organizationId || !deps.isUuid(organizationId)) {
    return deps.createApiError(
      400,
      'invalid_organization_id',
      'Ungültige organizationId.',
      requestId
    );
  }
  return organizationId;
};

export const completeFailedIdempotency = async <TFeatureFlags>(
  deps: Pick<
    OrganizationMutationHandlerDeps<TFeatureFlags>,
    'completeIdempotency' | 'jsonResponse'
  >,
  input: {
    readonly actor: PreparedOrganizationMutationActor;
    readonly endpoint: string;
    readonly idempotencyKey: string;
    readonly responseStatus: number;
    readonly responseBody: unknown;
  }
): Promise<Response> => {
  await deps.completeIdempotency({
    instanceId: input.actor.instanceId,
    actorAccountId: input.actor.actorAccountId,
    endpoint: input.endpoint,
    idempotencyKey: input.idempotencyKey,
    status: 'FAILED',
    responseStatus: input.responseStatus,
    responseBody: input.responseBody,
  });
  return deps.jsonResponse(input.responseStatus, input.responseBody);
};

type OrganizationAdminMutationState = {
  readonly actor: PreparedOrganizationMutationActor;
};

type OrganizationAdminMutationInput<
  TPrepared extends object,
  TIdempotency extends object,
  TInput,
> = {
  readonly prepare?: (
    state: Readonly<{
      request: Request;
      context: OrganizationMutationAuthenticatedRequestContext;
      actor: PreparedOrganizationMutationActor;
    }>
  ) => Promise<TPrepared | Response> | TPrepared | Response;
  readonly requireRateLimit?: boolean;
  readonly idempotency?: (
    state: Readonly<
      {
        request: Request;
        context: OrganizationMutationAuthenticatedRequestContext;
        actor: PreparedOrganizationMutationActor;
      } & TPrepared
    >
  ) => Promise<TIdempotency | Response> | TIdempotency | Response;
  readonly parse: (
    state: Readonly<
      {
        request: Request;
        context: OrganizationMutationAuthenticatedRequestContext;
        actor: PreparedOrganizationMutationActor;
      } & TPrepared &
        TIdempotency
    >
  ) => Promise<TInput | Response>;
  readonly execute: (
    state: Readonly<
      {
        request: Request;
        context: OrganizationMutationAuthenticatedRequestContext;
        actor: PreparedOrganizationMutationActor;
        input: TInput;
      } & TPrepared &
        TIdempotency
    >
  ) => Promise<Response>;
  readonly mapError?: (
    error: unknown,
    state: Readonly<
      {
        request: Request;
        context: OrganizationMutationAuthenticatedRequestContext;
        actor?: PreparedOrganizationMutationActor;
      } & Partial<TPrepared & TIdempotency>
    >
  ) => Response;
};

export const createAdminMutationHandler = <
  TFeatureFlags,
  TPrepared extends object = Record<never, never>,
  TIdempotency extends object = Record<never, never>,
  TInput = void,
>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  input: OrganizationAdminMutationInput<TPrepared, TIdempotency, TInput>
) => {
  const runIdempotency = input.idempotency;
  const workflow = createMutationWorkflow<
    OrganizationMutationAuthenticatedRequestContext,
    OrganizationAdminMutationState & TPrepared,
    Record<never, never>,
    TIdempotency,
    TInput,
    Response
  >({
    prepare: async ({ request, context }) => {
      const prepared = await prepareAdminMutation(deps, request, context);
      if ('error' in prepared) {
        return prepared.error;
      }

      const preparedState = input.prepare
        ? await input.prepare({
            request,
            context,
            actor: prepared.actor,
          })
        : {};
      if (preparedState instanceof Response) {
        return preparedState;
      }

      return {
        actor: prepared.actor,
        ...preparedState,
      } as OrganizationAdminMutationState & TPrepared;
    },
    authorize: async () => ({}),
    csrf: ({ request, context, actor }) => {
      const csrfError = deps.validateCsrf(request, actor.requestId);
      if (csrfError) {
        return csrfError;
      }

      if (input.requireRateLimit) {
        const rateLimit = consumeWriteRateLimit(deps, actor, context);
        if (rateLimit) {
          return rateLimit;
        }
      }

      return undefined;
    },
    idempotency: runIdempotency
      ? async (state) => {
          return runIdempotency(
            state as Readonly<
              {
                request: Request;
                context: OrganizationMutationAuthenticatedRequestContext;
                actor: PreparedOrganizationMutationActor;
              } & TPrepared
            >
          );
        }
      : undefined,
    parse: async (state) => input.parse(state as never),
    execute: async (state) => input.execute(state as never),
    mapError: (error, state) =>
      input.mapError
        ? input.mapError(error, state as never)
        : deps.createApiError(
            503,
            'database_unavailable',
            'IAM-Datenbank ist nicht erreichbar.',
            state.actor?.requestId ?? deps.getWorkspaceContext().requestId
          ),
    respond: (response) => response,
  });

  return (
    request: Request,
    context: OrganizationMutationAuthenticatedRequestContext
  ): Promise<Response> => workflow(request, context);
};
