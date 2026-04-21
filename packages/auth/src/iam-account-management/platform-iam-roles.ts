import type { IamRoleListItem } from '@sva/core';

import type { IdentityRole } from '../identity-provider-port.js';

import { logger, trackKeycloakCall } from './shared-observability.js';
import { resolveIdentityProvider } from './shared-runtime.js';

export const PLATFORM_ROLE_LEVEL_BY_NAME: Readonly<Record<string, number>> = {
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
  logger.info('reconcile_platform_roles_completed', {
    operation: 'reconcile_platform_roles',
    scope_kind: 'platform',
    checked_count: roles.length,
  });
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
