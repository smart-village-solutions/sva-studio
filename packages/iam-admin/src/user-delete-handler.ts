import type { IamUserDetail, IamUserRoleAssignment } from '@sva/core';

import { ensureDeleteTargetIsAllowed } from './actor-authorization.js';
import type { QueryClient } from './query-client.js';

export type DeleteAuthenticatedRequestContext = {
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly instanceId?: string;
    readonly roles: string[];
  };
};

export type DeleteActor = {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

export type DeleteRequestContext =
  | Response
  | {
      readonly actor: DeleteActor;
      readonly userId: string;
    };

export type DeleteUserDeps = {
  readonly deleteIdentityUser: (keycloakSubject: string) => Promise<void>;
  readonly emitActivityLog: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly accountId?: string;
      readonly subjectId?: string;
      readonly eventType: 'user.deleted';
      readonly result: 'success';
      readonly payload?: Record<string, unknown>;
      readonly requestId?: string;
      readonly traceId?: string;
    }
  ) => Promise<void>;
  readonly ensureActorCanManageTarget: (input: {
    readonly actorMaxRoleLevel: number;
    readonly actorRoles: readonly string[];
    readonly targetRoles: readonly IamUserRoleAssignment[];
  }) => { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string };
  readonly hardDeleteUserRecord: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly accountId: string;
    }
  ) => Promise<void>;
  readonly iamUserOperationsCounter: {
    readonly add: (value: number, attributes: Readonly<Record<string, string>>) => void;
  };
  readonly isSystemAdminAccount: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly accountId: string }
  ) => Promise<boolean>;
  readonly purgeAccountHardDeleteBlockers: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly accountId: string;
    }
  ) => Promise<void>;
  readonly reconcileOwnedContentForAccountDelete: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly accountId: string;
    }
  ) => Promise<void>;
  readonly resolveActorMaxRoleLevel: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly keycloakSubject: string;
      readonly sessionRoleNames: readonly string[];
    }
  ) => Promise<number>;
  readonly resolveDeleteRequestContext: (
    request: Request,
    ctx: DeleteAuthenticatedRequestContext
  ) => Promise<DeleteRequestContext>;
  readonly resolveUserDetail: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly userId: string }
  ) => Promise<IamUserDetail | undefined>;
  readonly revokeUserSessions: (input: {
    readonly keycloakSubject: string;
    readonly reason: 'user_deleted';
  }) => Promise<void>;
  readonly trackKeycloakCall: <T>(operation: 'delete_user', work: () => Promise<T>) => Promise<T>;
  readonly withInstanceScopedDb: <T>(
    instanceId: string,
    work: (client: QueryClient) => Promise<T>
  ) => Promise<T>;
};

export type DeleteUserInput = {
  readonly actor: DeleteActor;
  readonly actorKeycloakSubject: string;
  readonly actorRoles: readonly string[];
  readonly userId: string;
};

export type DeleteUserResult = { readonly status: 'deleted' } | { readonly status: 'not_found' };

export type DeleteUserHandlerDeps = DeleteUserDeps & {
  readonly createUnexpectedMutationErrorResponse: (input: {
    readonly requestId?: string;
    readonly message: string;
  }) => Response;
  readonly createUserMutationErrorResponse: (input: {
    readonly error: unknown;
    readonly requestId?: string;
    readonly forbiddenFallbackMessage: string;
  }) => Response | null;
  readonly logger: {
    readonly error: (message: string, meta: Readonly<Record<string, unknown>>) => void;
  };
  readonly notFoundResponse: (requestId?: string) => Response;
  readonly resolveDeleteRequestContext: (
    request: Request,
    ctx: DeleteAuthenticatedRequestContext
  ) => Promise<DeleteRequestContext>;
};

