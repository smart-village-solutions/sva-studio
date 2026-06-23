import type {
  CreateRoleActor,
  CreateRoleHandlerDeps,
  CreateRoleIdentityProvider,
  CreateRolePayloadShape,
} from './role-create-handler.js';
import {
  completeCreateRoleIdempotency,
  CREATE_ROLE_ENDPOINT,
  failCreatedRole,
  failCreateCompensation,
  failCreateRoleUnavailable,
  failLocalRoleCreateDatabaseWrite,
  failTechnicalRoleDatabaseWrite,
} from './role-create-sync-failures.js';

export type PreparedRoleCreate<TPayload extends CreateRolePayloadShape> = {
  readonly actor: CreateRoleActor;
  readonly data: TPayload;
  readonly displayName: string;
  readonly externalRoleName: string;
  readonly idempotencyKey: string;
  readonly roleKey: string;
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
    return failCreateRoleUnavailable(deps, input);
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
