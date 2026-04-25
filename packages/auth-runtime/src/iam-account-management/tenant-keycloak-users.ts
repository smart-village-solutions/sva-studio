import type { IamUserListItem } from '@sva/core';

import type { IdentityListedUser, IdentityProviderPort, IdentityUserListQuery } from '../identity-provider-port.js';
import {
  KeycloakAdminRequestError,
  KeycloakAdminUnavailableError,
} from '../keycloak-admin-client.js';
import type { QueryClient } from '../db.js';

import { resolveIdentityProviderForInstance } from './shared-runtime.js';
import { logger, trackKeycloakCall } from './shared-observability.js';
import { loadMappedUsersBySubject } from './tenant-keycloak-user-query.js';
import { mapUnmappedKeycloakUser, mergeMappedUserWithKeycloak } from './tenant-keycloak-user-projection.js';
import type { UserStatus } from './types.js';

const TENANT_KEYCLOAK_PAGE_SIZE = 100;
const TENANT_USER_ROLE_PROJECTION_CONCURRENCY = 5;

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
      for (let index = workerIndex; index < input.users.length; index += TENANT_USER_ROLE_PROJECTION_CONCURRENCY) {
        const user = input.users[index];
        if (!user) {
          continue;
        }
        try {
          roleNamesBySubject.set(
            user.externalId,
            await trackKeycloakCall('list_tenant_user_roles', () => input.provider.listUserRoleNames(user.externalId))
          );
        } catch (error) {
          if (!(error instanceof KeycloakAdminRequestError) && !(error instanceof KeycloakAdminUnavailableError)) {
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

const listAllTenantUsers = async (
  provider: IdentityProviderPort,
  query: Omit<IdentityUserListQuery, 'first' | 'max'>
): Promise<readonly IdentityListedUser[]> => {
  const users: IdentityListedUser[] = [];
  for (let first = 0; ; first += TENANT_KEYCLOAK_PAGE_SIZE) {
    const page = await trackKeycloakCall('list_tenant_users', () =>
      provider.listUsers({ ...query, first, max: TENANT_KEYCLOAK_PAGE_SIZE })
    );
    users.push(...page);
    if (page.length < TENANT_KEYCLOAK_PAGE_SIZE) {
      return users;
    }
  }
};

export const resolveTenantKeycloakUsersWithPagination = async (
  input: TenantKeycloakUsersInput
): Promise<TenantKeycloakUsersResult> => {
  const identityProvider = await resolveIdentityProviderForInstance(input.instanceId, { executionMode: 'tenant_admin' });
  if (!identityProvider) {
    throw new Error('tenant_admin_client_not_configured');
  }
  if (input.status === 'pending') {
    return { users: [], total: 0, keycloakRoleNamesBySubject: new Map() };
  }

  const query = toKeycloakQuery(input);
  const first = Math.max(0, (input.page - 1) * input.pageSize);

  const listedUsers = input.role
    ? await listAllTenantUsers(identityProvider.provider, query)
    : await trackKeycloakCall('list_tenant_users', () =>
        identityProvider.provider.listUsers({ ...query, first, max: input.pageSize })
      );
  const roleNamesBySubject = await resolveRoleNamesForUsers({
    provider: identityProvider.provider,
    users: listedUsers,
    instanceId: input.instanceId,
    requestId: input.requestId,
    traceId: input.traceId,
  });
  const roleFilteredUsers = input.role
    ? listedUsers.filter((user) => roleNamesBySubject.get(user.externalId)?.includes(input.role as string))
    : listedUsers;
  const visibleUsers = input.role ? roleFilteredUsers.slice(first, first + input.pageSize) : roleFilteredUsers;
  const mappedUsersBySubject = await loadMappedUsersBySubject(input.client, {
    instanceId: input.instanceId,
    subjects: visibleUsers.map((user) => user.externalId),
  });

  const users = visibleUsers.map((user) => {
    const roleNames = roleNamesBySubject.get(user.externalId) ?? null;
    const mapped = mappedUsersBySubject.get(user.externalId);
    return mapped
      ? mergeMappedUserWithKeycloak(mapped, user, roleNames)
      : mapUnmappedKeycloakUser(user, roleNames, input.instanceId);
  });

  const total = input.role
    ? roleFilteredUsers.length
    : (await identityProvider.provider.countUsers?.(query)) ?? users.length;

  const visibleRoleNamesBySubject = new Map(
    users.map((user) => [user.keycloakSubject, roleNamesBySubject.get(user.keycloakSubject) ?? null] as const)
  );

  return { users, total, keycloakRoleNamesBySubject: visibleRoleNamesBySubject };
};