export const deleteUser = async (deps: DeleteUserDeps, input: DeleteUserInput): Promise<DeleteUserResult> => {
  const prepared = await deps.withInstanceScopedDb(input.actor.instanceId, async (client) => {
    const actorMaxRoleLevel = await deps.resolveActorMaxRoleLevel(client, {
      instanceId: input.actor.instanceId,
      keycloakSubject: input.actorKeycloakSubject,
      sessionRoleNames: input.actorRoles,
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
      actorRoles: input.actorRoles,
      targetRoles: existing.roles,
    });
    if (!targetAccessCheck.ok) {
      throw new Error(`${targetAccessCheck.code}:${targetAccessCheck.message}`);
    }

    if (existing.keycloakSubject === input.actorKeycloakSubject) {
      throw new Error('self_protection:Eigener Nutzer kann nicht gelöscht werden.');
    }

    const deleteAccessCheck = ensureDeleteTargetIsAllowed({ targetRoles: existing.roles });
    if (!deleteAccessCheck.ok) {
      throw new Error(`${deleteAccessCheck.code}:${deleteAccessCheck.message}`);
    }

    const isProtectedSystemAdmin = await deps.isSystemAdminAccount(client, {
      instanceId: input.actor.instanceId,
      accountId: input.userId,
    });
    if (isProtectedSystemAdmin) {
      throw new Error('system_admin_delete_protection:system_admin muss vor der Löschung entzogen werden.');
    }

    await deps.reconcileOwnedContentForAccountDelete(client, {
      instanceId: input.actor.instanceId,
      accountId: input.userId,
    });
    await deps.purgeAccountHardDeleteBlockers(client, {
      instanceId: input.actor.instanceId,
      accountId: input.userId,
    });

    return {
      keycloakSubject: existing.keycloakSubject,
    };
  });

  if (!prepared) {
    return { status: 'not_found' };
  }

  await deps.revokeUserSessions({
    keycloakSubject: prepared.keycloakSubject,
    reason: 'user_deleted',
  });

  await deps.trackKeycloakCall('delete_user', () => deps.deleteIdentityUser(prepared.keycloakSubject));

  await deps.withInstanceScopedDb(input.actor.instanceId, async (client) => {
    await deps.emitActivityLog(client, {
      instanceId: input.actor.instanceId,
      accountId: input.actor.actorAccountId,
      subjectId: input.userId,
      eventType: 'user.deleted',
      result: 'success',
      payload: {
        deleted_account_id: input.userId,
        deleted_keycloak_subject: prepared.keycloakSubject,
      },
      requestId: input.actor.requestId,
      traceId: input.actor.traceId,
    });

    await deps.hardDeleteUserRecord(client, {
      instanceId: input.actor.instanceId,
      accountId: input.userId,
    });
  });

  deps.iamUserOperationsCounter.add(1, { action: 'delete_user', result: 'success' });
  return { status: 'deleted' };
};

export const createDeleteUserHandlerInternal =
  (deps: DeleteUserHandlerDeps) =>
  async (request: Request, ctx: DeleteAuthenticatedRequestContext): Promise<Response> => {
    const resolved = await deps.resolveDeleteRequestContext(request, ctx);
    if (resolved instanceof Response) {
      return resolved;
    }

    try {
      const result = await deleteUser(deps, {
        actor: resolved.actor,
        actorKeycloakSubject: ctx.user.id,
        actorRoles: ctx.user.roles,
        userId: resolved.userId,
      });

      if (result.status === 'not_found') {
        return deps.notFoundResponse(resolved.actor.requestId);
      }
      return new Response(null, { status: 204 });
    } catch (error) {
      const knownError = deps.createUserMutationErrorResponse({
        error,
        requestId: resolved.actor.requestId,
        forbiddenFallbackMessage: 'Löschung dieses Nutzers ist nicht erlaubt.',
      });
      if (knownError) {
        return knownError;
      }

      deps.logger.error('IAM delete user failed', {
        workspace_id: resolved.actor.instanceId,
        context: {
          operation: 'delete_user',
          instance_id: resolved.actor.instanceId,
          user_id: resolved.userId,
          request_id: resolved.actor.requestId,
          trace_id: resolved.actor.traceId,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      deps.iamUserOperationsCounter.add(1, { action: 'delete_user', result: 'failure' });
      return deps.createUnexpectedMutationErrorResponse({
        requestId: resolved.actor.requestId,
        message: 'Nutzer konnte nicht gelöscht werden.',
      });
    }
  };
