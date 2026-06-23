import { getRoleDisplayName } from './role-audit.js';
import type {
  MutableRoleShape,
  UpdateRoleHandlerDeps,
  UpdateRoleIdentityProvider,
  UpdateRolePayloadShape,
  UpdateRoleActor,
} from './role-update-handler.js';

export type PreparedRoleUpdate<TPayload extends UpdateRolePayloadShape, TRole extends MutableRoleShape> = {
  readonly actor: UpdateRoleActor;
  readonly roleId: string;
  readonly existing: TRole;
  readonly data: TPayload;
  readonly operation: 'update' | 'retry';
  readonly displayName: string;
  readonly description?: string;
  readonly roleLevel: number;
  readonly externalRoleName: string;
};

export const persistLocalRoleUpdate = async <
  TPayload extends UpdateRolePayloadShape,
  TAttributes,
  TIdentityProvider extends UpdateRoleIdentityProvider<TAttributes>,
  TRole extends MutableRoleShape,
  TRoleItem,
>(
  deps: UpdateRoleHandlerDeps<TPayload, TAttributes, TIdentityProvider, TRole, TRoleItem>,
  input: PreparedRoleUpdate<TPayload, TRole>
): Promise<Response> => {
  const roleItem = await deps.persistUpdatedRole({
    actor: input.actor,
    roleId: input.roleId,
    existing: input.existing,
    displayName: input.displayName,
    description: input.description,
    roleLevel: input.roleLevel,
    externalRoleName: input.externalRoleName,
    permissionIds: input.data.permissionIds,
    permissionAssignments: input.data.permissionAssignments,
    operation: input.operation,
  });
  return deps.jsonResponse(200, deps.asApiItem(roleItem, input.actor.requestId));
};

const failTechnicalRoleCompensation = async <
  TPayload extends UpdateRolePayloadShape,
  TAttributes,
  TIdentityProvider extends UpdateRoleIdentityProvider<TAttributes>,
  TRole extends MutableRoleShape,
  TRoleItem,
>(
  deps: UpdateRoleHandlerDeps<TPayload, TAttributes, TIdentityProvider, TRole, TRoleItem>,
  input: PreparedRoleUpdate<TPayload, TRole>
) => {
  await deps.markRoleSyncState({
    actor: input.actor,
    roleId: input.roleId,
    operation: 'update',
    result: 'failure',
    roleKey: input.existing.role_key,
    externalRoleName: input.externalRoleName,
    errorCode: 'COMPENSATION_FAILED',
    syncState: 'failed',
  });
  deps.iamRoleSyncCounter.add(1, { operation: 'update', result: 'failure', error_code: 'COMPENSATION_FAILED' });
  return deps.createApiError(500, 'internal_error', 'Rolle konnte nicht konsistent aktualisiert werden.', input.actor.requestId, {
    syncState: 'failed',
    syncError: { code: 'COMPENSATION_FAILED' },
  });
};

const persistTechnicalRoleUpdate = async <
  TPayload extends UpdateRolePayloadShape,
  TAttributes,
  TIdentityProvider extends UpdateRoleIdentityProvider<TAttributes>,
  TRole extends MutableRoleShape,
  TRoleItem,
>(
  deps: UpdateRoleHandlerDeps<TPayload, TAttributes, TIdentityProvider, TRole, TRoleItem>,
  input: PreparedRoleUpdate<TPayload, TRole>,
  identityProvider: TIdentityProvider
): Promise<Response> => {
  try {
    const response = await persistLocalRoleUpdate(deps, input);
    deps.iamRoleSyncCounter.add(1, { operation: input.operation, result: 'success', error_code: 'none' });
    return response;
  } catch (error) {
    try {
      await deps.trackKeycloakCall('update_role_compensation', () =>
        identityProvider.provider.updateRole(input.externalRoleName, {
          description: input.existing.description ?? undefined,
          attributes: deps.buildRoleAttributes({
            instanceId: input.actor.instanceId,
            roleKey: input.existing.role_key,
            displayName: getRoleDisplayName(input.existing),
          }),
        })
      );
    } catch {
      return failTechnicalRoleCompensation(deps, input);
    }

    await deps.markRoleSyncState({
      actor: input.actor,
      roleId: input.roleId,
      operation: 'update',
      result: 'failure',
      roleKey: input.existing.role_key,
      externalRoleName: input.externalRoleName,
      errorCode: 'DB_WRITE_FAILED',
      syncState: 'failed',
    });
    deps.iamRoleSyncCounter.add(1, { operation: 'update', result: 'failure', error_code: 'DB_WRITE_FAILED' });
    deps.logger.error('Role update database write failed after successful Keycloak update', {
      operation: 'update_role',
      instance_id: input.actor.instanceId,
      request_id: input.actor.requestId,
      trace_id: input.actor.traceId,
      role_id: input.roleId,
      role_key: input.existing.role_key,
      error: deps.sanitizeRoleErrorMessage(error),
    });
    return deps.createApiError(500, 'internal_error', 'Rolle konnte nicht aktualisiert werden.', input.actor.requestId, {
      syncState: 'failed',
      syncError: { code: 'DB_WRITE_FAILED' },
    });
  }
};

export const syncTechnicalRoleUpdate = async <
  TPayload extends UpdateRolePayloadShape,
  TAttributes,
  TIdentityProvider extends UpdateRoleIdentityProvider<TAttributes>,
  TRole extends MutableRoleShape,
  TRoleItem,
>(
  deps: UpdateRoleHandlerDeps<TPayload, TAttributes, TIdentityProvider, TRole, TRoleItem>,
  input: PreparedRoleUpdate<TPayload, TRole>
): Promise<Response> => {
  const identityProvider = await deps.requireRoleIdentityProvider(input.actor.instanceId, input.actor.requestId);
  if (identityProvider instanceof Response) {
    return identityProvider;
  }

  await deps.markRoleSyncState({
    actor: input.actor,
    roleId: input.roleId,
    operation: input.operation,
    result: 'success',
    roleKey: input.existing.role_key,
    externalRoleName: input.externalRoleName,
    syncState: 'pending',
  });

  try {
    await deps.trackKeycloakCall('update_role', () =>
      identityProvider.provider.updateRole(input.externalRoleName, {
        description: input.description,
        attributes: deps.buildRoleAttributes({
          instanceId: input.actor.instanceId,
          roleKey: input.existing.role_key,
          displayName: input.displayName,
        }),
      })
    );
  } catch (error) {
    const errorCode = deps.mapRoleSyncErrorCode(error);
    deps.iamRoleSyncCounter.add(1, { operation: input.operation, result: 'failure', error_code: errorCode });
    await deps.markRoleSyncState({
      actor: input.actor,
      roleId: input.roleId,
      operation: input.operation,
      result: 'failure',
      roleKey: input.existing.role_key,
      externalRoleName: input.externalRoleName,
      errorCode,
      syncState: 'failed',
    });
    return deps.buildRoleSyncFailure({
      error,
      requestId: input.actor.requestId,
      fallbackMessage: 'Rolle konnte nicht mit Keycloak synchronisiert werden.',
      roleId: input.roleId,
    });
  }

  return persistTechnicalRoleUpdate(deps, input, identityProvider);
};
