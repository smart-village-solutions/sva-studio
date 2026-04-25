import type { ApiErrorCode, IamUserDetail, IamUserListItem, IamUserTimelineEvent } from '@sva/core';

import type { QueryClient } from './query-client.js';
import { USER_STATUS, type UserStatus } from './types.js';

export type UserReadAuthenticatedRequestContext = {
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly instanceId?: string;
    readonly roles: string[];
  };
};

export type UserReadActor = {
  readonly instanceId: string;
  readonly actorAccountId?: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

type UserReadAccessResult =
  | {
      readonly actor: UserReadActor;
    }
  | {
      readonly response: Response;
    };

type ReadValidatedUserIdResult =
  | {
      readonly userId: string;
    }
  | {
      readonly response: Response;
    };

type ProjectedMainserverCredentialState = {
  readonly mainserverUserApplicationId?: string;
  readonly mainserverUserApplicationSecretSet: boolean;
};

type TenantKeycloakUsersResult = {
  readonly users: readonly IamUserListItem[];
  readonly total: number;
  readonly keycloakRoleNamesBySubject?: ReadonlyMap<string, readonly string[] | null>;
};

type Logger = {
  readonly error: (message: string, meta: Readonly<Record<string, unknown>>) => void;
  readonly warn: (message: string, meta: Readonly<Record<string, unknown>>) => void;
};

export type UserReadHandlerDeps = {
  readonly applyCanonicalUserDetailProjection: (input: {
    client: QueryClient;
    instanceId: string;
    user: IamUserDetail;
    keycloakRoleNames?: readonly string[] | null;
    mainserverCredentialState?: ProjectedMainserverCredentialState;
  }) => Promise<IamUserDetail>;
  readonly applyCanonicalUserListProjection: (input: {
    client: QueryClient;
    instanceId: string;
    users: readonly IamUserListItem[];
    keycloakRoleNamesBySubject?: ReadonlyMap<string, readonly string[] | null>;
  }) => Promise<readonly IamUserListItem[]>;
  readonly asApiItem: (data: unknown, requestId?: string) => unknown;
  readonly asApiList: (
    items: readonly unknown[],
    pagination: { readonly page: number; readonly pageSize: number; readonly total: number },
    requestId?: string
  ) => unknown;
  readonly consumeRateLimit: (input: {
    instanceId: string;
    actorKeycloakSubject: string;
    scope: 'read';
    requestId?: string;
  }) => Response | null;
  readonly createApiError: (
    status: number,
    code: ApiErrorCode,
    message: string,
    requestId?: string,
    details?: Readonly<Record<string, unknown>>
  ) => Response;
  readonly createDatabaseApiError: (error: unknown, requestId?: string) => Response;
  readonly jsonResponse: (status: number, payload: unknown) => Response;
  readonly listPlatformUsersInternal: (
    request: Request,
    ctx: UserReadAuthenticatedRequestContext
  ) => Promise<Response>;
  readonly logUserProjectionDegraded: (input: {
    actor: UserReadActor;
    userId: string;
    keycloakRoleNamesResult: PromiseSettledResult<readonly string[] | null>;
    mainserverCredentialStateResult: PromiseSettledResult<ProjectedMainserverCredentialState>;
    logger: Logger;
  }) => void;
  readonly logger: Logger;
  readonly readPage: (request: Request) => { readonly page: number; readonly pageSize: number };
  readonly readString: (value: string | null) => string | undefined;
  readonly readValidatedUserId: (request: Request, requestId?: string) => ReadValidatedUserIdResult;
  readonly resolveKeycloakRoleNames: (
    instanceId: string,
    keycloakSubject: string
  ) => Promise<readonly string[] | null>;
  readonly resolveProjectedMainserverCredentialState: (
    keycloakSubject: string,
    instanceId: string
  ) => Promise<ProjectedMainserverCredentialState>;
  readonly resolveTenantKeycloakUsersWithPagination: (input: {
    client: QueryClient;
    instanceId: string;
    page: number;
    pageSize: number;
    status?: UserStatus;
    role?: string;
    search?: string;
    requestId?: string;
    traceId?: string;
  }) => Promise<TenantKeycloakUsersResult>;
  readonly resolveUserDetail: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly userId: string }
  ) => Promise<IamUserDetail | null | undefined>;
  readonly resolveUserReadAccess: (
    request: Request,
    ctx: UserReadAuthenticatedRequestContext
  ) => Promise<UserReadAccessResult>;
  readonly resolveUserTimeline: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly userId: string }
  ) => Promise<readonly IamUserTimelineEvent[]>;
  readonly withInstanceScopedDb: <T>(
    instanceId: string,
    work: (client: QueryClient) => Promise<T>
  ) => Promise<T>;
};

