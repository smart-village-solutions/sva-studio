import type { IamUserDetail, IamUserRoleAssignment } from '@sva/core';

import type { QueryClient } from './query-client.js';

export type DeactivateAuthenticatedRequestContext = {
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly instanceId?: string;
    readonly roles: string[];
  };
};

export type DeactivateActor = {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

type MainserverCredentialState = {
  readonly mainserverUserApplicationId?: string;
  readonly mainserverUserApplicationSecretSet: boolean;
};

export type DeactivateRequestContext =
  | Response
  | {
      readonly actor: DeactivateActor;
      readonly identityProvider: {
        readonly provider: {
          readonly deactivateUser: (keycloakSubject: string) => Promise<void>;
        };
      };
      readonly userId: string;
    };

export type DeactivateUserHandlerDeps = {
  readonly asApiItem: (data: unknown, requestId?: string) => unknown;
  readonly createUnexpectedMutationErrorResponse: (input: {
    readonly requestId?: string;
    readonly message: string;
  }) => Response;
  readonly createUserMutationErrorResponse: (input: {
    readonly error: unknown;
    readonly requestId?: string;
    readonly forbiddenFallbackMessage: string;
  }) => Response | null;
  readonly emitActivityLog: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly accountId?: string;
      readonly subjectId: string;
      readonly eventType: 'user.deactivated';
      readonly result: 'success';
      readonly requestId?: string;
      readonly traceId?: string;
    }
  ) => Promise<void>;
  readonly ensureActorCanManageTarget: (input: {
    readonly actorMaxRoleLevel: number;
    readonly actorRoles: readonly string[];
    readonly targetRoles: readonly IamUserRoleAssignment[];
  }) => { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string };
  readonly iamUserOperationsCounter: {
    readonly add: (value: number, attributes: Readonly<Record<string, string>>) => void;
  };
  readonly isRecoverableUserProjectionError: (error: unknown) => boolean;
  readonly isSystemAdminAccount: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly accountId: string }
  ) => Promise<boolean>;
  readonly jsonResponse: (status: number, payload: unknown) => Response;
  readonly logger: {
    readonly error: (message: string, meta: Readonly<Record<string, unknown>>) => void;
    readonly warn: (message: string, meta: Readonly<Record<string, unknown>>) => void;
  };
  readonly mergeMainserverCredentialState: (
    user: IamUserDetail,
    state: MainserverCredentialState
  ) => IamUserDetail;
  readonly notifyPermissionInvalidation: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly keycloakSubject: string;
      readonly trigger: 'user_deactivated';
    }
  ) => Promise<void>;
  readonly notFoundResponse: (requestId?: string) => Response;
  readonly resolveActorMaxRoleLevel: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly keycloakSubject: string;
      readonly sessionRoleNames: readonly string[];
    }
  ) => Promise<number>;
  readonly resolveDeactivateRequestContext: (
    request: Request,
    ctx: DeactivateAuthenticatedRequestContext
  ) => Promise<DeactivateRequestContext>;
  readonly resolveProjectedMainserverCredentialState: (
    keycloakSubject: string,
    instanceId: string
  ) => Promise<MainserverCredentialState>;
  readonly resolveSystemAdminCount: (client: QueryClient, instanceId: string) => Promise<number>;
  readonly resolveUserDetail: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly userId: string }
  ) => Promise<IamUserDetail | undefined>;
  readonly trackKeycloakCall: <T>(operation: 'deactivate_user', work: () => Promise<T>) => Promise<T>;
  readonly withInstanceScopedDb: <T>(
    instanceId: string,
    work: (client: QueryClient) => Promise<T>
  ) => Promise<T>;
};

