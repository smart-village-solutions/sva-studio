import type { ApiErrorResponse } from '@sva/core';

import type {
  CreateRoleActor,
  CreateRoleHandlerDeps,
  CreateRoleIdentityProvider,
  CreateRolePayloadShape,
} from './role-create-handler.js';

export type PreparedRoleCreate<TPayload extends CreateRolePayloadShape> = {
  readonly actor: CreateRoleActor;
  readonly data: TPayload;
  readonly displayName: string;
  readonly externalRoleName: string;
  readonly idempotencyKey: string;
  readonly roleKey: string;
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

const persistPreparedRole = async <
  TPayload extends CreateRolePayloadShape,
  TAttributes,
  TIdentityProvider extends CreateRoleIdentityProvider<TAttributes>,
  TRole,
>(
  deps: CreateRoleHandlerDeps<TPayload, TAttributes, TIdentityProvider, TRole>,
  input: PreparedRoleCreate<TPayload>
): Promise<TRole> =>
  deps.persistCreatedRole({
    actor: input.actor,
    roleKey: input.roleKey,
    displayName: input.displayName,
    externalRoleName: input.externalRoleName,
    description: input.data.description ?? undefined,
    roleLevel: input.data.roleLevel,
    permissionIds: input.data.permissionIds,
    permissionAssignments: input.data.permissionAssignments,
  });

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

const finishCreatedRole = async <
  TPayload extends CreateRolePayloadShape,
  TAttributes,
  TIdentityProvider extends CreateRoleIdentityProvider<TAttributes>,
  TRole,
>(
  deps: CreateRoleHandlerDeps<TPayload, TAttributes, TIdentityProvider, TRole>,
  input: PreparedRoleCreate<TPayload>,
  role: TRole
): Promise<Response> => {
  deps.iamUserOperationsCounter.add(1, { action: 'create_role', result: 'success' });
  const responseBody = deps.asApiItem(role, input.actor.requestId);
  await completeCreateRoleIdempotency(deps, {
    actor: input.actor,
    idempotencyKey: input.idempotencyKey,
    status: 'COMPLETED',
    responseStatus: 201,
    responseBody,
  });
  return deps.jsonResponse(201, responseBody);
};

const failCreatedRole = async <
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

const failLocalRoleCreateDatabaseWrite = async <
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

const failCreateCompensation = async <
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

const failTechnicalRoleDatabaseWrite = async <
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

export const reserveCreateRoleIdempotency = async <
  TPayload extends CreateRolePayloadShape,
  TAttributes,
  TIdentityProvider extends CreateRoleIdentityProvider<TAttributes>,
  TRole,
>(
  deps: CreateRoleHandlerDeps<TPayload, TAttributes, TIdentityProvider, TRole>,
  input: {
    readonly actor: CreateRoleActor;
    readonly idempotencyKey: string;
    readonly rawBody: string;
  }
): Promise<Response | null> => {
  const { actor } = input;
  const idempotencyReservation = await deps.reserveIdempotency(
    {
      actorAccountId: actor.actorAccountId,
      endpoint: CREATE_ROLE_ENDPOINT,
      idempotencyKey: input.idempotencyKey,
      instanceId: actor.instanceId,
      payloadHash: deps.toPayloadHash(input.rawBody),
    }
  );

  switch (idempotencyReservation.status) {
    case 'conflict':
      return deps.createApiError(409, 'idempotency_key_reuse', idempotencyReservation.message, actor.requestId);
    case 'replay':
      return deps.jsonResponse(idempotencyReservation.responseStatus, idempotencyReservation.responseBody);
    case 'reserved':
      return null;
  }
};

export const persistLocalRoleCreate = async <
  TPayload extends CreateRolePayloadShape,
  TAttributes,
  TIdentityProvider extends CreateRoleIdentityProvider<TAttributes>,
  TRole,
>(
  deps: CreateRoleHandlerDeps<TPayload, TAttributes, TIdentityProvider, TRole>,
  input: PreparedRoleCreate<TPayload>
): Promise<Response> => {
  try {
    return await finishCreatedRole(deps, input, await persistPreparedRole(deps, input));
  } catch (error) {
    return failLocalRoleCreateDatabaseWrite(deps, input, error);
  }
};

export const syncTechnicalRoleCreate = async <
  TPayload extends CreateRolePayloadShape,
  TAttributes,
  TIdentityProvider extends CreateRoleIdentityProvider<TAttributes>,
  TRole,
>(
  deps: CreateRoleHandlerDeps<TPayload, TAttributes, TIdentityProvider, TRole>,
  input: PreparedRoleCreate<TPayload>
): Promise<Response> => {
  const identityProvider = await deps.requireRoleIdentityProvider(input.actor.instanceId, input.actor.requestId);
  if (identityProvider instanceof Response) {
    const responseBody = buildCreateRoleUnavailableBody(input.actor.requestId);
    await completeCreateRoleIdempotency(deps, {
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      status: 'FAILED',
      responseStatus: 503,
      responseBody,
    });
    return deps.jsonResponse(503, responseBody);
  }

  try {
    await deps.trackKeycloakCall('create_role', () =>
      identityProvider.provider.createRole({
        externalName: input.externalRoleName,
        description: input.data.description ?? undefined,
        attributes: deps.buildRoleAttributes({
          instanceId: input.actor.instanceId,
          roleKey: input.roleKey,
          displayName: input.displayName,
        }),
      })
    );
  } catch (error) {
    deps.iamRoleSyncCounter.add(1, {
      operation: 'create',
      result: 'failure',
      error_code: deps.mapRoleSyncErrorCode(error),
    });
    return failCreatedRole(deps, input, error);
  }

  try {
    const response = await finishCreatedRole(deps, input, await persistPreparedRole(deps, input));
    deps.iamRoleSyncCounter.add(1, { operation: 'create', result: 'success', error_code: 'none' });
    return response;
  } catch (error) {
    try {
      await deps.trackKeycloakCall('delete_role_compensation', () =>
        identityProvider.provider.deleteRole(input.externalRoleName)
      );
    } catch (compensationError) {
      return failCreateCompensation(deps, input, compensationError);
    }
    return failTechnicalRoleDatabaseWrite(deps, input, error);
  }
};
