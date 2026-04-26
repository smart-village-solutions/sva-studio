import type { IamUserRoleAssignment } from '@sva/core';

import type { BulkUserAccess } from './user-bulk-query.js';
import type { QueryClient } from './query-client.js';

export type BulkDeactivateAuthenticatedRequestContext = {
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly instanceId?: string;
    readonly roles: string[];
  };
};

export type BulkDeactivateActor = {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

export type BulkDeactivateResolvedContext =
  | Response
  | {
      readonly actor: BulkDeactivateActor;
      readonly identityProvider: {
        readonly provider: {
          readonly deactivateUser: (keycloakSubject: string) => Promise<void>;
        };
      };
      readonly payload: {
        readonly userIds: readonly string[];
      };
      readonly idempotencyKey: string;
    };

export type BulkDeactivateHandlerDeps = {
  readonly completeBulkDeactivateFailure: (input: {
    actor: BulkDeactivateActor;
    idempotencyKey: string;
    error: unknown;
  }) => Promise<Response>;
  readonly completeBulkDeactivateSuccess: (input: {
    actor: BulkDeactivateActor;
    idempotencyKey: string;
    details: readonly { readonly id: string }[];
  }) => Promise<Response>;
  readonly emitActivityLog: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly accountId?: string;
      readonly eventType: 'user.bulk_deactivated';
      readonly result: 'success';
      readonly payload: Readonly<Record<string, unknown>>;
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
  readonly logger: {
    readonly error: (message: string, meta: Readonly<Record<string, unknown>>) => void;
  };
  readonly notifyPermissionInvalidation: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly keycloakSubject: string;
      readonly trigger: 'user_bulk_deactivated';
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
  readonly resolveBulkDeactivateContext: (
    request: Request,
    ctx: BulkDeactivateAuthenticatedRequestContext
  ) => Promise<BulkDeactivateResolvedContext>;
  readonly resolveSystemAdminCount: (client: QueryClient, instanceId: string) => Promise<number>;
  readonly resolveUsersForBulkDeactivation: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly userIds: readonly string[] }
  ) => Promise<readonly BulkUserAccess[]>;
  readonly trackKeycloakCall: <T>(operation: 'deactivate_user_bulk', work: () => Promise<T>) => Promise<T>;
  readonly withInstanceScopedDb: <T>(
    instanceId: string,
    work: (client: QueryClient) => Promise<T>
  ) => Promise<T>;
};

const hasSystemAdminRole = (
  roles: readonly Pick<IamUserRoleAssignment, 'roleKey'>[]
): boolean => roles.some((role) => role.roleKey === 'system_admin');

const validateBulkDeactivationTargets = async (
  deps: BulkDeactivateHandlerDeps,
  input: {
    actor: BulkDeactivateActor;
    ctx: BulkDeactivateAuthenticatedRequestContext;
    actorMaxRoleLevel: number;
    users: readonly BulkUserAccess[];
    resolveAdminCount: () => Promise<number>;
  }
) => {
  if (input.users.some((entry) => entry.keycloakSubject === input.ctx.user.id)) {
    throw new Error('self_protection:Eigener Nutzer kann nicht deaktiviert werden.');
  }

  const targetedActiveAdminCount = input.users.filter(
    (user) => user.status === 'active' && hasSystemAdminRole(user.roles)
  ).length;
  if (targetedActiveAdminCount > 0 && (await input.resolveAdminCount()) <= targetedActiveAdminCount) {
    throw new Error('last_admin_protection:Letzter aktiver system_admin kann nicht deaktiviert werden.');
  }

  for (const user of input.users) {
    const targetAccessCheck = deps.ensureActorCanManageTarget({
      actorMaxRoleLevel: input.actorMaxRoleLevel,
      actorRoles: input.ctx.user.roles,
      targetRoles: user.roles,
    });
    if (!targetAccessCheck.ok) {
      throw new Error(`${targetAccessCheck.code}:${targetAccessCheck.message}`);
    }
  }
};

const deactivateUsersInBulk = async (
  deps: BulkDeactivateHandlerDeps,
  input: {
    actor: BulkDeactivateActor;
    ctx: BulkDeactivateAuthenticatedRequestContext;
    userIds: readonly string[];
  }
) =>
  deps.withInstanceScopedDb(input.actor.instanceId, async (client) => {
    const actorMaxRoleLevel = await deps.resolveActorMaxRoleLevel(client, {
      instanceId: input.actor.instanceId,
      keycloakSubject: input.ctx.user.id,
      sessionRoleNames: input.ctx.user.roles,
    });
    const users = await deps.resolveUsersForBulkDeactivation(client, {
      instanceId: input.actor.instanceId,
      userIds: input.userIds,
    });

    await validateBulkDeactivationTargets(deps, {
      actor: input.actor,
      ctx: input.ctx,
      actorMaxRoleLevel,
      users,
      resolveAdminCount: () => deps.resolveSystemAdminCount(client, input.actor.instanceId),
    });

    await client.query(
      `
UPDATE iam.accounts
SET
  status = 'inactive',
  updated_at = NOW()
WHERE instance_id = $1
  AND id = ANY($2::uuid[]);
`,
      [input.actor.instanceId, input.userIds]
    );

    await deps.emitActivityLog(client, {
      instanceId: input.actor.instanceId,
      accountId: input.actor.actorAccountId,
      eventType: 'user.bulk_deactivated',
      result: 'success',
      payload: {
        total: users.length,
      },
      requestId: input.actor.requestId,
      traceId: input.actor.traceId,
    });

    await Promise.all(
      users.map((user) =>
        deps.notifyPermissionInvalidation(client, {
          instanceId: input.actor.instanceId,
          keycloakSubject: user.keycloakSubject,
          trigger: 'user_bulk_deactivated',
        })
      )
    );

    return users;
  });

export const createBulkDeactivateHandlerInternal =
  (deps: BulkDeactivateHandlerDeps) =>
  async (request: Request, ctx: BulkDeactivateAuthenticatedRequestContext): Promise<Response> => {
    const resolved = await deps.resolveBulkDeactivateContext(request, ctx);
    if (resolved instanceof Response) {
      return resolved;
    }

    try {
      const uniqueUserIds = [...new Set(resolved.payload.userIds)];
      const details = await deactivateUsersInBulk(deps, {
        actor: resolved.actor,
        ctx,
        userIds: uniqueUserIds,
      });

      await Promise.all(
        details.map((detail) =>
          deps.trackKeycloakCall('deactivate_user_bulk', () =>
            resolved.identityProvider.provider.deactivateUser(detail.keycloakSubject)
          )
        )
      );
      deps.iamUserOperationsCounter.add(1, { action: 'bulk_deactivate', result: 'success' });

      return await deps.completeBulkDeactivateSuccess({
        actor: resolved.actor,
        idempotencyKey: resolved.idempotencyKey,
        details,
      });
    } catch (error) {
      deps.logger.error('IAM bulk deactivate failed', {
        workspace_id: resolved.actor.instanceId,
        context: {
          operation: 'bulk_deactivate',
          instance_id: resolved.actor.instanceId,
          request_id: resolved.actor.requestId,
          trace_id: resolved.actor.traceId,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      deps.iamUserOperationsCounter.add(1, { action: 'bulk_deactivate', result: 'failure' });
      return await deps.completeBulkDeactivateFailure({
        actor: resolved.actor,
        idempotencyKey: resolved.idempotencyKey,
        error,
      });
    }
  };
