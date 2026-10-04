import { createMutationWorkflow } from '@sva/server-runtime';

import type { GroupQueryClient } from './group-query.js';
import type {
  GroupMutationActor,
  GroupMutationAuthenticatedRequestContext,
  GroupMutationHandlerDeps,
} from './group-mutation-handlers.js';

const createMissingGroupMutationAuthorizerResponse = (
  deps: GroupMutationHandlerDeps,
  requestId?: string
): Response =>
  deps.createApiError(
    403,
    'forbidden',
    'Autorisierungsstrategie für Gruppenmutationen ist nicht konfiguriert.',
    requestId,
    {
      reason_code: 'missing_group_mutation_authorizer',
    }
  );

const resolveGroupMutationActor = async (
  deps: GroupMutationHandlerDeps,
  request: Request,
  ctx: GroupMutationAuthenticatedRequestContext
): Promise<{ readonly actor: GroupMutationActor } | Response> => {
  const requestContext = deps.getWorkspaceContext();

  const accessCheck = deps.authorizeGroupMutationAccess
    ? await deps.authorizeGroupMutationAccess(request, ctx, requestContext.requestId)
    : createMissingGroupMutationAuthorizerResponse(deps, requestContext.requestId);
  if (accessCheck) {
    return accessCheck;
  }

  const actorResolution = await deps.resolveActorInfo(request, ctx, {
    requireActorMembership: true,
  });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  return { actor: actorResolution.actor };
};

export const readGroupIdOrError = (
  deps: GroupMutationHandlerDeps,
  request: Request,
  requestId?: string
): string | Response => {
  const groupId = deps.readPathSegment(request, 4);
  if (!groupId || !deps.isUuid(groupId)) {
    return deps.createApiError(400, 'invalid_request', 'Ungültige Gruppen-ID', requestId);
  }
  return groupId;
};

export const invalidateMembershipPermissionSnapshot = (
  deps: GroupMutationHandlerDeps,
  client: GroupQueryClient,
  actor: GroupMutationActor,
  keycloakSubject: string
) =>
  deps.notifyPermissionInvalidation(client, {
    instanceId: actor.instanceId,
    keycloakSubject,
    trigger: 'user_group_changed',
  });

export const resolveAccountId = async (
  client: GroupQueryClient,
  input: { readonly instanceId: string; readonly keycloakSubject: string }
): Promise<string | undefined> => {
  const result = await client.query<{ id: string }>(
    `
SELECT a.id
FROM iam.accounts a
JOIN iam.instance_memberships m ON m.account_id = a.id AND m.instance_id = $1
WHERE a.keycloak_subject = $2
LIMIT 1;
`,
    [input.instanceId, input.keycloakSubject]
  );
  return result.rows[0]?.id;
};

export const readErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const mapGroupMutationError = (
  deps: GroupMutationHandlerDeps,
  error: unknown,
  requestId?: string
): Response | undefined => {
  const message = readErrorMessage(error);

  if (message.includes('groups_instance_key_uniq')) {
    return deps.createApiError(
      409,
      'conflict',
      'Eine Gruppe mit diesem Schlüssel existiert bereits.',
      requestId
    );
  }

  if (message.includes('groups_type_chk')) {
    return deps.createApiError(400, 'invalid_request', 'Ungültiger Gruppentyp.', requestId, {
      classification: 'database_or_schema_drift',
      schema_object: 'iam.groups.group_type',
      reason_code: 'groups_type_constraint_violation',
    });
  }

  return undefined;
};

type GroupMutationWorkflowInput<TPrepared extends object, TInput> = {
  readonly prepare?: (
    state: Readonly<{
      request: Request;
      context: GroupMutationAuthenticatedRequestContext;
      actor: GroupMutationActor;
    }>
  ) => Promise<TPrepared | Response> | TPrepared | Response;
  readonly parse: (
    state: Readonly<
      {
        request: Request;
        context: GroupMutationAuthenticatedRequestContext;
        actor: GroupMutationActor;
      } & TPrepared
    >
  ) => Promise<TInput | Response>;
  readonly execute: (
    state: Readonly<
      {
        request: Request;
        context: GroupMutationAuthenticatedRequestContext;
        actor: GroupMutationActor;
        input: TInput;
      } & TPrepared
    >
  ) => Promise<Response>;
  readonly mapError?: (
    error: unknown,
    state: Readonly<
      {
        request: Request;
        context: GroupMutationAuthenticatedRequestContext;
        requestId?: string;
        actor?: GroupMutationActor;
      } & Partial<TPrepared>
    >
  ) => Response;
};

export const createGroupMutationHandler = <
  TPrepared extends object = Record<never, never>,
  TInput = void,
>(
  deps: GroupMutationHandlerDeps,
  input: GroupMutationWorkflowInput<TPrepared, TInput>
) => {
  const workflow = createMutationWorkflow<
    GroupMutationAuthenticatedRequestContext,
    {
      readonly requestId?: string;
    },
    {
      readonly actor: GroupMutationActor;
    } & TPrepared,
    Record<never, never>,
    TInput,
    Response
  >({
    prepare: () => {
      const requestContext = deps.getWorkspaceContext();
      return { requestId: requestContext.requestId };
    },
    csrf: ({ request, requestId }) => deps.validateCsrf(request, requestId) ?? undefined,
    authorize: async ({ request, context }) => {
      const resolved = await resolveGroupMutationActor(deps, request, context);
      if (resolved instanceof Response) {
        return resolved;
      }

      const prepared = input.prepare
        ? await input.prepare({ request, context, actor: resolved.actor })
        : {};
      if (prepared instanceof Response) {
        return prepared;
      }

      return {
        actor: resolved.actor,
        ...prepared,
      } as { readonly actor: GroupMutationActor } & TPrepared;
    },
    parse: async (state) => input.parse(state as never),
    execute: async (state) => input.execute(state as never),
    mapError: (error, state) =>
      input.mapError
        ? input.mapError(error, state as never)
        : deps.createApiError(
            503,
            'database_unavailable',
            'Gruppe konnte nicht verarbeitet werden.',
            state.actor?.requestId ?? state.requestId ?? deps.getWorkspaceContext().requestId
          ),
    respond: (response) => response,
  });

  return (request: Request, context: GroupMutationAuthenticatedRequestContext): Promise<Response> =>
    workflow(request, context);
};
