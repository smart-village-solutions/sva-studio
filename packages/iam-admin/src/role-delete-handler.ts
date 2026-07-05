import { createMutationWorkflow } from '@sva/server-runtime';
import { getRoleDisplayName, getRoleExternalName } from './role-audit.js';
import { buildDeletedRolePayloadFromRole, failLocalRoleDeleteDatabaseWrite } from './role-delete-support.js';
import { isTenantTechnicalKeycloakRole } from './role-governance.js';
import type { MutableRoleShape, UpdateRoleActor, UpdateRoleAuthenticatedRequestContext } from './role-update-handler.js';

export type DeleteRoleAuthenticatedRequestContext = UpdateRoleAuthenticatedRequestContext;

export type DeleteRoleActor = UpdateRoleActor;

export type DeleteRoleIdentityProvider<TAttributes = unknown> = {
  readonly provider: {
    readonly assignRealmRoles?: (externalId: string, roles: readonly string[]) => Promise<void>;
    readonly createRole: (input: {
      readonly externalName: string;
      readonly description?: string;
      readonly attributes: TAttributes;
    }) => Promise<unknown>;
    readonly deleteRole: (externalName: string) => Promise<void>;
  };
};

export type DeleteRoleHandlerDeps<
  TAttributes = unknown,
  TIdentityProvider extends DeleteRoleIdentityProvider<TAttributes> = DeleteRoleIdentityProvider<TAttributes>,
  TRole extends MutableRoleShape = MutableRoleShape,
> = {
  readonly asApiItem: (data: unknown, requestId?: string) => unknown;
  readonly buildRoleAttributes: (input: {
    readonly instanceId: string;
    readonly roleKey: string;
    readonly displayName: string;
  }) => TAttributes;
  readonly createApiError: (
    status: number,
    code: 'internal_error' | 'keycloak_unavailable',
    message: string,
    requestId?: string,
    details?: Readonly<Record<string, unknown>>
  ) => Response;
  readonly deleteRoleFromDatabase: (input: {
    readonly actor: DeleteRoleActor;
    readonly roleId: string;
    readonly roleKey: string;
    readonly externalRoleName: string;
  }) => Promise<void>;
  readonly iamRoleSyncCounter: {
    readonly add: (value: number, attributes: Readonly<Record<string, string>>) => void;
  };
  readonly isIdentityRoleNotFoundError: (error: unknown) => boolean;
  readonly jsonResponse: (status: number, payload: unknown) => Response;
  readonly listDirectRoleAssignmentSubjects: (input: {
    readonly instanceId: string;
    readonly roleId: string;
  }) => Promise<readonly string[]>;
  readonly logger: {
    readonly error: (message: string, meta: Readonly<Record<string, unknown>>) => void;
  };
  readonly mapRoleSyncErrorCode: (error: unknown) => string;
  readonly markDeleteRoleSyncState: (input: {
    readonly actor: DeleteRoleActor;
    readonly roleId: string;
    readonly roleKey: string;
    readonly externalRoleName: string;
    readonly result: 'success' | 'failure';
    readonly eventType: 'role.sync_started' | 'role.sync_failed' | 'role.sync_succeeded';
    readonly errorCode?: string;
    readonly syncState?: 'pending' | 'failed';
  }) => Promise<void>;
  readonly requireRoleId: (request: Request, requestId?: string) => string | Response;
  readonly requireRoleIdentityProvider: (
    instanceId: string,
    requestId?: string
  ) => Promise<TIdentityProvider | Response>;
  readonly resolveDeletableRole: (actor: DeleteRoleActor, roleId: string) => Promise<TRole | Response>;
  readonly resolveRoleMutationActor: (
    request: Request,
    ctx: DeleteRoleAuthenticatedRequestContext
  ) => Promise<{ readonly actor: DeleteRoleActor } | { readonly response: Response }>;
  readonly sanitizeRoleErrorMessage: (error: unknown) => string;
  readonly trackKeycloakCall: <T>(
    operation: 'delete_role' | 'create_role_compensation',
    work: () => Promise<T>
  ) => Promise<T>;
};

const resolveDeleteRoleRequest = async <
  TAttributes,
  TIdentityProvider extends DeleteRoleIdentityProvider<TAttributes>,
  TRole extends MutableRoleShape,
>(
  deps: DeleteRoleHandlerDeps<TAttributes, TIdentityProvider, TRole>,
  request: Request,
  ctx: DeleteRoleAuthenticatedRequestContext
): Promise<{ readonly actor: DeleteRoleActor; readonly roleId: string } | Response> => {
  const resolvedActor = await deps.resolveRoleMutationActor(request, ctx);
  if ('response' in resolvedActor) {
    return resolvedActor.response;
  }

  const roleId = deps.requireRoleId(request, resolvedActor.actor.requestId);
  return roleId instanceof Response ? roleId : { actor: resolvedActor.actor, roleId };
};

const getKeycloakRoleNameForDelete = (role: MutableRoleShape): string =>
  isTenantTechnicalKeycloakRole(role) ? role.role_key : getRoleExternalName(role);

