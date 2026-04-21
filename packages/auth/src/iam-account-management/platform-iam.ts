import type { IamUserImportSyncReport, IamUserListItem } from '@sva/core';

import type { IdentityListedUser, IdentityUserListQuery } from '../identity-provider-port.js';

import { PLATFORM_ROLE_LEVEL_BY_NAME } from './platform-iam-roles.js';
import { resolveIdentityProvider } from './shared-runtime.js';
import { logger, trackKeycloakCall } from './shared-observability.js';
import type { UserStatus } from './types.js';

export { listPlatformRoles, runPlatformRoleReconcile } from './platform-iam-roles.js';

const PLATFORM_KEYCLOAK_PAGE_SIZE = 100;
const PLATFORM_USER_ROLE_PROJECTION_CONCURRENCY = 5;

const resolveDisplayName = (user: IdentityListedUser): string => {
  const fullName = [user.firstName, user.lastName]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .trim();

  return fullName || user.username || user.email || user.externalId;
};

const mapUserStatus = (user: IdentityListedUser): IamUserListItem['status'] =>
  user.enabled === false ? 'inactive' : 'active';

const matchesUserFilters = (
  user: IamUserListItem,
  filters: {
    readonly status?: UserStatus;
    readonly role?: string;
    readonly search?: string;
  }
): boolean => {
  if (filters.status && user.status !== filters.status) {
    return false;
  }
  if (filters.role && !user.roles.some((role) => role.roleKey === filters.role || role.roleName === filters.role)) {
    return false;
  }
  if (!filters.search) {
    return true;
  }

  const query = filters.search.toLowerCase();
  return [user.displayName, user.email, user.keycloakSubject]
    .filter((value): value is string => typeof value === 'string')
    .some((value) => value.toLowerCase().includes(query));
};

const matchesUserSearchFilter = (user: IamUserListItem, search?: string): boolean => {
  if (!search) {
    return true;
  }

  const query = search.toLowerCase();
  return [user.displayName, user.email, user.keycloakSubject]
    .filter((value): value is string => typeof value === 'string')
    .some((value) => value.toLowerCase().includes(query));
};

const listAllPlatformUsers = async (
  query: Omit<IdentityUserListQuery, 'first' | 'max'> = {}
): Promise<{
  readonly realm: string;
  readonly users: readonly IdentityListedUser[];
}> => {
  const identityProvider = resolveIdentityProvider();
  if (!identityProvider) {
    throw new Error('platform_identity_provider_not_configured');
  }

  const users: IdentityListedUser[] = [];
  for (let first = 0; ; first += PLATFORM_KEYCLOAK_PAGE_SIZE) {
    const page = await trackKeycloakCall('list_platform_users', () =>
      identityProvider.provider.listUsers({ ...query, first, max: PLATFORM_KEYCLOAK_PAGE_SIZE })
    );
    users.push(...page);
    if (page.length < PLATFORM_KEYCLOAK_PAGE_SIZE) {
      return { realm: identityProvider.realm, users };
    }
  }
};

const countPlatformUsers = async (
  provider: {
    readonly countUsers?: (query?: Omit<IdentityUserListQuery, 'first' | 'max'>) => Promise<number>;
  },
  query: Omit<IdentityUserListQuery, 'first' | 'max'>
): Promise<number | null> => {
  if (!provider.countUsers) {
    return null;
  }

  return trackKeycloakCall('count_platform_users', () => provider.countUsers?.(query) ?? Promise.resolve(null));
};

const mapPlatformUser = (
  user: IdentityListedUser,
  roleNames: readonly string[] = []
): IamUserListItem => ({
  id: `platform:${user.externalId}`,
  keycloakSubject: user.externalId,
  displayName: resolveDisplayName(user),
  email: user.email,
  status: mapUserStatus(user),
  roles: roleNames.map((roleName) => ({
    roleId: `platform:${roleName}`,
    roleKey: roleName,
    roleName,
    roleLevel: PLATFORM_ROLE_LEVEL_BY_NAME[roleName] ?? 0,
  })),
});

const resolvePlatformUserRoleNames = async (
  input: {
    readonly users: readonly IdentityListedUser[];
    readonly provider: {
      readonly listUserRoleNames: (externalId: string) => Promise<readonly string[]>;
    };
    readonly requestId?: string;
    readonly traceId?: string;
  }
): Promise<ReadonlyMap<string, readonly string[]>> => {
  const roleNamesBySubject = new Map<string, readonly string[]>();
  const workers = Array.from(
    { length: Math.min(PLATFORM_USER_ROLE_PROJECTION_CONCURRENCY, input.users.length) },
    async (_, workerIndex) => {
      for (let index = workerIndex; index < input.users.length; index += PLATFORM_USER_ROLE_PROJECTION_CONCURRENCY) {
        const user = input.users[index];
        if (!user) {
          continue;
        }
        try {
          roleNamesBySubject.set(
            user.externalId,
            await trackKeycloakCall('list_platform_user_roles', () =>
              input.provider.listUserRoleNames(user.externalId)
            )
          );
        } catch (error) {
          logger.warn('Platform user role projection degraded', {
            operation: 'list_platform_users',
            request_id: input.requestId,
            trace_id: input.traceId,
            user_ref: user.externalId,
            error: error instanceof Error ? error.message : String(error),
          });
          roleNamesBySubject.set(user.externalId, []);
        }
      }
    }
  );

  await Promise.all(workers);
  return roleNamesBySubject;
};