const deactivateUserRecord = async (
  deps: DeactivateUserHandlerDeps,
  input: {
    actor: DeactivateActor;
    ctx: DeactivateAuthenticatedRequestContext;
    userId: string;
  }
) =>
  deps.withInstanceScopedDb(input.actor.instanceId, async (client) => {
    const actorMaxRoleLevel = await deps.resolveActorMaxRoleLevel(client, {
      instanceId: input.actor.instanceId,
      keycloakSubject: input.ctx.user.id,
      sessionRoleNames: input.ctx.user.roles,
    });
    const existing = await deps.resolveUserDetail(client, {
      instanceId: input.actor.instanceId,
      userId: input.userId,
    });
    if (!existing) {
      return undefined;
    }

    const targetAccessCheck = deps.ensureActorCanManageTarget({
      actorMaxRoleLevel,
      actorRoles: input.ctx.user.roles,
      targetRoles: existing.roles,
    });
    if (!targetAccessCheck.ok) {
      throw new Error(`${targetAccessCheck.code}:${targetAccessCheck.message}`);
    }

    if (existing.keycloakSubject === input.ctx.user.id) {
      throw new Error('self_protection:Eigener Nutzer kann nicht deaktiviert werden.');
    }

    const isAdmin = await deps.isSystemAdminAccount(client, {
      instanceId: input.actor.instanceId,
      accountId: input.userId,
    });
    if (isAdmin) {
      const adminCount = await deps.resolveSystemAdminCount(client, input.actor.instanceId);
      if (adminCount <= 1) {
        throw new Error('last_admin_protection:Letzter aktiver system_admin kann nicht deaktiviert werden.');
      }
    }

    await client.query(
      `
UPDATE iam.accounts
SET
  status = 'inactive',
  updated_at = NOW()
WHERE id = $1::uuid
  AND instance_id = $2;
`,
      [input.userId, input.actor.instanceId]
    );

    await deps.emitActivityLog(client, {
      instanceId: input.actor.instanceId,
      accountId: input.actor.actorAccountId,
      subjectId: input.userId,
      eventType: 'user.deactivated',
      result: 'success',
      requestId: input.actor.requestId,
      traceId: input.actor.traceId,
    });

    await deps.notifyPermissionInvalidation(client, {
      instanceId: input.actor.instanceId,
      keycloakSubject: existing.keycloakSubject,
      trigger: 'user_deactivated',
    });

    return deps.resolveUserDetail(client, {
      instanceId: input.actor.instanceId,
      userId: input.userId,
    });
  });

export const createDeactivateUserHandlerInternal =
  (deps: DeactivateUserHandlerDeps) =>
  async (request: Request, ctx: DeactivateAuthenticatedRequestContext): Promise<Response> => {
    const resolved = await deps.resolveDeactivateRequestContext(request, ctx);
    if (resolved instanceof Response) {
      return resolved;
    }

    try {
      const detail = await deactivateUserRecord(deps, { actor: resolved.actor, ctx, userId: resolved.userId });

      if (!detail) {
        return deps.notFoundResponse(resolved.actor.requestId);
      }

      await deps.trackKeycloakCall('deactivate_user', () =>
        resolved.identityProvider.provider.deactivateUser(detail.keycloakSubject)
      );

      let projectedDetail = detail;
      try {
        const mainserverCredentialState = await deps.resolveProjectedMainserverCredentialState(
          detail.keycloakSubject,
          resolved.actor.instanceId
        );
        projectedDetail = deps.mergeMainserverCredentialState(detail, mainserverCredentialState);
      } catch (projectionError) {
        if (deps.isRecoverableUserProjectionError(projectionError)) {
          deps.logger.warn('IAM deactivate user credential projection degraded', {
            workspace_id: resolved.actor.instanceId,
            context: {
              operation: 'deactivate_user',
              instance_id: resolved.actor.instanceId,
              user_id: resolved.userId,
              request_id: resolved.actor.requestId,
              trace_id: resolved.actor.traceId,
              error: projectionError instanceof Error ? projectionError.message : String(projectionError),
            },
          });
        } else {
          throw projectionError;
        }
      }

      deps.iamUserOperationsCounter.add(1, { action: 'deactivate_user', result: 'success' });
      return deps.jsonResponse(200, deps.asApiItem(projectedDetail, resolved.actor.requestId));
    } catch (error) {
      const knownError = deps.createUserMutationErrorResponse({
        error,
        requestId: resolved.actor.requestId,
        forbiddenFallbackMessage: 'Deaktivierung dieses Nutzers ist nicht erlaubt.',
      });
      if (knownError) {
        return knownError;
      }

      deps.logger.error('IAM deactivate user failed', {
        workspace_id: resolved.actor.instanceId,
        context: {
          operation: 'deactivate_user',
          instance_id: resolved.actor.instanceId,
          user_id: resolved.userId,
          request_id: resolved.actor.requestId,
          trace_id: resolved.actor.traceId,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      deps.iamUserOperationsCounter.add(1, { action: 'deactivate_user', result: 'failure' });
      return deps.createUnexpectedMutationErrorResponse({
        requestId: resolved.actor.requestId,
        message: 'Nutzer konnte nicht deaktiviert werden.',
      });
    }
  };