const createTenantAdminClientNotConfiguredResponse = (
  deps: UserReadHandlerDeps,
  actor: UserReadActor
): Response =>
  deps.createApiError(
    409,
    'tenant_admin_client_not_configured',
    'Tenant-lokale Keycloak-Administration ist nicht konfiguriert.',
    actor.requestId,
    {
      dependency: 'keycloak',
      execution_mode: 'tenant_admin',
      instance_id: actor.instanceId,
      reason_code: 'tenant_admin_client_not_configured',
    }
  );

const listTenantUsersWithCanonicalProjection = async (
  deps: UserReadHandlerDeps,
  input: {
    readonly instanceId: string;
    readonly page: number;
    readonly pageSize: number;
    readonly status?: UserStatus;
    readonly role?: string;
    readonly search?: string;
    readonly requestId?: string;
    readonly traceId?: string;
  }
) => {
  const resolved = await deps.withInstanceScopedDb(input.instanceId, (client) =>
    deps.resolveTenantKeycloakUsersWithPagination({ client, ...input })
  );
  const users = await deps.withInstanceScopedDb(input.instanceId, (client) =>
    deps.applyCanonicalUserListProjection({
      client,
      instanceId: input.instanceId,
      users: resolved.users,
      keycloakRoleNamesBySubject: resolved.keycloakRoleNamesBySubject,
    })
  );

  return { users, total: resolved.total };
};

