import type { ApiErrorResponse } from '@sva/core';

import type { IdempotencyReserveResult } from './types.js';

export type CreateRoleAuthenticatedRequestContext = {
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly instanceId?: string;
    readonly roles: string[];
  };
};

export type CreateRoleActor = {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

export type CreateRolePayloadShape = {
  readonly roleName: string;
  readonly displayName?: string;
  readonly description?: string | null;
  readonly roleLevel: number;
  readonly permissionIds: readonly string[];
};

export type CreateRoleIdentityProvider<TAttributes = unknown> = {
  readonly provider: {
    readonly createRole: (input: {
      readonly externalName: string;
      readonly description?: string;
      readonly attributes: TAttributes;
    }) => Promise<unknown>;
    readonly deleteRole: (externalName: string) => Promise<void>;
  };
};

export type ParsedCreateRoleBody<TPayload extends CreateRolePayloadShape> =
  | { readonly ok: true; readonly data: TPayload; readonly rawBody: string }
  | { readonly ok: false };

export type CreateRoleHandlerDeps<
  TPayload extends CreateRolePayloadShape = CreateRolePayloadShape,
  TAttributes = unknown,
  TIdentityProvider extends CreateRoleIdentityProvider<TAttributes> = CreateRoleIdentityProvider<TAttributes>,
  TRole = unknown,
> = {
  readonly asApiItem: (data: unknown, requestId?: string) => unknown;
  readonly buildRoleAttributes: (input: {
    readonly instanceId: string;
    readonly roleKey: string;
    readonly displayName: string;
  }) => TAttributes;
  readonly buildRoleSyncFailure: (input: {
    readonly error: unknown;
    readonly requestId?: string;
    readonly fallbackMessage: string;
  }) => Response;
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
    code: 'conflict' | 'idempotency_key_reuse' | 'internal_error' | 'invalid_request' | 'keycloak_unavailable',
    message: string,
    requestId?: string,
    details?: Readonly<Record<string, unknown>>
  ) => Response;
  readonly iamRoleSyncCounter: {
    readonly add: (value: number, attributes: Readonly<Record<string, string>>) => void;
  };
  readonly iamUserOperationsCounter: {
    readonly add: (value: number, attributes: Readonly<Record<string, string>>) => void;
  };
  readonly jsonResponse: (status: number, payload: unknown) => Response;
  readonly logger: {
    readonly error: (message: string, meta: Readonly<Record<string, unknown>>) => void;
  };
  readonly mapRoleSyncErrorCode: (error: unknown) => string;
  readonly parseCreateRoleBody: (request: Request) => Promise<ParsedCreateRoleBody<TPayload>>;
  readonly persistCreatedRole: (input: {
    readonly actor: CreateRoleActor;
    readonly roleKey: string;
    readonly displayName: string;
    readonly externalRoleName: string;
    readonly description?: string;
    readonly roleLevel: number;
    readonly permissionIds: readonly string[];
  }) => Promise<TRole>;
  readonly requireIdempotencyKey: (
    request: Request,
    requestId?: string
  ) => { readonly key: string } | { readonly error: Response };
  readonly requireRoleIdentityProvider: (
    instanceId: string,
    requestId?: string
  ) => Promise<TIdentityProvider | Response>;
  readonly reserveIdempotency: (input: {
    readonly instanceId: string;
    readonly actorAccountId: string;
    readonly endpoint: string;
    readonly idempotencyKey: string;
    readonly payloadHash: string;
  }) => Promise<IdempotencyReserveResult>;
  readonly resolveRoleMutationActor: (
    request: Request,
    ctx: CreateRoleAuthenticatedRequestContext
  ) => Promise<{ readonly actor: CreateRoleActor } | { readonly response: Response }>;
  readonly sanitizeRoleErrorMessage: (error: unknown) => string;
  readonly toPayloadHash: (rawBody: string) => string;
  readonly trackKeycloakCall: <T>(
    operation: 'create_role' | 'delete_role_compensation',
    work: () => Promise<T>
  ) => Promise<T>;
};