export const listPlatformUsers = async (input: {
  readonly page: number;
  readonly pageSize: number;
  readonly status?: UserStatus;
  readonly role?: string;
  readonly search?: string;
  readonly requestId?: string;
  readonly traceId?: string;
}): Promise<{ readonly users: readonly IamUserListItem[]; readonly total: number }> => {
  const identityProvider = resolveIdentityProvider();
  if (!identityProvider) {
    throw new Error('platform_identity_provider_not_configured');
  }

  const keycloakQuery: Omit<IdentityUserListQuery, 'first' | 'max'> = {
    ...(input.search ? { search: input.search } : {}),
    ...(input.status === 'active'
      ? { enabled: true }
      : input.status === 'inactive'
        ? { enabled: false }
        : {}),
  };
  const start = Math.max(0, (input.page - 1) * input.pageSize);

  if (!input.role) {
    const [listedUsers, countedUsers] = await Promise.all([
      trackKeycloakCall('list_platform_users', () =>
        identityProvider.provider.listUsers({ ...keycloakQuery, first: start, max: input.pageSize })
      ),
      countPlatformUsers(identityProvider.provider, keycloakQuery),
    ]);
    const roleNamesBySubject = await resolvePlatformUserRoleNames({
      users: listedUsers,
      provider: identityProvider.provider,
      requestId: input.requestId,
      traceId: input.traceId,
    });
    const projectedUsers = listedUsers
      .map((user) => mapPlatformUser(user, roleNamesBySubject.get(user.externalId) ?? []))
      .sort((left, right) => left.displayName.localeCompare(right.displayName, 'de'));

    return {
      users: projectedUsers,
      total: countedUsers ?? projectedUsers.length,
    };
  }

  const roleFilterQuery: Omit<IdentityUserListQuery, 'first' | 'max'> =
    input.status === 'active'
      ? { ...keycloakQuery, enabled: true }
      : input.status === 'inactive'
        ? { ...keycloakQuery, enabled: false }
        : keycloakQuery;
  const { users: listedUsers } = await listAllPlatformUsers(roleFilterQuery);
  const listedUserBySubject = new Map(listedUsers.map((user) => [user.externalId, user]));

  const projectedUsersWithoutRoles = listedUsers
    .map((user) => mapPlatformUser(user))
    .filter((user) => matchesUserSearchFilter(user, input.search))
    .sort((left, right) => left.displayName.localeCompare(right.displayName, 'de'));

  const visibleSubjects = new Set(
    projectedUsersWithoutRoles.slice(start, start + input.pageSize).map((user) => user.keycloakSubject)
  );
  const searchedSubjects = new Set(projectedUsersWithoutRoles.map((user) => user.keycloakSubject));
  const roleProjectionCandidates = input.role
    ? listedUsers.filter((user) => searchedSubjects.has(user.externalId))
    : listedUsers.filter((user) => visibleSubjects.has(user.externalId));
  const roleNamesBySubject = await resolvePlatformUserRoleNames({
    users: roleProjectionCandidates,
    provider: identityProvider.provider,
    requestId: input.requestId,
    traceId: input.traceId,
  });
  const projectedUsers = projectedUsersWithoutRoles
    .map((user) =>
      mapPlatformUser(
        listedUserBySubject.get(user.keycloakSubject) ?? { externalId: user.keycloakSubject },
        roleNamesBySubject.get(user.keycloakSubject) ?? []
      )
    )
    .filter((user) => matchesUserFilters(user, input));

  return {
    users: projectedUsers.slice(start, start + input.pageSize),
    total: projectedUsers.length,
  };
};

export const runPlatformKeycloakUserSync = async (input: {
  readonly requestId?: string;
  readonly traceId?: string;
}): Promise<IamUserImportSyncReport> => {
  const { realm, users } = await listAllPlatformUsers();
  logger.info('sync_platform_keycloak_users_completed', {
    operation: 'sync_platform_keycloak_users',
    scope_kind: 'platform',
    auth_realm: realm,
    request_id: input.requestId,
    trace_id: input.traceId,
    checked_count: users.length,
  });
  return {
    outcome: 'success',
    checkedCount: users.length,
    correctedCount: 0,
    manualReviewCount: 0,
    importedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    totalKeycloakUsers: users.length,
    diagnostics: {
      authRealm: realm,
      providerSource: 'platform',
      executionMode: 'platform_admin',
    },
  };
};
