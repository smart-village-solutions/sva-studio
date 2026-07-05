import type {
  CreateUserActor,
  CreateUserHandlerDeps,
  CreateUserPayloadShape,
  CreateIdentityProvider,
  ParsedCreateUserBody,
} from './user-create-handler.js';

type ParsedCreateUserSuccess<TPayload extends CreateUserPayloadShape> = Extract<
  ParsedCreateUserBody<TPayload>,
  { readonly ok: true }
>;

type ReservedCreateUserMutation<TPayload extends CreateUserPayloadShape> = {
  readonly idempotencyKey: string;
  readonly parsed: ParsedCreateUserSuccess<TPayload>;
};

export const CREATE_USER_ENDPOINT = 'POST:/api/v1/iam/users';

const createInternalErrorBody = (requestId?: string) => ({
  error: {
    code: 'internal_error',
    message: 'Nutzer konnte nicht erstellt werden.',
  },
  ...(requestId ? { requestId } : {}),
});

export const resolveCreateUserErrorResponseBody = async (response: Response): Promise<unknown> => {
  try {
    return await response.clone().json();
  } catch {
    return createInternalErrorBody();
  }
};

export const failCreateIdempotency = async (
  deps: Pick<CreateUserHandlerDeps, 'completeIdempotency' | 'jsonResponse'>,
  input: {
    readonly actor: CreateUserActor;
    readonly idempotencyKey: string;
    readonly responseStatus: number;
    readonly responseBody: unknown;
  }
): Promise<Response> => {
  await deps.completeIdempotency({
    instanceId: input.actor.instanceId,
    actorAccountId: input.actor.actorAccountId,
    endpoint: CREATE_USER_ENDPOINT,
    idempotencyKey: input.idempotencyKey,
    status: 'FAILED',
    responseStatus: input.responseStatus,
    responseBody: input.responseBody,
  });
  return deps.jsonResponse(input.responseStatus, input.responseBody);
};

export const reserveCreateUserMutation = async <
  TPayload extends CreateUserPayloadShape,
  TIdentityProvider extends CreateIdentityProvider,
  TResult,
>(
  deps: CreateUserHandlerDeps<TPayload, TIdentityProvider, TResult>,
  input: {
    readonly request: Request;
    readonly actor: CreateUserActor;
  }
): Promise<ReservedCreateUserMutation<TPayload> | Response> => {
  const idempotencyKey = deps.requireIdempotencyKey(input.request, input.actor.requestId);
  if ('error' in idempotencyKey) {
    return idempotencyKey.error;
  }

  const parsed = await deps.parseCreateUserBody(input.request);
  if (!parsed.ok) {
    return deps.createApiError(400, 'invalid_request', 'Ungültiger Payload.', input.actor.requestId);
  }

  const reserve = await deps.reserveIdempotency({
    instanceId: input.actor.instanceId,
    actorAccountId: input.actor.actorAccountId,
    endpoint: CREATE_USER_ENDPOINT,
    idempotencyKey: idempotencyKey.key,
    payloadHash: deps.toPayloadHash(parsed.rawBody),
  });
  if (reserve.status === 'replay') {
    return deps.jsonResponse(reserve.responseStatus, reserve.responseBody);
  }
  if (reserve.status === 'conflict') {
    return deps.createApiError(409, 'idempotency_key_reuse', reserve.message, input.actor.requestId);
  }

  return {
    idempotencyKey: idempotencyKey.key,
    parsed,
  };
};

export const executeCreateUserMutation = async <
  TPayload extends CreateUserPayloadShape,
  TIdentityProvider extends CreateIdentityProvider,
  TResult,
>(
  deps: CreateUserHandlerDeps<TPayload, TIdentityProvider, TResult>,
  input: {
    readonly actor: CreateUserActor;
    readonly actorRoles: readonly string[];
    readonly actorSubject: string;
    readonly idempotencyKey: string;
    readonly parsed: ParsedCreateUserSuccess<TPayload>;
  }
): Promise<Response> => {
  const identityProvider = await deps.resolveIdentityProviderForInstance(input.actor.instanceId, {
    executionMode: 'tenant_admin',
  });
  if (!identityProvider) {
    return failCreateIdempotency(deps, {
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      responseStatus: 503,
      responseBody: deps.createIdpUnavailableBody(input.actor.requestId),
    });
  }

  try {
    const result = await deps.executeCreateUser({
      actor: {
        ...input.actor,
        actorRoles: input.actorRoles,
      },
      actorSubject: input.actorSubject,
      identityProvider,
      payload: input.parsed.data,
    });
    const responseBody = deps.asApiItem(result, input.actor.requestId);
    await deps.completeIdempotency({
      instanceId: input.actor.instanceId,
      actorAccountId: input.actor.actorAccountId,
      endpoint: CREATE_USER_ENDPOINT,
      idempotencyKey: input.idempotencyKey,
      status: 'COMPLETED',
      responseStatus: 201,
      responseBody,
    });
    deps.iamUserOperationsCounter.add(1, { action: 'create_user', result: 'success' });
    return deps.jsonResponse(201, responseBody);
  } catch (error) {
    if (error instanceof Response) {
      const responseBody = await resolveCreateUserErrorResponseBody(error);
      deps.logger.error('IAM create user failed with known response', {
        operation: 'create_user',
        instance_id: input.actor.instanceId,
        request_id: input.actor.requestId,
        trace_id: input.actor.traceId,
        response_status: error.status,
        response_body: responseBody,
      });
      deps.iamUserOperationsCounter.add(1, { action: 'create_user', result: 'failure' });
      return failCreateIdempotency(deps, {
        actor: input.actor,
        idempotencyKey: input.idempotencyKey,
        responseStatus: error.status,
        responseBody,
      });
    }

    deps.logger.error('IAM create user failed', {
      operation: 'create_user',
      instance_id: input.actor.instanceId,
      request_id: input.actor.requestId,
      trace_id: input.actor.traceId,
      error: error instanceof Error ? error.message : String(error),
    });
    deps.iamUserOperationsCounter.add(1, { action: 'create_user', result: 'failure' });
    return failCreateIdempotency(deps, {
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      responseStatus: 500,
      responseBody: createInternalErrorBody(input.actor.requestId),
    });
  }
};
