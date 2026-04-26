import { getRoleDisplayName, getRoleExternalName } from './role-audit.js';

export type UpdateRoleAuthenticatedRequestContext = {
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly instanceId?: string;
    readonly roles: string[];
  };
};

export type UpdateRoleActor = {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

export type MutableRoleShape = {
  readonly role_key: string;
  readonly display_name?: string | null;
  readonly external_role_name?: string | null;
  readonly role_name: string;
  readonly description: string | null;
  readonly is_system_role: boolean;
  readonly managed_by: string;
  readonly role_level: number;
};

export type UpdateRolePayloadShape = {
  readonly displayName?: string;
  readonly description?: string | null;
  readonly roleLevel?: number;
  readonly permissionIds?: readonly string[];
  readonly retrySync?: boolean;
};

export type UpdateRoleIdentityProvider<TAttributes = unknown> = {
  readonly provider: {
    readonly updateRole: (
      externalName: string,
      input: {
        readonly description?: string;
        readonly attributes: TAttributes;
      }
    ) => Promise<unknown>;
  };
};

export type ParsedUpdateRoleBody<TPayload extends UpdateRolePayloadShape> =
  | { readonly ok: true; readonly data: TPayload; readonly rawBody: string }
  | { readonly ok: false };

export type UpdateRoleHandlerDeps<
  TPayload extends UpdateRolePayloadShape = UpdateRolePayloadShape,
  TAttributes = unknown,
  TIdentityProvider extends UpdateRoleIdentityProvider<TAttributes> = UpdateRoleIdentityProvider<TAttributes>,
  TRole extends MutableRoleShape = MutableRoleShape,
  TRoleItem = unknown,
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
    readonly roleId?: string;
  }) => Response;
  readonly createApiError: (
    status: number,
    code: 'conflict' | 'internal_error' | 'invalid_request' | 'not_found',
    message: string,
    requestId?: string,
    details?: Readonly<Record<string, unknown>>
  ) => Response;
  readonly iamRoleSyncCounter: {
    readonly add: (value: number, attributes: Readonly<Record<string, string>>) => void;
  };
  readonly jsonResponse: (status: number, payload: unknown) => Response;
  readonly logger: {
    readonly error: (message: string, meta: Readonly<Record<string, unknown>>) => void;
  };
  readonly mapRoleSyncErrorCode: (error: unknown) => string;
  readonly markRoleSyncState: (input: {
    readonly actor: UpdateRoleActor;
    readonly roleId: string;
    readonly operation: 'update' | 'retry';
    readonly result: 'success' | 'failure';
    readonly roleKey: string;
    readonly externalRoleName: string;
    readonly errorCode?: string;
    readonly syncState: 'pending' | 'failed' | 'synced';
    readonly syncedAt?: boolean;
  }) => Promise<void>;
  readonly parseUpdateRoleBody: (request: Request) => Promise<ParsedUpdateRoleBody<TPayload>>;
  readonly persistUpdatedRole: (input: {
    readonly actor: UpdateRoleActor;
    readonly roleId: string;
    readonly existing: TRole;
    readonly displayName: string;
    readonly description?: string;
    readonly roleLevel: number;
    readonly externalRoleName: string;
    readonly permissionIds?: readonly string[];
    readonly operation: 'update' | 'retry';
  }) => Promise<TRoleItem>;
  readonly requireRoleId: (request: Request, requestId?: string) => string | Response;
  readonly requireRoleIdentityProvider: (
    instanceId: string,
    requestId?: string
  ) => Promise<TIdentityProvider | Response>;
  readonly resolveMutableRole: (actor: UpdateRoleActor, roleId: string) => Promise<TRole | Response>;
  readonly resolveRoleMutationActor: (
    request: Request,
    ctx: UpdateRoleAuthenticatedRequestContext
  ) => Promise<{ readonly actor: UpdateRoleActor } | { readonly response: Response }>;
  readonly sanitizeRoleErrorMessage: (error: unknown) => string;
  readonly trackKeycloakCall: <T>(
    operation: 'update_role' | 'update_role_compensation',
    work: () => Promise<T>
  ) => Promise<T>;
};

