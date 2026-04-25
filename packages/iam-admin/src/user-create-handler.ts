import type { IdempotencyReserveResult } from './types.js';

export type CreateAuthenticatedRequestContext = {
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly instanceId?: string;
    readonly roles: string[];
  };
};

export type CreateUserActor = {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

export type CreateUserActorContext = {
  readonly actor: CreateUserActor;
  readonly actorSubject: string;
};

export type CreateUserPayloadShape = {
  readonly email: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly status?: 'active' | 'inactive' | 'pending';
  readonly roleIds: readonly string[];
};

export type CreateIdentityProvider = {
  readonly provider: {
    readonly createUser: (input: {
      readonly username: string;
      readonly email: string;
      readonly firstName?: string;
      readonly lastName?: string;
      readonly enabled: boolean;
      readonly attributes: Readonly<Record<string, string>>;
    }) => Promise<{ readonly externalId: string }>;
    readonly syncRoles: (keycloakSubject: string, roleNames: readonly string[]) => Promise<void>;
    readonly deactivateUser?: (keycloakSubject: string) => Promise<void>;
  };
};

export type ParsedCreateUserBody<TPayload extends CreateUserPayloadShape> =
  | { readonly ok: true; readonly data: TPayload; readonly rawBody: string }
  | { readonly ok: false };

export type CreateUserApiErrorCode = 'invalid_request' | 'idempotency_key_reuse';

export type CreateUserHandlerDeps<
  TPayload extends CreateUserPayloadShape = CreateUserPayloadShape,
  TIdentityProvider extends CreateIdentityProvider = CreateIdentityProvider,
  TResult extends { readonly responseData: unknown } = { readonly responseData: unknown },
> = {
  readonly asApiItem: (data: unknown, requestId?: string) => unknown;
  readonly completeIdempotency: (input: {
    readonly instanceId: string;
    readonly actorAccountId: string;
    readonly endpoint: string;
    readonly idempotencyKey: string;
    readonly status: 'COMPLETED' | 'FAILED';
    readonly responseStatus: number;
    readonly responseBody: unknown;
  }) => Promise<void>;
  readonly createApiError: (
    status: number,
    code: CreateUserApiErrorCode,
    message: string,
    requestId?: string
  ) => Response;
  readonly createIdpUnavailableBody: (requestId?: string) => unknown;
  readonly executeCreateUser: (input: {
    readonly actor: CreateUserActor & { readonly actorRoles: readonly string[] };
    readonly actorSubject: string;
    readonly identityProvider: TIdentityProvider;
    readonly payload: TPayload;
  }) => Promise<TResult>;
  readonly iamUserOperationsCounter: {
    readonly add: (value: number, attributes: Readonly<Record<string, string>>) => void;
  };
  readonly jsonResponse: (status: number, payload: unknown) => Response;
  readonly parseCreateUserBody: (request: Request) => Promise<ParsedCreateUserBody<TPayload>>;
  readonly requireIdempotencyKey: (
    request: Request,
    requestId?: string
  ) => { readonly key: string } | { readonly error: Response };
  readonly reserveIdempotency: (input: {
    readonly instanceId: string;
    readonly actorAccountId: string;
    readonly endpoint: string;
    readonly idempotencyKey: string;
    readonly payloadHash: string;
  }) => Promise<IdempotencyReserveResult>;
  readonly resolveCreateUserActorContext: (
    request: Request,
    ctx: CreateAuthenticatedRequestContext
  ) => Promise<CreateUserActorContext | Response>;
  readonly resolveIdentityProviderForInstance: (
    instanceId: string,
    input: { readonly executionMode: 'tenant_admin' }
  ) => Promise<TIdentityProvider | null | undefined>;
  readonly toPayloadHash: (rawBody: string) => string;
};

const CREATE_USER_ENDPOINT = 'POST:/api/v1/iam/users';

const failCreateIdempotency = async (
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

export const createCreateUserHandlerInternal =
  <
    TPayload extends CreateUserPayloadShape,
    TIdentityProvider extends CreateIdentityProvider,
    TResult extends { readonly responseData: unknown },
  >(
    deps: CreateUserHandlerDeps<TPayload, TIdentityProvider, TResult>
  ) =>
  async (request: Request, ctx: CreateAuthenticatedRequestContext): Promise<Response> => {
    const actorContext = await deps.resolveCreateUserActorContext(request, ctx);
    if (actorContext instanceof Response) {
      return actorContext;
    }

    const idempotencyKey = deps.requireIdempotencyKey(request, actorContext.actor.requestId);
    if ('error' in idempotencyKey) {
      return idempotencyKey.error;
    }

    const parsed = await deps.parseCreateUserBody(request);
    if (!parsed.ok) {
      return deps.createApiError(400, 'invalid_request', 'Ungültiger Payload.', actorContext.actor.requestId);
    }

    const reserve = await deps.reserveIdempotency({
      instanceId: actorContext.actor.instanceId,
      actorAccountId: actorContext.actor.actorAccountId,
      endpoint: CREATE_USER_ENDPOINT,
      idempotencyKey: idempotencyKey.key,
      payloadHash: deps.toPayloadHash(parsed.rawBody),
    });
    if (reserve.status === 'replay') {
      return deps.jsonResponse(reserve.responseStatus, reserve.responseBody);
    }
    if (reserve.status === 'conflict') {
      return deps.createApiError(409, 'idempotency_key_reuse', reserve.message, actorContext.actor.requestId);
    }

    const identityProvider = await deps.resolveIdentityProviderForInstance(actorContext.actor.instanceId, {
      executionMode: 'tenant_admin',
    });
    if (!identityProvider) {
      return failCreateIdempotency(deps, {
        actor: actorContext.actor,
        idempotencyKey: idempotencyKey.key,
        responseStatus: 503,
        responseBody: deps.createIdpUnavailableBody(actorContext.actor.requestId),
      });
    }

    try {
      const result = await deps.executeCreateUser({
        actor: {
          ...actorContext.actor,
          actorRoles: ctx.user.roles,
        },
        actorSubject: actorContext.actorSubject,
        identityProvider,
        payload: parsed.data,
      });
      const responseBody = deps.asApiItem(result.responseData, actorContext.actor.requestId);
      await deps.completeIdempotency({
        instanceId: actorContext.actor.instanceId,
        actorAccountId: actorContext.actor.actorAccountId,
        endpoint: CREATE_USER_ENDPOINT,
        idempotencyKey: idempotencyKey.key,
        status: 'COMPLETED',
        responseStatus: 201,
        responseBody,
      });
      deps.iamUserOperationsCounter.add(1, { action: 'create_user', result: 'success' });
      return deps.jsonResponse(201, responseBody);
    } catch {
      deps.iamUserOperationsCounter.add(1, { action: 'create_user', result: 'failure' });
      return failCreateIdempotency(deps, {
        actor: actorContext.actor,
        idempotencyKey: idempotencyKey.key,
        responseStatus: 500,
        responseBody: {
          error: {
            code: 'internal_error',
            message: 'Nutzer konnte nicht erstellt werden.',
          },
          ...(actorContext.actor.requestId ? { requestId: actorContext.actor.requestId } : {}),
        },
      });
    }
  };
