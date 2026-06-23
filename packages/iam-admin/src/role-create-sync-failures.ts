import type { ApiErrorResponse } from '@sva/core';

import type {
  CreateRoleHandlerDeps,
  CreateRoleIdentityProvider,
  CreateRolePayloadShape,
} from './role-create-handler.js';
import type { PreparedRoleCreate } from './role-create-sync.js';

export const CREATE_ROLE_ENDPOINT = 'POST:/api/v1/iam/roles';

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

export const completeCreateRoleIdempotency = async (
  deps: Pick<CreateRoleHandlerDeps, 'completeIdempotency'>,
  input: {
    readonly actor: PreparedRoleCreate<CreateRolePayloadShape>['actor'];
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

const recordCreateRoleOperationFailure = <
  TPayload extends CreateRolePayloadShape,
  TAttributes,
  TIdentityProvider extends CreateRoleIdentityProvider<TAttributes>,
  TRole,
>(
  deps: CreateRoleHandlerDeps<TPayload, TAttributes, TIdentityProvider, TRole>
) => {
  deps.iamUserOperationsCounter.add(1, { action: 'create_role', result: 'failure' });
};

const logCreateRoleDatabaseWriteFailure = <
  TPayload extends CreateRolePayloadShape,
  TAttributes,
  TIdentityProvider extends CreateRoleIdentityProvider<TAttributes>,
  TRole,
>(
  deps: CreateRoleHandlerDeps<TPayload, TAttributes, TIdentityProvider, TRole>,
  input: PreparedRoleCreate<TPayload>,
  error: unknown,
  message: string
) => {
  deps.logger.error(message, {
    operation: 'create_role',
    instance_id: input.actor.instanceId,
    request_id: input.actor.requestId,
    trace_id: input.actor.traceId,
    role_key: input.roleKey,
    external_role_name: input.externalRoleName,
    error_code: 'DB_WRITE_FAILED',
    error: deps.sanitizeRoleErrorMessage(error),
  });
};

export const failCreateRoleUnavailable = async <
  TPayload extends CreateRolePayloadShape,
  TAttributes,
  TIdentityProvider extends CreateRoleIdentityProvider<TAttributes>,
  TRole,
>(
  deps: CreateRoleHandlerDeps<TPayload, TAttributes, TIdentityProvider, TRole>,
  input: PreparedRoleCreate<TPayload>
): Promise<Response> => {
  const responseBody = buildCreateRoleUnavailableBody(input.actor.requestId);
  await completeCreateRoleIdempotency(deps, {
    actor: input.actor,
    idempotencyKey: input.idempotencyKey,
    status: 'FAILED',
    responseStatus: 503,
    responseBody,
  });
  return deps.jsonResponse(503, responseBody);
};

export const failCreatedRole = async <
  TPayload extends CreateRolePayloadShape,
  TAttributes,
  TIdentityProvider extends CreateRoleIdentityProvider<TAttributes>,
  TRole,
>(
  deps: CreateRoleHandlerDeps<TPayload, TAttributes, TIdentityProvider, TRole>,
  input: PreparedRoleCreate<TPayload>,
  error: unknown
): Promise<Response> => {
  recordCreateRoleOperationFailure(deps);
  const failureResponse = deps.buildRoleSyncFailure({
    error,
    requestId: input.actor.requestId,
    fallbackMessage: 'Rolle konnte nicht erstellt werden.',
  });
  await completeCreateRoleIdempotency(deps, {
    actor: input.actor,
    idempotencyKey: input.idempotencyKey,
    status: 'FAILED',
    responseStatus: failureResponse.status,
    responseBody: await failureResponse.clone().json(),
  });
  return failureResponse;
};

const failLocalRoleDatabaseWrite = async <
  TPayload extends CreateRolePayloadShape,
  TAttributes,
  TIdentityProvider extends CreateRoleIdentityProvider<TAttributes>,
  TRole,
>(
  deps: CreateRoleHandlerDeps<TPayload, TAttributes, TIdentityProvider, TRole>,
  input: PreparedRoleCreate<TPayload>
): Promise<Response> => {
  const responseBody = buildCreateRoleDbWriteFailureBody(input.actor.requestId);
  await completeCreateRoleIdempotency(deps, {
    actor: input.actor,
    idempotencyKey: input.idempotencyKey,
    status: 'FAILED',
    responseStatus: 409,
    responseBody,
  });
  return deps.jsonResponse(409, responseBody);
};

export const failLocalRoleCreateDatabaseWrite = async <
  TPayload extends CreateRolePayloadShape,
  TAttributes,
  TIdentityProvider extends CreateRoleIdentityProvider<TAttributes>,
  TRole,
>(
  deps: CreateRoleHandlerDeps<TPayload, TAttributes, TIdentityProvider, TRole>,
  input: PreparedRoleCreate<TPayload>,
  error: unknown
): Promise<Response> => {
  recordCreateRoleOperationFailure(deps);
  logCreateRoleDatabaseWriteFailure(deps, input, error, 'Role create database write failed');
  return failLocalRoleDatabaseWrite(deps, input);
};

export const failCreateCompensation = async <
  TPayload extends CreateRolePayloadShape,
  TAttributes,
  TIdentityProvider extends CreateRoleIdentityProvider<TAttributes>,
  TRole,
>(
  deps: CreateRoleHandlerDeps<TPayload, TAttributes, TIdentityProvider, TRole>,
  input: PreparedRoleCreate<TPayload>,
  compensationError: unknown
): Promise<Response> => {
  deps.iamRoleSyncCounter.add(1, {
    operation: 'create',
    result: 'failure',
    error_code: 'COMPENSATION_FAILED',
  });
  deps.logger.error('Role create compensation failed', {
    operation: 'create_role_compensation',
    instance_id: input.actor.instanceId,
    request_id: input.actor.requestId,
    trace_id: input.actor.traceId,
    role_key: input.roleKey,
    external_role_name: input.externalRoleName,
    error_code: 'COMPENSATION_FAILED',
    error: deps.sanitizeRoleErrorMessage(compensationError),
  });
  const responseBody = deps.createApiError(
    500,
    'internal_error',
    'Rolle konnte nicht konsistent erstellt werden.',
    input.actor.requestId,
    {
      syncState: 'failed',
      syncError: { code: 'COMPENSATION_FAILED' },
    }
  );
  await completeCreateRoleIdempotency(deps, {
    actor: input.actor,
    idempotencyKey: input.idempotencyKey,
    status: 'FAILED',
    responseStatus: 500,
    responseBody: await responseBody.clone().json(),
  });
  return responseBody;
};

export const failTechnicalRoleDatabaseWrite = async <
  TPayload extends CreateRolePayloadShape,
  TAttributes,
  TIdentityProvider extends CreateRoleIdentityProvider<TAttributes>,
  TRole,
>(
  deps: CreateRoleHandlerDeps<TPayload, TAttributes, TIdentityProvider, TRole>,
  input: PreparedRoleCreate<TPayload>,
  error: unknown
): Promise<Response> => {
  deps.iamRoleSyncCounter.add(1, {
    operation: 'create',
    result: 'failure',
    error_code: 'DB_WRITE_FAILED',
  });
  logCreateRoleDatabaseWriteFailure(
    deps,
    input,
    error,
    'Role create database write failed after successful Keycloak create'
  );
  return failLocalRoleDatabaseWrite(deps, input);
};
