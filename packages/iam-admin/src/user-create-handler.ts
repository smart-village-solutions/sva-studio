import { createMutationWorkflow } from '@sva/server-runtime';
import {
  executeCreateUserMutation,
  reserveCreateUserMutation,
} from './user-create-handler-support.js';

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
  readonly groupIds?: readonly string[];
  readonly sendPasswordSetupEmail?: boolean;
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
    readonly executeActionsEmail?: (
      keycloakSubject: string,
      input: {
        readonly actions: readonly string[];
        readonly clientId?: string;
        readonly redirectUri?: string;
        readonly lifespan?: number;
      }
    ) => Promise<void>;
    readonly deactivateUser?: (keycloakSubject: string) => Promise<void>;
  };
};

export type ParsedCreateUserBody<TPayload extends CreateUserPayloadShape> =
  | { readonly ok: true; readonly data: TPayload; readonly rawBody: string }
  | { readonly ok: false };

type ParsedCreateUserSuccess<TPayload extends CreateUserPayloadShape> = Extract<
  ParsedCreateUserBody<TPayload>,
  { readonly ok: true }
>;

export type CreateUserApiErrorCode = 'invalid_request' | 'idempotency_key_reuse';

export type CreateUserHandlerDeps<
  TPayload extends CreateUserPayloadShape = CreateUserPayloadShape,
  TIdentityProvider extends CreateIdentityProvider = CreateIdentityProvider,
  TResult = unknown,
> = {
  readonly asApiItem: (data: TResult, requestId?: string) => unknown;
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
  readonly logger: {
    readonly error: (message: string, meta: Readonly<Record<string, unknown>>) => void;
  };
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

type PreparedCreateUserMutation = {
  readonly actor: CreateUserActor;
  readonly actorSubject: string;
};

type ReservedCreateUserMutation<TPayload extends CreateUserPayloadShape> = {
  readonly idempotencyKey: string;
  readonly parsed: ParsedCreateUserSuccess<TPayload>;
};

export const createCreateUserHandlerInternal =
  <
    TPayload extends CreateUserPayloadShape,
    TIdentityProvider extends CreateIdentityProvider,
    TResult,
  >(
    deps: CreateUserHandlerDeps<TPayload, TIdentityProvider, TResult>
  ) => {
    const workflow = createMutationWorkflow<
      CreateAuthenticatedRequestContext,
      PreparedCreateUserMutation,
      Record<never, never>,
      ReservedCreateUserMutation<TPayload>,
      ParsedCreateUserSuccess<TPayload>,
      Response
    >({
      prepare: async ({ request, context }) => {
        const actorContext = await deps.resolveCreateUserActorContext(request, context);
        if (actorContext instanceof Response) {
          return actorContext;
        }

        return actorContext;
      },
      authorize: async () => ({}),
      idempotency: async ({ request, actor }) => await reserveCreateUserMutation(deps, { request, actor }),
      parse: async ({ parsed }) => parsed,
      execute: async ({ actor, actorSubject, context, idempotencyKey, input: parsed }) =>
        await executeCreateUserMutation(deps, {
          actor,
          actorRoles: context.user.roles,
          actorSubject,
          idempotencyKey,
          parsed,
        }),
      mapError: (_error, state) =>
        deps.jsonResponse(500, {
          error: {
            code: 'internal_error',
            message: 'Nutzer konnte nicht erstellt werden.',
          },
          ...(state.actor?.requestId ? { requestId: state.actor.requestId } : {}),
        }),
      respond: (response) => response,
    });

    return (request: Request, context: CreateAuthenticatedRequestContext): Promise<Response> =>
      workflow(request, context);
  };
