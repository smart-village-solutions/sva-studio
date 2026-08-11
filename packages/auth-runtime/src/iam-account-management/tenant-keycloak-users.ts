import type { IamUserListItem } from '@sva/core';

import type {
  IdentityListedUser,
  IdentityProviderPort,
  IdentityUserListQuery,
} from '../identity-provider-port.js';
import {
  KeycloakAdminRequestError,
  KeycloakAdminUnavailableError,
} from '../keycloak-admin-client.js';
import type { QueryClient } from '../db.js';

import { resolveIdentityProviderForInstance } from './shared-runtime.js';
import { logger, trackKeycloakCall } from './shared-observability.js';
import { loadMappedUsersBySubject } from './tenant-keycloak-user-query.js';
import {
  mapUnmappedKeycloakUser,
  mergeMappedUserWithKeycloak,
} from './tenant-keycloak-user-projection.js';
import type { UserStatus } from './types.js';
import { resolveMainserverCredentialStatus } from '../mainserver-credentials.js';

const TENANT_USER_ROLE_PROJECTION_CONCURRENCY = 5;
const TENANT_USER_FILTER_WINDOW_SIZE = 100;

type TenantKeycloakUsersResult = {
  readonly users: readonly IamUserListItem[];
  readonly total: number;
  readonly keycloakRoleNamesBySubject: ReadonlyMap<string, readonly string[] | null>;
};

type TenantKeycloakUsersInput = {
  readonly client: QueryClient;
  readonly instanceId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly status?: UserStatus;
  readonly role?: string;
  readonly search?: string;
  readonly includeTechnicalAccounts?: boolean;
  readonly requestId?: string;
  readonly traceId?: string;
};

const toKeycloakQuery = (
  input: Pick<TenantKeycloakUsersInput, 'search' | 'status'>
): Omit<IdentityUserListQuery, 'first' | 'max'> => ({
  ...(input.search ? { search: input.search } : {}),
  ...(input.status === 'active'
    ? { enabled: true }
    : input.status === 'inactive'
      ? { enabled: false }
      : {}),
});

const resolveRoleNamesForUsers = async (input: {
  readonly provider: IdentityProviderPort;
  readonly users: readonly IdentityListedUser[];
  readonly instanceId: string;
  readonly requestId?: string;
  readonly traceId?: string;
}): Promise<ReadonlyMap<string, readonly string[] | null>> => {
  const roleNamesBySubject = new Map<string, readonly string[] | null>();
  const workers = Array.from(
    { length: Math.min(TENANT_USER_ROLE_PROJECTION_CONCURRENCY, input.users.length) },
    async (_, workerIndex) => {
      for (
        let index = workerIndex;
        index < input.users.length;
        index += TENANT_USER_ROLE_PROJECTION_CONCURRENCY
      ) {
        const user = input.users[index];
        if (!user) {
          continue;
        }
        try {
          roleNamesBySubject.set(
            user.externalId,
            await trackKeycloakCall('list_tenant_user_roles', () =>
              input.provider.listUserRoleNames(user.externalId)
            )
          );
        } catch (error) {
          if (
            !(error instanceof KeycloakAdminRequestError) &&
            !(error instanceof KeycloakAdminUnavailableError)
          ) {
            throw error;
          }
          logger.warn('Tenant user role projection degraded', {
            operation: 'list_tenant_keycloak_users',
            instance_id: input.instanceId,
            request_id: input.requestId,
            trace_id: input.traceId,
            user_ref: user.externalId,
            error: error instanceof Error ? error.message : String(error),
          });
          roleNamesBySubject.set(user.externalId, null);
        }
      }
    }
  );
  await Promise.all(workers);
  return roleNamesBySubject;
};