export const createDeleteRoleHandlerInternal =
  <
    TAttributes,
    TIdentityProvider extends DeleteRoleIdentityProvider<TAttributes>,
    TRole extends MutableRoleShape,
  >(
    deps: DeleteRoleHandlerDeps<TAttributes, TIdentityProvider, TRole>
  ) =>
  createMutationWorkflow<
    DeleteRoleAuthenticatedRequestContext,
    {
      readonly actor: DeleteRoleActor;
      readonly roleId: string;
    },
    Record<never, never>,
    Record<never, never>,
    undefined,
    Response
  >({
    prepare: async ({ request, context }) => {
      const resolvedRequest = await resolveDeleteRoleRequest(deps, request, context);
      return resolvedRequest instanceof Response ? resolvedRequest : resolvedRequest;
    },
    authorize: async () => ({}),
    parse: async () => undefined,
    execute: async ({ actor, roleId }) => {
      const existing = await deps.resolveDeletableRole(actor, roleId);
      if (existing instanceof Response) {
        return existing;
      }

      const externalRoleName = getKeycloakRoleNameForDelete(existing);
      const shouldSyncIdentityRole = isTenantTechnicalKeycloakRole(existing);
      if (!shouldSyncIdentityRole) {
        try {
          await deps.deleteRoleFromDatabase({
            actor,
            roleId,
            roleKey: existing.role_key,
            externalRoleName,
          });
        } catch (error) {
          return failLocalRoleDeleteDatabaseWrite(deps, { actor, roleId, existing, externalRoleName, error });
        }
        return deps.jsonResponse(
          200,
          deps.asApiItem(buildDeletedRolePayloadFromRole(roleId, existing, externalRoleName), actor.requestId)
        );
      }

      const identityProvider = await deps.requireRoleIdentityProvider(actor.instanceId, actor.requestId);
      if (identityProvider instanceof Response) {
        return identityProvider;
      }

      const directAssignmentSubjects = await deps.listDirectRoleAssignmentSubjects({
        instanceId: actor.instanceId,
        roleId,
      });
      await deps.markDeleteRoleSyncState({
        actor,
        roleId,
        roleKey: existing.role_key,
        externalRoleName,
        result: 'success',
        eventType: 'role.sync_started',
        syncState: 'pending',
      });

      try {
        await deps.trackKeycloakCall('delete_role', () => identityProvider.provider.deleteRole(externalRoleName));
      } catch (error) {
        if (!deps.isIdentityRoleNotFoundError(error)) {
          const errorCode = deps.mapRoleSyncErrorCode(error);
          await deps.markDeleteRoleSyncState({
            actor,
            roleId,
            roleKey: existing.role_key,
            externalRoleName,
            result: 'failure',
            eventType: 'role.sync_failed',
            errorCode,
            syncState: 'failed',
          });
          deps.iamRoleSyncCounter.add(1, { operation: 'delete', result: 'failure', error_code: errorCode });
          return deps.createApiError(503, 'keycloak_unavailable', 'Rolle konnte nicht gelöscht werden.', actor.requestId, {
            syncState: 'failed',
            syncError: { code: errorCode },
          });
        }
      }

      try {
        await deps.deleteRoleFromDatabase({
          actor,
          roleId,
          roleKey: existing.role_key,
          externalRoleName,
        });
      } catch {
        try {
          await deps.trackKeycloakCall('create_role_compensation', () =>
            identityProvider.provider.createRole({
              externalName: externalRoleName,
              description: existing.description ?? undefined,
              attributes: deps.buildRoleAttributes({
                instanceId: actor.instanceId,
                roleKey: existing.role_key,
                displayName: getRoleDisplayName(existing),
              }),
            })
          );
          if (directAssignmentSubjects.length > 0) {
            const assignRealmRoles = identityProvider.provider.assignRealmRoles;
            if (!assignRealmRoles) {
              throw new Error('assignRealmRoles provider capability unavailable');
            }
            await Promise.all(
              directAssignmentSubjects.map((subject) => assignRealmRoles(subject, [externalRoleName]))
            );
          }
        } catch (compensationError) {
          deps.iamRoleSyncCounter.add(1, {
            operation: 'delete',
            result: 'failure',
            error_code: 'COMPENSATION_FAILED',
          });
          deps.logger.error('Role delete compensation failed', {
            operation: 'delete_role_compensation',
            instance_id: actor.instanceId,
            request_id: actor.requestId,
            trace_id: actor.traceId,
            role_id: roleId,
            role_key: existing.role_key,
            error: deps.sanitizeRoleErrorMessage(compensationError),
          });
          return deps.createApiError(
            500,
            'internal_error',
            'Rolle konnte nicht konsistent gelöscht werden.',
            actor.requestId,
            {
              syncState: 'failed',
              syncError: { code: 'COMPENSATION_FAILED' },
            }
          );
        }

        await deps.markDeleteRoleSyncState({
          actor,
          roleId,
          roleKey: existing.role_key,
          externalRoleName,
          result: 'failure',
          eventType: 'role.sync_failed',
          errorCode: 'DB_WRITE_FAILED',
          syncState: 'failed',
        });
        deps.iamRoleSyncCounter.add(1, { operation: 'delete', result: 'failure', error_code: 'DB_WRITE_FAILED' });
        return deps.createApiError(500, 'internal_error', 'Rolle konnte nicht gelöscht werden.', actor.requestId, {
          syncState: 'failed',
          syncError: { code: 'DB_WRITE_FAILED' },
        });
      }

      deps.iamRoleSyncCounter.add(1, { operation: 'delete', result: 'success', error_code: 'none' });
      return deps.jsonResponse(
        200,
        deps.asApiItem(buildDeletedRolePayloadFromRole(roleId, existing, externalRoleName), actor.requestId)
      );
    },
    mapError: (_error, state) =>
      deps.createApiError(500, 'internal_error', 'Rolle konnte nicht gelöscht werden.', state.actor?.requestId),
    respond: (response) => response,
  });