export const createUpdateRoleHandlerInternal =
  <
    TPayload extends UpdateRolePayloadShape,
    TAttributes,
    TIdentityProvider extends UpdateRoleIdentityProvider<TAttributes>,
    TRole extends MutableRoleShape,
    TRoleItem,
  >(
    deps: UpdateRoleHandlerDeps<TPayload, TAttributes, TIdentityProvider, TRole, TRoleItem>
  ) =>
  async (request: Request, ctx: UpdateRoleAuthenticatedRequestContext): Promise<Response> => {
    const resolvedActor = await deps.resolveRoleMutationActor(request, ctx);
    if ('response' in resolvedActor) {
      return resolvedActor.response;
    }

    const { actor } = resolvedActor;
    const roleId = deps.requireRoleId(request, actor.requestId);
    if (roleId instanceof Response) {
      return roleId;
    }

    const parsed = await deps.parseUpdateRoleBody(request);
    if (!parsed.ok) {
      return deps.createApiError(400, 'invalid_request', 'Ungültiger Payload.', actor.requestId);
    }

    const identityProvider = await deps.requireRoleIdentityProvider(actor.instanceId, actor.requestId);
    if (identityProvider instanceof Response) {
      return identityProvider;
    }

    try {
      const existing = await deps.resolveMutableRole(actor, roleId);
      if (existing instanceof Response) {
        return existing;
      }

      const operation = parsed.data.retrySync ? 'retry' : 'update';
      const nextDisplayName = parsed.data.displayName?.trim() || getRoleDisplayName(existing);
      const nextDescription = parsed.data.description ?? existing.description ?? undefined;
      const nextRoleLevel = parsed.data.roleLevel ?? existing.role_level;
      const externalRoleName = getRoleExternalName(existing);

      await deps.markRoleSyncState({
        actor,
        roleId,
        operation,
        result: 'success',
        roleKey: existing.role_key,
        externalRoleName,
        syncState: 'pending',
      });

      try {
        await deps.trackKeycloakCall('update_role', () =>
          identityProvider.provider.updateRole(externalRoleName, {
            description: nextDescription,
            attributes: deps.buildRoleAttributes({
              instanceId: actor.instanceId,
              roleKey: existing.role_key,
              displayName: nextDisplayName,
            }),
          })
        );
      } catch (error) {
        const errorCode = deps.mapRoleSyncErrorCode(error);
        deps.iamRoleSyncCounter.add(1, { operation, result: 'failure', error_code: errorCode });
        await deps.markRoleSyncState({
          actor,
          roleId,
          operation,
          result: 'failure',
          roleKey: existing.role_key,
          externalRoleName,
          errorCode,
          syncState: 'failed',
        });
        return deps.buildRoleSyncFailure({
          error,
          requestId: actor.requestId,
          fallbackMessage: 'Rolle konnte nicht mit Keycloak synchronisiert werden.',
          roleId,
        });
      }

      try {
        const roleItem = await deps.persistUpdatedRole({
          actor,
          roleId,
          existing,
          displayName: nextDisplayName,
          description: nextDescription,
          roleLevel: nextRoleLevel,
          externalRoleName,
          permissionIds: parsed.data.permissionIds,
          operation,
        });
        deps.iamRoleSyncCounter.add(1, { operation, result: 'success', error_code: 'none' });
        return deps.jsonResponse(200, deps.asApiItem(roleItem, actor.requestId));
      } catch (error) {
        try {
          await deps.trackKeycloakCall('update_role_compensation', () =>
            identityProvider.provider.updateRole(externalRoleName, {
              description: existing.description ?? undefined,
              attributes: deps.buildRoleAttributes({
                instanceId: actor.instanceId,
                roleKey: existing.role_key,
                displayName: getRoleDisplayName(existing),
              }),
            })
          );
        } catch {
          await deps.markRoleSyncState({
            actor,
            roleId,
            operation: 'update',
            result: 'failure',
            roleKey: existing.role_key,
            externalRoleName,
            errorCode: 'COMPENSATION_FAILED',
            syncState: 'failed',
          });
          deps.iamRoleSyncCounter.add(1, {
            operation: 'update',
            result: 'failure',
            error_code: 'COMPENSATION_FAILED',
          });
          return deps.createApiError(
            500,
            'internal_error',
            'Rolle konnte nicht konsistent aktualisiert werden.',
            actor.requestId,
            {
              syncState: 'failed',
              syncError: { code: 'COMPENSATION_FAILED' },
            }
          );
        }

        await deps.markRoleSyncState({
          actor,
          roleId,
          operation: 'update',
          result: 'failure',
          roleKey: existing.role_key,
          externalRoleName,
          errorCode: 'DB_WRITE_FAILED',
          syncState: 'failed',
        });
        deps.iamRoleSyncCounter.add(1, {
          operation: 'update',
          result: 'failure',
          error_code: 'DB_WRITE_FAILED',
        });
        deps.logger.error('Role update database write failed after successful Keycloak update', {
          operation: 'update_role',
          instance_id: actor.instanceId,
          request_id: actor.requestId,
          trace_id: actor.traceId,
          role_id: roleId,
          role_key: existing.role_key,
          error: deps.sanitizeRoleErrorMessage(error),
        });
        return deps.createApiError(500, 'internal_error', 'Rolle konnte nicht aktualisiert werden.', actor.requestId, {
          syncState: 'failed',
          syncError: { code: 'DB_WRITE_FAILED' },
        });
      }
    } catch {
      return deps.createApiError(500, 'internal_error', 'Rolle konnte nicht aktualisiert werden.', actor.requestId);
    }
  };
