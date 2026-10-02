import type { ApiErrorCode, IamUserDetail, IamUserListItem, IamUserTimelineEvent } from '@sva/core';

import type { QueryClient } from './query-client.js';
import type { UserStatus } from './types.js';

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
    includeTechnicalAccounts?: boolean;
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

export const listTenantUsersWithCanonicalProjection = async (
  deps: UserReadHandlerDeps,
  input: {
    readonly instanceId: string;
    readonly page: number;
    readonly pageSize: number;
    readonly status?: UserStatus;
    readonly role?: string;
    readonly search?: string;
    readonly includeTechnicalAccounts?: boolean;
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

export const projectUserDetail = async (
  deps: UserReadHandlerDeps,
  actor: UserReadActor,
  userId: string,
  user: IamUserDetail
): Promise<IamUserDetail> => {
  const [keycloakRoleNamesResult, mainserverCredentialStateResult] = await Promise.allSettled([
    deps.resolveKeycloakRoleNames(actor.instanceId, user.keycloakSubject),
    deps.resolveProjectedMainserverCredentialState(
      user.keycloakSubject,
      actor.instanceId
    ),
  ]);

  deps.logUserProjectionDegraded({
    actor,
    userId,
    keycloakRoleNamesResult,
    mainserverCredentialStateResult,
    logger: deps.logger,
  });

  const projectedUser = await deps.withInstanceScopedDb(actor.instanceId, (client) =>
    deps.applyCanonicalUserDetailProjection({
      client,
      instanceId: actor.instanceId,
      user,
      keycloakRoleNames:
        keycloakRoleNamesResult.status === 'fulfilled' ? keycloakRoleNamesResult.value : null,
      mainserverCredentialState:
        mainserverCredentialStateResult.status === 'fulfilled'
          ? mainserverCredentialStateResult.value
          : {
              mainserverUserApplicationId: undefined,
              mainserverUserApplicationSecretSet: false,
            },
    })
  );

  return projectedUser;
};
