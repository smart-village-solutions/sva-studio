import type { IamUserDetail, IamUserRoleAssignment } from '@sva/core';

import {
  KeycloakAdminRequestError,
  KeycloakAdminUnavailableError,
} from '../keycloak-admin-client.js';
import {
  getSvaMainserverCredentialAttributeNames,
  readIdentityUserAttributes,
  resolveMainserverCredentialState,
} from '../mainserver-credentials.server.js';

import { getRoleDisplayName } from './role-audit.js';
import {
  resolveIdentityProviderForInstance,
  resolveRolesByExternalNames,
  trackKeycloakCall,
} from './shared.js';

const mapProjectedRoles = (
  roles: Awaited<ReturnType<typeof resolveRolesByExternalNames>>
): readonly IamUserRoleAssignment[] =>
  roles.map((role) => ({
    roleId: role.id,
    roleKey: role.role_key,
    roleName: getRoleDisplayName(role),
    roleLevel: role.role_level,
  }));

const mergeProjectedRoles = (user: IamUserDetail, roles: readonly IamUserRoleAssignment[]): IamUserDetail => ({
  ...user,
  roles,
});

export const mergeMainserverCredentialState = (
  user: IamUserDetail,
  state: ReturnType<typeof resolveMainserverCredentialState>
): IamUserDetail => ({
  ...user,
  mainserverUserApplicationId: state.mainserverUserApplicationId,
  mainserverUserApplicationSecretSet: state.mainserverUserApplicationSecretSet,
});

export const resolveKeycloakRoleNames = async (
  instanceId: string,
  keycloakSubject: string
): Promise<readonly string[] | null> => {
  const identityProvider = await resolveIdentityProviderForInstance(instanceId);
  if (!identityProvider) {
    return null;
  }

  return [
    ...new Set(
      await trackKeycloakCall('list_user_roles', () => identityProvider.provider.listUserRoleNames(keycloakSubject))
    ),
  ];
};

export const resolveProjectedUserDetail = async (input: {
  client: Parameters<typeof resolveRolesByExternalNames>[0];
  instanceId: string;
  user: IamUserDetail;
  keycloakRoleNames: readonly string[] | null;
}): Promise<IamUserDetail> => {
  if (input.keycloakRoleNames === null) {
    return input.user;
  }

  const mappedRoles = await resolveRolesByExternalNames(input.client, {
    instanceId: input.instanceId,
    externalRoleNames: input.keycloakRoleNames,
  });
  const projectedRoles = mapProjectedRoles(mappedRoles);
  const currentRoleIds = new Set(input.user.roles.map((role) => role.roleId));
  const changed =
    currentRoleIds.size !== projectedRoles.length ||
    projectedRoles.some((role) => !currentRoleIds.has(role.roleId));

  return changed ? mergeProjectedRoles(input.user, projectedRoles) : input.user;
};

export const resolveProjectedMainserverCredentialState = async (
  keycloakSubject: string,
  instanceId: string
) =>
  resolveMainserverCredentialState(
    await readIdentityUserAttributes({
      keycloakSubject,
      attributeNames: getSvaMainserverCredentialAttributeNames(),
      instanceId,
    })
  );

export const isRecoverableUserProjectionError = (
  error: unknown
): error is KeycloakAdminRequestError | KeycloakAdminUnavailableError =>
  error instanceof KeycloakAdminRequestError || error instanceof KeycloakAdminUnavailableError;