const CREATE_ROLE_ENDPOINT = 'POST:/api/v1/iam/roles';

const buildCreateRoleUnavailableBody = (requestId?: string): ApiErrorResponse => ({
  error: {
    code: 'keycloak_unavailable',
    message: 'Keycloak Admin API ist nicht konfiguriert.',
    details: {
      syncState: 'failed',
      syncError: { code: 'IDP_UNAVAILABLE' },
    },
  },
  ...(requestId ? { requestId } : {}),
});

const buildCreateRoleDbWriteFailureBody = (requestId?: string): ApiErrorResponse => ({
  error: {
    code: 'conflict',
    message: 'Rolle konnte nicht erstellt werden.',
    details: {
      syncState: 'failed',
      syncError: { code: 'DB_WRITE_FAILED' },
    },
  },
  ...(requestId ? { requestId } : {}),
});

const completeCreateRoleIdempotency = async (
  deps: Pick<CreateRoleHandlerDeps, 'completeIdempotency'>,
  input: {
    readonly actor: CreateRoleActor;
    readonly idempotencyKey: string;
    readonly status: 'COMPLETED' | 'FAILED';
    readonly responseStatus: number;
    readonly responseBody: unknown;
  }
) => {
  await deps.completeIdempotency({
    instanceId: input.actor.instanceId,
    actorAccountId: input.actor.actorAccountId,
    endpoint: CREATE_ROLE_ENDPOINT,
    idempotencyKey: input.idempotencyKey,
    status: input.status,
    responseStatus: input.responseStatus,
    responseBody: input.responseBody,
  });
};

