import type { IamRoleListItem, IamUserImportSyncReport, IamUserListItem } from '@sva/core';

import type { IdentityListedUser, IdentityRole } from '../identity-provider-port.js';

import { resolveIdentityProvider } from './shared-runtime.js';
import { logger, trackKeycloakCall } from './shared-observability.js';
import type { UserStatus } from './types.js';

const PLATFORM_KEYCLOAK_PAGE_SIZE = 100;
const PLATFORM_ROLE_LEVEL_BY_NAME: Readonly<Record<string, number>> = {
  system_admin: 100,
  instance_registry_admin: 90,
};

const BUILTIN_REALM_ROLE_NAMES = new Set(['offline_access', 'uma_authorization']);

const readRoleAttribute = (
  attributes: Readonly<Record<string, readonly string[]>> | undefined,
  key: string
): string | undefined => {
  const value = attributes?.[key]?.[0]?.trim();
  return value && value.length > 0 ? value : undefined;
};

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

const isBuiltInRealmRole = (role: IdentityRole): boolean =>
  BUILTIN_REALM_ROLE_NAMES.has(role.externalName) || role.externalName.startsWith('default-roles-');

const isStudioManagedRole = (role: IdentityRole): boolean =>
  readRoleAttribute(role.attributes, 'managed_by') === 'studio';

const mapPlatformRole = (role: IdentityRole): IamRoleListItem => {
  const roleKey = readRoleAttribute(role.attributes, 'role_key') ?? role.externalName;
  const displayName = readRoleAttribute(role.attributes, 'display_name') ?? role.externalName;
  const roleLevelRaw = readRoleAttribute(role.attributes, 'role_level');
  const parsedRoleLevel = roleLevelRaw ? Number(roleLevelRaw) : PLATFORM_ROLE_LEVEL_BY_NAME[role.externalName] ?? 0;

  return {
    id: role.id ?? `platform:${role.externalName}`,
    roleKey,
    roleName: displayName,
    externalRoleName: role.externalName,
    managedBy: isStudioManagedRole(role) ? 'studio' : 'external',
    description: role.description,
    isSystemRole: role.externalName in PLATFORM_ROLE_LEVEL_BY_NAME,
    roleLevel: Number.isFinite(parsedRoleLevel) ? parsedRoleLevel : 0,
    memberCount: 0,
    syncState: 'synced',
    permissions: [],
  };
};

const listAllPlatformUsers = async (): Promise<{
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
      identityProvider.provider.listUsers({ first, max: PLATFORM_KEYCLOAK_PAGE_SIZE })
    );
    users.push(...page);
    if (page.length < PLATFORM_KEYCLOAK_PAGE_SIZE) {
      return { realm: identityProvider.realm, users };
    }
  }
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

  const { users: listedUsers } = await listAllPlatformUsers();
  const roleNamesBySubject = new Map<string, readonly string[]>();
  await Promise.all(
    listedUsers.map(async (user) => {
      try {
        roleNamesBySubject.set(
          user.externalId,
          await trackKeycloakCall('list_platform_user_roles', () =>
            identityProvider.provider.listUserRoleNames(user.externalId)
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
    })
  );

  const projectedUsers = listedUsers
    .map<IamUserListItem>((user) => ({
      id: `platform:${user.externalId}`,
      keycloakSubject: user.externalId,
      displayName: resolveDisplayName(user),
      email: user.email,
      status: mapUserStatus(user),
      roles: (roleNamesBySubject.get(user.externalId) ?? []).map((roleName) => ({
        roleId: `platform:${roleName}`,
        roleKey: roleName,
        roleName,
        roleLevel: PLATFORM_ROLE_LEVEL_BY_NAME[roleName] ?? 0,
      })),
    }))
    .filter((user) => matchesUserFilters(user, input))
    .sort((left, right) => left.displayName.localeCompare(right.displayName, 'de'));

  const start = Math.max(0, (input.page - 1) * input.pageSize);
  return {
    users: projectedUsers.slice(start, start + input.pageSize),
    total: projectedUsers.length,
  };
};

export const listPlatformRoles = async (): Promise<readonly IamRoleListItem[]> => {
  const identityProvider = resolveIdentityProvider();
  if (!identityProvider) {
    throw new Error('platform_identity_provider_not_configured');
  }

  const roles = await trackKeycloakCall('list_platform_roles', () => identityProvider.provider.listRoles());
  return roles
    .filter((role) => !isBuiltInRealmRole(role))
    .map(mapPlatformRole)
    .sort((left, right) => right.roleLevel - left.roleLevel || left.roleName.localeCompare(right.roleName, 'de'));
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

export const runPlatformRoleReconcile = async (): Promise<{
  outcome: 'success';
  checkedCount: number;
  correctedCount: 0;
  failedCount: 0;
  manualReviewCount: 0;
  requiresManualActionCount: 0;
  roles: readonly {
    externalRoleName: string;
    action: 'noop';
    status: 'synced';
  }[];
}> => {
  const roles = await listPlatformRoles();
  return {
    outcome: 'success',
    checkedCount: roles.length,
    correctedCount: 0,
    failedCount: 0,
    manualReviewCount: 0,
    requiresManualActionCount: 0,
    roles: roles.map((role) => ({
      externalRoleName: role.externalRoleName,
      action: 'noop',
      status: 'synced',
    })),
  };
};
