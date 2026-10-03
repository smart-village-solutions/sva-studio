import { createMutationWorkflow } from '@sva/server-runtime';

import type { QueryClient } from './query-client.js';
import type {
  LegacyGroupMutationAuthenticatedRequestContext,
  LegacyGroupMutationHandlerDeps,
  LegacyGroupMutationPreparedActor,
} from './legacy-group-mutation-handlers.js';

const SYSTEM_ADMIN_ROLES = new Set(['system_admin']);
export const CREATE_GROUP_ENDPOINT = 'POST:/api/v1/iam/groups';

export const createDatabaseUnavailableError = (
  deps: Pick<LegacyGroupMutationHandlerDeps, 'createApiError'>,
  requestId?: string
): Response =>
  deps.createApiError(
    503,
    'database_unavailable',
    'IAM-Datenbank ist nicht erreichbar.',
    requestId
  );

export const readGroupIdOrError = (
  deps: Pick<LegacyGroupMutationHandlerDeps, 'createApiError' | 'isUuid' | 'readPathSegment'>,
  request: Request,
  requestId?: string
): { readonly groupId: string } | { readonly error: Response } => {
  const groupId = deps.readPathSegment(request, 4);
  if (!groupId || !deps.isUuid(groupId)) {
    return {
      error: deps.createApiError(400, 'invalid_request', 'Ungültige groupId.', requestId),
    };
  }

  return { groupId };
};

const prepareLegacyGroupMutationRequest = async <TFeatureFlags>(
  deps: LegacyGroupMutationHandlerDeps<TFeatureFlags>,
  request: Request,
  ctx: LegacyGroupMutationAuthenticatedRequestContext
): Promise<{ readonly actor: LegacyGroupMutationPreparedActor } | { readonly error: Response }> => {
  const requestContext = deps.getWorkspaceContext();
  const featureCheck = deps.ensureFeature(
    deps.getFeatureFlags(),
    'iam_admin',
    requestContext.requestId
  );
  if (featureCheck) {
    return { error: featureCheck };
  }

  const roleCheck = deps.requireRoles(ctx, SYSTEM_ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return { error: roleCheck };
  }

  const actorResolution = await deps.resolveActorInfo(request, ctx, {
    requireActorMembership: true,
  });
  if ('error' in actorResolution) {
    return actorResolution;
  }

  const rateLimit = deps.consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return { error: rateLimit };
  }

  if (!actorResolution.actor.actorAccountId) {
    return {
      error: deps.createApiError(
        403,
        'forbidden',
        'Akteur-Account nicht gefunden.',
        actorResolution.actor.requestId
      ),
    };
  }

  return {
    actor: { ...actorResolution.actor, actorAccountId: actorResolution.actor.actorAccountId },
  };
};

export const replaceLegacyGroupRoles = async (
  client: QueryClient,
  input: {
    readonly instanceId: string;
    readonly groupId: string;
    readonly roleIds: readonly string[];
  }
) => {
  const uniqueRoleIds = [...new Set(input.roleIds)];
  await client.query(
    'DELETE FROM iam.group_roles WHERE instance_id = $1 AND group_id = $2::uuid;',
    [input.instanceId, input.groupId]
  );

  if (uniqueRoleIds.length === 0) {
    return;
  }

  await client.query(
    `
INSERT INTO iam.group_roles (instance_id, group_id, role_id)
SELECT $1, $2::uuid, role_id
FROM (
  SELECT DISTINCT role_id
  FROM unnest($3::uuid[]) AS input_roles(role_id)
) AS unique_role_ids;
`,
    [input.instanceId, input.groupId, uniqueRoleIds]
  );
};

export const validateLegacyGroupRoleIds = async <TFeatureFlags>(
  deps: Pick<LegacyGroupMutationHandlerDeps<TFeatureFlags>, 'resolveRolesByIds'>,
  client: QueryClient,
  input: { readonly instanceId: string; readonly roleIds: readonly string[] }
): Promise<boolean> => {
  const uniqueRoleIds = [...new Set(input.roleIds)];
  const roles = await deps.resolveRolesByIds(client, { ...input, roleIds: uniqueRoleIds });
  return roles.length === uniqueRoleIds.length;
};

export const readErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

type LegacyGroupMutationInput<TPrepared extends object, TIdempotency extends object, TInput> = {
  readonly prepare?: (
    state: Readonly<{
      request: Request;
      context: LegacyGroupMutationAuthenticatedRequestContext;
      actor: LegacyGroupMutationPreparedActor;
    }>
  ) => Promise<TPrepared | Response> | TPrepared | Response;
  readonly idempotency?: (
    state: Readonly<
      {
        request: Request;
        context: LegacyGroupMutationAuthenticatedRequestContext;
        actor: LegacyGroupMutationPreparedActor;
      } & TPrepared
    >
  ) => Promise<TIdempotency | Response> | TIdempotency | Response;
  readonly parse: (
    state: Readonly<
      {
        request: Request;
        context: LegacyGroupMutationAuthenticatedRequestContext;
        actor: LegacyGroupMutationPreparedActor;
      } & TPrepared &
        TIdempotency
    >
  ) => Promise<TInput | Response>;
  readonly execute: (
    state: Readonly<
      {
        request: Request;
        context: LegacyGroupMutationAuthenticatedRequestContext;
        actor: LegacyGroupMutationPreparedActor;
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
        context: LegacyGroupMutationAuthenticatedRequestContext;
        actor?: LegacyGroupMutationPreparedActor;
      } & Partial<TPrepared & TIdempotency>
    >
  ) => Response;
};

export const createLegacyGroupMutationHandler = <
  TFeatureFlags,
  TPrepared extends object = Record<never, never>,
  TIdempotency extends object = Record<never, never>,
  TInput = void,
>(
  deps: LegacyGroupMutationHandlerDeps<TFeatureFlags>,
  input: LegacyGroupMutationInput<TPrepared, TIdempotency, TInput>
) => {
  const runIdempotency = input.idempotency;
  const workflow = createMutationWorkflow<
    LegacyGroupMutationAuthenticatedRequestContext,
    { readonly actor: LegacyGroupMutationPreparedActor } & TPrepared,
    Record<never, never>,
    TIdempotency,
    TInput,
    Response
  >({
    prepare: async ({ request, context }) => {
      const actorResolution = await prepareLegacyGroupMutationRequest(deps, request, context);
      if ('error' in actorResolution) {
        return actorResolution.error;
      }

      const prepared = input.prepare
        ? await input.prepare({
            request,
            context,
            actor: actorResolution.actor,
          })
        : {};
      if (prepared instanceof Response) {
        return prepared;
      }

      return {
        actor: actorResolution.actor,
        ...prepared,
      } as { readonly actor: LegacyGroupMutationPreparedActor } & TPrepared;
    },
    authorize: async () => ({}),
    csrf: ({ request, actor }) => deps.validateCsrf(request, actor.requestId) ?? undefined,
    idempotency: runIdempotency ? async (state) => runIdempotency(state as never) : undefined,
    parse: async (state) => input.parse(state as never),
    execute: async (state) => input.execute(state as never),
    mapError: (error, state) =>
      input.mapError
        ? input.mapError(error, state as never)
        : createDatabaseUnavailableError(
            deps,
            state.actor?.requestId ?? deps.getWorkspaceContext().requestId
          ),
    respond: (response) => response,
  });

  return (
    request: Request,
    context: LegacyGroupMutationAuthenticatedRequestContext
  ): Promise<Response> => workflow(request, context);
};
