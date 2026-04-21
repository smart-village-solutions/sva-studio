import type { IamKeycloakObjectDiagnostic, IamUserListItem } from '@sva/core';

import type { IdentityListedUser } from '../identity-provider-port.js';

import type { UserStatus } from './types.js';

const readSingleAttribute = (
  attributes: Readonly<Record<string, readonly string[]>> | undefined,
  key: string
): string | undefined => {
  const value = attributes?.[key]?.[0]?.trim();
  return value && value.length > 0 ? value : undefined;
};

const resolveDisplayName = (user: IdentityListedUser): string => {
  const explicitDisplayName = readSingleAttribute(user.attributes, 'displayName');
  if (explicitDisplayName) {
    return explicitDisplayName;
  }

  const fullName = [user.firstName, user.lastName]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .trim();

  return fullName || user.username || user.email || user.externalId;
};

const mapKeycloakUserStatus = (user: IdentityListedUser): UserStatus => (user.enabled === false ? 'inactive' : 'active');

export const mapUnmappedKeycloakUser = (
  user: IdentityListedUser,
  roleNames: readonly string[] | null,
  instanceId: string
): IamUserListItem => {
  const configuredInstanceIds = user.attributes?.instanceId ?? [];
  const missingInstanceAttribute = configuredInstanceIds.length === 0;
  const wrongInstanceAttribute = configuredInstanceIds.length > 0 && !configuredInstanceIds.includes(instanceId);
  const diagnostics: IamKeycloakObjectDiagnostic[] = [];
  if (missingInstanceAttribute) {
    diagnostics.push({ code: 'missing_instance_attribute', objectId: user.externalId, objectType: 'user' });
  } else if (wrongInstanceAttribute) {
    diagnostics.push({ code: 'mapping_incomplete', objectId: user.externalId, objectType: 'user' });
  } else {
    diagnostics.push({ code: 'mapping_missing', objectId: user.externalId, objectType: 'user' });
  }
  if (roleNames === null) {
    diagnostics.push({ code: 'keycloak_projection_degraded', objectId: user.externalId, objectType: 'user' });
  }

  return {
    id: `keycloak:${user.externalId}`,
    keycloakSubject: user.externalId,
    displayName: resolveDisplayName(user),
    email: user.email,
    status: mapKeycloakUserStatus(user),
    mappingStatus: missingInstanceAttribute || wrongInstanceAttribute ? 'manual_review' : 'unmapped',
    editability: 'blocked',
    diagnostics,
    roles: [],
  };
};

export const mergeMappedUserWithKeycloak = (
  mapped: IamUserListItem,
  user: IdentityListedUser,
  roleNames: readonly string[] | null
): IamUserListItem => ({
  ...mapped,
  displayName: mapped.displayName || resolveDisplayName(user),
  email: mapped.email ?? user.email,
  status: mapKeycloakUserStatus(user),
  mappingStatus: roleNames === null ? 'manual_review' : 'mapped',
  editability: roleNames === null ? 'blocked' : 'editable',
  diagnostics:
    roleNames === null
      ? [{ code: 'keycloak_projection_degraded', objectId: user.externalId, objectType: 'user' }]
      : mapped.diagnostics,
});