export const createCreateRoleHandlerInternal =
  <
    TPayload extends CreateRolePayloadShape,
    TAttributes,
    TIdentityProvider extends CreateRoleIdentityProvider<TAttributes>,
    TRole,
  >(
    deps: CreateRoleHandlerDeps<TPayload, TAttributes, TIdentityProvider, TRole>
  ) =>
  async (request: Request, ctx: CreateRoleAuthenticatedRequestContext): Promise<Response> => {
    const resolvedActor = await deps.resolveRoleMutationActor(request, ctx);
    if ('response' in resolvedActor) {
      return resolvedActor.response;
    }

    const { actor } = resolvedActor;
    const idempotencyKey = deps.requireIdempotencyKey(request, actor.requestId);
    if ('error' in idempotencyKey) {
      return idempotencyKey.error;
    }

    const parsed = await deps.parseCreateRoleBody(request);
    if (!parsed.ok) {
      return deps.createApiError(400, 'invalid_request', 'Ungültiger Payload.', actor.requestId);
    }

    const reserve = await deps.reserveIdempotency({
      instanceId: actor.instanceId,
      actorAccountId: actor.actorAccountId,
      endpoint: CREATE_ROLE_ENDPOINT,
      idempotencyKey: idempotencyKey.key,
      payloadHash: deps.toPayloadHash(parsed.rawBody),
    });
    if (reserve.status === 'replay') {
      return deps.jsonResponse(reserve.responseStatus, reserve.responseBody);
    }
    if (reserve.status === 'conflict') {
      return deps.createApiError(409, 'idempotency_key_reuse', reserve.message, actor.requestId);
    }

    const identityProvider = await deps.requireRoleIdentityProvider(actor.instanceId, actor.requestId);
    if (identityProvider instanceof Response) {
      const responseBody = buildCreateRoleUnavailableBody(actor.requestId);
      await completeCreateRoleIdempotency(deps, {
        actor,
        idempotencyKey: idempotencyKey.key,
        status: 'FAILED',
        responseStatus: 503,
        responseBody,
      });
      return deps.jsonResponse(503, responseBody);
    }

    const roleKey = parsed.data.roleName;
    const displayName = parsed.data.displayName?.trim() || roleKey;
    const externalRoleName = roleKey;
    let createdInIdentityProvider = false;

    try {
      await deps.trackKeycloakCall('create_role', () =>
        identityProvider.provider.createRole({
          externalName: externalRoleName,
          description: parsed.data.description ?? undefined,
          attributes: deps.buildRoleAttributes({
            instanceId: actor.instanceId,
            roleKey,
            displayName,
          }),
        })
      );
      createdInIdentityProvider = true;

      const role = await deps.persistCreatedRole({
        actor,
        roleKey,
        displayName,
        externalRoleName,
        description: parsed.data.description ?? undefined,
        roleLevel: parsed.data.roleLevel,
        permissionIds: parsed.data.permissionIds,
      });

      deps.iamUserOperationsCounter.add(1, { action: 'create_role', result: 'success' });
      deps.iamRoleSyncCounter.add(1, { operation: 'create', result: 'success', error_code: 'none' });

      const responseBody = deps.asApiItem(role, actor.requestId);
      await completeCreateRoleIdempotency(deps, {
        actor,
        idempotencyKey: idempotencyKey.key,
        status: 'COMPLETED',
        responseStatus: 201,
        responseBody,
      });
      return deps.jsonResponse(201, responseBody);
    } catch (error) {
      if (createdInIdentityProvider) {
        try {
          await deps.trackKeycloakCall('delete_role_compensation', () =>
            identityProvider.provider.deleteRole(externalRoleName)
          );
        } catch (compensationError) {
          deps.iamRoleSyncCounter.add(1, {
            operation: 'create',
            result: 'failure',
            error_code: 'COMPENSATION_FAILED',
          });
          deps.logger.error('Role create compensation failed', {
            operation: 'create_role_compensation',
            instance_id: actor.instanceId,
            request_id: actor.requestId,
            trace_id: actor.traceId,
            role_key: roleKey,
            external_role_name: externalRoleName,
            error_code: 'COMPENSATION_FAILED',
            error: deps.sanitizeRoleErrorMessage(compensationError),
          });
          const responseBody = deps.createApiError(
            500,
            'internal_error',
            'Rolle konnte nicht konsistent erstellt werden.',
            actor.requestId,
            {
              syncState: 'failed',
              syncError: { code: 'COMPENSATION_FAILED' },
            }
          );
          await completeCreateRoleIdempotency(deps, {
            actor,
            idempotencyKey: idempotencyKey.key,
            status: 'FAILED',
            responseStatus: 500,
            responseBody: await responseBody.clone().json(),
          });
          return responseBody;
        }

        deps.iamRoleSyncCounter.add(1, {
          operation: 'create',
          result: 'failure',
          error_code: 'DB_WRITE_FAILED',
        });
        const responseBody = buildCreateRoleDbWriteFailureBody(actor.requestId);
        await completeCreateRoleIdempotency(deps, {
          actor,
          idempotencyKey: idempotencyKey.key,
          status: 'FAILED',
          responseStatus: 409,
          responseBody,
        });
        return deps.jsonResponse(409, responseBody);
      }

      deps.iamUserOperationsCounter.add(1, { action: 'create_role', result: 'failure' });
      deps.iamRoleSyncCounter.add(1, {
        operation: 'create',
        result: 'failure',
        error_code: deps.mapRoleSyncErrorCode(error),
      });
      const failureResponse = deps.buildRoleSyncFailure({
        error,
        requestId: actor.requestId,
        fallbackMessage: 'Rolle konnte nicht erstellt werden.',
      });
      await completeCreateRoleIdempotency(deps, {
        actor,
        idempotencyKey: idempotencyKey.key,
        status: 'FAILED',
        responseStatus: failureResponse.status,
        responseBody: await failureResponse.clone().json(),
      });
      return failureResponse;
    }
  };
