import { getRoleDisplayName, getRoleExternalName } from './role-audit.js';
import type { DeleteRoleActor, DeleteRoleHandlerDeps, DeleteRoleIdentityProvider } from './role-delete-handler.js';
import type { MutableRoleShape } from './role-update-handler.js';

const buildDeletedRolePayload = (input: {
  readonly roleId: string;
  readonly roleKey: string;
  readonly roleName: string;
  readonly externalRoleName: string;
}) => ({
  id: input.roleId,
  roleKey: input.roleKey,
  roleName: input.roleName,
  externalRoleName: input.externalRoleName,
  syncState: 'synced' as const,
});

export const buildDeletedRolePayloadFromRole = (roleId: string, existing: MutableRoleShape) =>
  buildDeletedRolePayload({
    roleId,
    roleKey: existing.role_key,
    roleName: getRoleDisplayName(existing),
    externalRoleName: getRoleExternalName(existing),
  });

export const failLocalRoleDeleteDatabaseWrite = <
  TAttributes,
  TIdentityProvider extends DeleteRoleIdentityProvider<TAttributes>,
  TRole extends MutableRoleShape,
>(
  deps: DeleteRoleHandlerDeps<TAttributes, TIdentityProvider, TRole>,
  input: {
    readonly actor: DeleteRoleActor;
    readonly roleId: string;
    readonly existing: TRole;
    readonly externalRoleName: string;
    readonly error: unknown;
  }
): Response => {
  deps.logger.error('Role delete database write failed', {
    operation: 'delete_role',
    instance_id: input.actor.instanceId,
    request_id: input.actor.requestId,
    trace_id: input.actor.traceId,
    role_id: input.roleId,
    role_key: input.existing.role_key,
    external_role_name: input.externalRoleName,
    error_code: 'DB_WRITE_FAILED',
    error: deps.sanitizeRoleErrorMessage(input.error),
  });
  return deps.createApiError(500, 'internal_error', 'Rolle konnte nicht gelöscht werden.', input.actor.requestId, {
    syncState: 'failed',
    syncError: { code: 'DB_WRITE_FAILED' },
  });
};
