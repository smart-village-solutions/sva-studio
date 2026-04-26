import type { IamUserDetail, IamUserListItem, IamUserRoleAssignment } from '@sva/core';

import {
  KeycloakAdminRequestError,
  KeycloakAdminUnavailableError,
} from '../keycloak-admin-client.js';
import {
  getSvaMainserverCredentialAttributeNames,
  readIdentityUserAttributes,
  resolveMainserverCredentialState,
} from '../mainserver-credentials.js';

import { getRoleDisplayName } from './role-audit.js';
import {
  resolveIdentityProviderForInstance,
  resolveRolesByExternalNames,
  trackKeycloakCall,
} from './shared.js';

type ProjectedMainserverCredentialState = ReturnType<typeof resolveMainserverCredentialState>;

const DEFAULT_MAINSERVER_CREDENTIAL_STATE: ProjectedMainserverCredentialState = {
  mainserverUserApplicationId: undefined,
  mainserverUserApplicationSecretSet: false,
};

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
  state: ProjectedMainserverCredentialState
): IamUserDetail => ({
  ...user,
  mainserverUserApplicationId: state.mainserverUserApplicationId,
  mainserverUserApplicationSecretSet: state.mainserverUserApplicationSecretSet,
});

export const resolveKeycloakRoleNames = async (
  instanceId: string,
  keycloakSubject: string
): Promise<readonly string[] | null> => {
  const identityProvider = await resolveIdentityProviderForInstance(instanceId, {
    executionMode: 'tenant_admin',
  });
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

export const applyCanonicalUserDetailProjection = async (input: {
  client: Parameters<typeof resolveRolesByExternalNames>[0];
  instanceId: string;
  user: IamUserDetail;
  keycloakRoleNames?: readonly string[] | null;
  mainserverCredentialState?: ProjectedMainserverCredentialState;
}): Promise<IamUserDetail> => {
  const resolvedKeycloakRoleNames =
    input.keycloakRoleNames !== undefined
      ? input.keycloakRoleNames
      : await resolveKeycloakRoleNames(input.instanceId, input.user.keycloakSubject).catch((error: unknown) => {
          if (!isRecoverableUserProjectionError(error)) {
            throw error;
          }
          return null;
        });
  const resolvedMainserverCredentialState =
    input.mainserverCredentialState ??
    (await resolveProjectedMainserverCredentialState(input.user.keycloakSubject, input.instanceId).catch(
      () => DEFAULT_MAINSERVER_CREDENTIAL_STATE
    ));

  const projectedUser = await resolveProjectedUserDetail({
    client: input.client,
    instanceId: input.instanceId,
    user: input.user,
    keycloakRoleNames: resolvedKeycloakRoleNames,
  });

  return mergeMainserverCredentialState(
    projectedUser,
    resolvedMainserverCredentialState
  );
};

const buildProjectedRolesByExternalName = async (
  client: Parameters<typeof resolveRolesByExternalNames>[0],
  instanceId: string,
  keycloakRoleNamesBySubject: ReadonlyMap<string, readonly string[] | null>
) => {
  const externalRoleNames = [
    ...new Set(
      [...keycloakRoleNamesBySubject.values()]
        .flatMap((roleNames) => roleNames ?? [])
        .filter((roleName) => roleName.trim().length > 0)
    ),
  ];

  if (externalRoleNames.length === 0) {
    return new Map<string, IamUserRoleAssignment>();
  }

  const mappedRoles = await resolveRolesByExternalNames(client, {
    instanceId,
    externalRoleNames,
  });

  return new Map(
    mappedRoles.map((role) => [
      role.external_role_name ?? role.role_key,
      {
        roleId: role.id,
        roleKey: role.role_key,
        roleName: getRoleDisplayName(role),
        roleLevel: role.role_level,
      } satisfies IamUserRoleAssignment,
    ])
  );
};

export const applyCanonicalUserListProjection = async (input: {
  client: Parameters<typeof resolveRolesByExternalNames>[0];
  instanceId: string;
  users: readonly IamUserListItem[];
  keycloakRoleNamesBySubject?: ReadonlyMap<string, readonly string[] | null>;
}): Promise<readonly IamUserListItem[]> => {
  const keycloakRoleNamesBySubject =
    input.keycloakRoleNamesBySubject ??
    new Map(
      await Promise.all(
        input.users.map(async (user) => {
          try {
            return [
              user.keycloakSubject,
              await resolveKeycloakRoleNames(input.instanceId, user.keycloakSubject),
            ] as const;
          } catch (error) {
            if (!isRecoverableUserProjectionError(error)) {
              throw error;
            }
            return [user.keycloakSubject, null] as const;
          }
        })
      )
    );

  const projectedRolesByExternalName = await buildProjectedRolesByExternalName(
    input.client,
    input.instanceId,
    keycloakRoleNamesBySubject
  );

  return input.users.map((user) => {
    const keycloakRoleNames = keycloakRoleNamesBySubject.get(user.keycloakSubject) ?? null;
    if (keycloakRoleNames === null) {
      return user;
    }

    const projectedRoles = [...new Set(keycloakRoleNames)]
      .map((roleName) => projectedRolesByExternalName.get(roleName))
      .filter((role): role is IamUserRoleAssignment => role !== undefined);
    const currentRoleIds = new Set(user.roles.map((role) => role.roleId));
    const changed =
      currentRoleIds.size !== projectedRoles.length ||
      projectedRoles.some((role) => !currentRoleIds.has(role.roleId));

    return changed
      ? {
          ...user,
          roles: projectedRoles,
        }
      : user;
  });
};