const loadVisibleKeycloakPage = async (input: {
  readonly request: TenantKeycloakUsersInput;
  readonly provider: IdentityProviderPort;
  readonly query: Omit<IdentityUserListQuery, 'first' | 'max'>;
}): Promise<{
  readonly listedUsers: readonly IdentityListedUser[];
  readonly mappedUsersBySubject: ReadonlyMap<string, IamUserListItem>;
  readonly total: number;
}> => {
  const requestedFirst = Math.max(0, (input.request.page - 1) * input.request.pageSize);
  if (input.request.includeTechnicalAccounts) {
    const listedUsers = await trackKeycloakCall('list_tenant_users', () =>
      input.provider.listUsers({
        ...input.query,
        first: requestedFirst,
        max: input.request.pageSize,
      })
    );
    return {
      listedUsers,
      mappedUsersBySubject: await loadMappedUsersBySubject(input.request.client, {
        instanceId: input.request.instanceId,
        subjects: listedUsers.map((user) => user.externalId),
      }),
      total: (await input.provider.countUsers?.(input.query)) ?? listedUsers.length,
    };
  }

  const allMatchingUsers: IdentityListedUser[] = [];
  const keycloakTotal = await input.provider.countUsers?.(input.query);
  for (
    let first = 0;
    keycloakTotal === undefined || first < keycloakTotal;
    first += TENANT_USER_FILTER_WINDOW_SIZE
  ) {
    const window = await trackKeycloakCall('list_tenant_users', () =>
      input.provider.listUsers({ ...input.query, first, max: TENANT_USER_FILTER_WINDOW_SIZE })
    );
    allMatchingUsers.push(...window);
    if (window.length < TENANT_USER_FILTER_WINDOW_SIZE) break;
  }
  const mappedUsersBySubject = await loadMappedUsersBySubject(input.request.client, {
    instanceId: input.request.instanceId,
    subjects: allMatchingUsers.map((user) => user.externalId),
  });
  const visible = allMatchingUsers.filter(
    (user) => mappedUsersBySubject.get(user.externalId)?.isTechnicalAccount !== true
  );
  return {
    listedUsers: visible.slice(requestedFirst, requestedFirst + input.request.pageSize),
    mappedUsersBySubject,
    total: visible.length,
  };
};

export const resolveTenantKeycloakUsersWithPagination = async (
  input: TenantKeycloakUsersInput
): Promise<TenantKeycloakUsersResult> => {
  if (input.status === 'pending') {
    return { users: [], total: 0, keycloakRoleNamesBySubject: new Map() };
  }

  if (input.role) {
    const { resolveUsersWithPagination } = await import('@sva/iam-admin');
    const localResult = await resolveUsersWithPagination(input.client, {
      instanceId: input.instanceId,
      page: input.page,
      pageSize: input.pageSize,
      status: input.status,
      role: input.role,
      search: input.search,
      includeTechnicalAccounts: input.includeTechnicalAccounts,
    });

    return {
      users: localResult.users,
      total: localResult.total,
      keycloakRoleNamesBySubject: new Map(
        localResult.users.map((user) => [user.keycloakSubject, null] as const)
      ),
    };
  }

  const identityProvider = await resolveIdentityProviderForInstance(input.instanceId, {
    executionMode: 'tenant_admin',
  });
  if (!identityProvider) {
    throw new Error('tenant_admin_client_not_configured');
  }

  const { listedUsers, mappedUsersBySubject, total } = await loadVisibleKeycloakPage({
    request: input,
    provider: identityProvider.provider,
    query: toKeycloakQuery(input),
  });
  const roleNamesBySubject = await resolveRoleNamesForUsers({
    provider: identityProvider.provider,
    users: listedUsers,
    instanceId: input.instanceId,
    requestId: input.requestId,
    traceId: input.traceId,
  });
  const roleFilteredUsers = listedUsers;
  const visibleUsers = roleFilteredUsers;
  const users = visibleUsers.map((user) => {
    const roleNames = roleNamesBySubject.get(user.externalId) ?? null;
    const mapped = mappedUsersBySubject.get(user.externalId);
    const mainserverCredentialStatus = resolveMainserverCredentialStatus(user.attributes);
    return mapped
      ? mergeMappedUserWithKeycloak(mapped, user, roleNames, mainserverCredentialStatus)
      : mapUnmappedKeycloakUser(user, roleNames, mainserverCredentialStatus);
  });

  const visibleRoleNamesBySubject = new Map(
    users.map(
      (user) =>
        [user.keycloakSubject, roleNamesBySubject.get(user.keycloakSubject) ?? null] as const
    )
  );

  return { users, total, keycloakRoleNamesBySubject: visibleRoleNamesBySubject };
};