export const createUserReadHandlers = (deps: UserReadHandlerDeps) => {
  const listUsersInternal = async (
    request: Request,
    ctx: UserReadAuthenticatedRequestContext
  ): Promise<Response> => {
    if (!ctx.user.instanceId) {
      return deps.listPlatformUsersInternal(request, ctx);
    }

    const { page, pageSize } = deps.readPage(request);
    const url = new URL(request.url);
    const status = deps.readString(url.searchParams.get('status')) as UserStatus | undefined;
    const role = deps.readString(url.searchParams.get('role'));
    const search = deps.readString(url.searchParams.get('search'));

    const access = await deps.resolveUserReadAccess(request, ctx);
    if ('response' in access) {
      return access.response;
    }
    const rateLimit = deps.consumeRateLimit({
      instanceId: access.actor.instanceId,
      actorKeycloakSubject: ctx.user.id,
      scope: 'read',
      requestId: access.actor.requestId,
    });
    if (rateLimit) {
      return rateLimit;
    }

    if (status && !USER_STATUS.includes(status)) {
      return deps.createApiError(400, 'invalid_request', 'Ungültiger Status-Filter.', access.actor.requestId);
    }

    try {
      const resolved = await listTenantUsersWithCanonicalProjection(deps, {
        instanceId: access.actor.instanceId,
        page,
        pageSize,
        status,
        role: role ?? undefined,
        search: search ?? undefined,
        requestId: access.actor.requestId,
        traceId: access.actor.traceId,
      });

      return deps.jsonResponse(
        200,
        deps.asApiList(resolved.users, { page, pageSize, total: resolved.total }, access.actor.requestId)
      );
    } catch (error) {
      deps.logger.error('IAM user list failed', {
        operation: 'list_users',
        instance_id: access.actor.instanceId,
        request_id: access.actor.requestId,
        trace_id: access.actor.traceId,
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof Error && error.message === 'tenant_admin_client_not_configured') {
        return createTenantAdminClientNotConfiguredResponse(deps, access.actor);
      }
      return deps.createDatabaseApiError(error, access.actor.requestId);
    }
  };

  const getUserInternal = async (
    request: Request,
    ctx: UserReadAuthenticatedRequestContext
  ): Promise<Response> => {
    const access = await deps.resolveUserReadAccess(request, ctx);
    if ('response' in access) {
      return access.response;
    }
    const userIdResult = deps.readValidatedUserId(request, access.actor.requestId);
    if ('response' in userIdResult) {
      return userIdResult.response;
    }
    const { userId } = userIdResult;

    const rateLimit = deps.consumeRateLimit({
      instanceId: access.actor.instanceId,
      actorKeycloakSubject: ctx.user.id,
      scope: 'read',
      requestId: access.actor.requestId,
    });
    if (rateLimit) {
      return rateLimit;
    }

    try {
      const user = await deps.withInstanceScopedDb(access.actor.instanceId, (client) =>
        deps.resolveUserDetail(client, {
          instanceId: access.actor.instanceId,
          userId,
        })
      );
      if (!user) {
        return deps.createApiError(404, 'not_found', 'Nutzer nicht gefunden.', access.actor.requestId);
      }

      const [keycloakRoleNamesResult, mainserverCredentialStateResult] = await Promise.allSettled([
        deps.resolveKeycloakRoleNames(access.actor.instanceId, user.keycloakSubject),
        deps.resolveProjectedMainserverCredentialState(user.keycloakSubject, access.actor.instanceId),
      ]);

      deps.logUserProjectionDegraded({
        actor: access.actor,
        userId,
        keycloakRoleNamesResult,
        mainserverCredentialStateResult,
        logger: deps.logger,
      });

      const projectedUser = await deps.withInstanceScopedDb(access.actor.instanceId, (client) =>
        deps.applyCanonicalUserDetailProjection({
          client,
          instanceId: access.actor.instanceId,
          user,
          keycloakRoleNames:
            keycloakRoleNamesResult.status === 'fulfilled' ? keycloakRoleNamesResult.value : null,
          mainserverCredentialState:
            mainserverCredentialStateResult.status === 'fulfilled'
              ? mainserverCredentialStateResult.value
              : { mainserverUserApplicationId: undefined, mainserverUserApplicationSecretSet: false },
        })
      );

      return deps.jsonResponse(200, deps.asApiItem(projectedUser, access.actor.requestId));
    } catch (error) {
      return deps.createDatabaseApiError(error, access.actor.requestId);
    }
  };

  const getUserTimelineInternal = async (
    request: Request,
    ctx: UserReadAuthenticatedRequestContext
  ): Promise<Response> => {
    const access = await deps.resolveUserReadAccess(request, ctx);
    if ('response' in access) {
      return access.response;
    }
    const userIdResult = deps.readValidatedUserId(request, access.actor.requestId);
    if ('response' in userIdResult) {
      return userIdResult.response;
    }
    const { userId } = userIdResult;

    try {
      const events = await deps.withInstanceScopedDb(access.actor.instanceId, (client) =>
        deps.resolveUserTimeline(client, {
          instanceId: access.actor.instanceId,
          userId,
        })
      );
      return deps.jsonResponse(
        200,
        deps.asApiList(
          events,
          { page: 1, pageSize: events.length || 1, total: events.length },
          access.actor.requestId
        )
      );
    } catch (error) {
      deps.logger.error('IAM user timeline failed', {
        operation: 'get_user_timeline',
        instance_id: access.actor.instanceId,
        request_id: access.actor.requestId,
        trace_id: access.actor.traceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return deps.createApiError(
        503,
        'database_unavailable',
        'IAM-Historie ist nicht erreichbar.',
        access.actor.requestId
      );
    }
  };

  return {
    getUserInternal,
    getUserTimelineInternal,
    listUsersInternal,
  };
};
