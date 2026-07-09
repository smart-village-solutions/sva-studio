import type { IamUserDetail, IamUserListItem } from '@sva/core';

import {
  KeycloakAdminRequestError,
  KeycloakAdminUnavailableError,
} from '../keycloak-admin-client.js';
import {
  getSvaMainserverCredentialAttributeNames,
  readIdentityUserAttributes,
  resolveMainserverCredentialState,
} from '../mainserver-credentials.js';

import {
  resolveIdentityProviderForInstance,
  trackKeycloakCall,
} from './shared.js';
import { markUserProjectionDegraded } from './projection-diagnostics.js';

type ProjectedMainserverCredentialState = ReturnType<typeof resolveMainserverCredentialState>;

const DEFAULT_MAINSERVER_CREDENTIAL_STATE: ProjectedMainserverCredentialState = {
  mainserverUserApplicationId: undefined,
  mainserverUserApplicationSecretSet: false,
};

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

const resolveProjectedUserDetail = async (input: {
  instanceId: string;
  user: IamUserDetail;
  keycloakRoleNames: readonly string[] | null;
}): Promise<IamUserDetail> => {
  if (input.keycloakRoleNames === null) {
    return markUserProjectionDegraded(input.user);
  }

  return {
    ...input.user,
    keycloakRoles: [...input.keycloakRoleNames],
  };
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
  instanceId: string;
  user: IamUserDetail;
  keycloakRoleNames?: readonly string[] | null;
  mainserverCredentialState?: ProjectedMainserverCredentialState;
}): Promise<IamUserDetail> => {
  let keycloakProjectionDegraded = false;
  const resolvedKeycloakRoleNames =
    input.keycloakRoleNames !== undefined
      ? input.keycloakRoleNames
      : await resolveKeycloakRoleNames(input.instanceId, input.user.keycloakSubject).catch((error: unknown) => {
          if (!isRecoverableUserProjectionError(error)) {
            throw error;
          }
          keycloakProjectionDegraded = true;
          return null;
        });
  const resolvedMainserverCredentialState =
    input.mainserverCredentialState ??
    (await resolveProjectedMainserverCredentialState(input.user.keycloakSubject, input.instanceId).catch(
      () => DEFAULT_MAINSERVER_CREDENTIAL_STATE
    ));

  const projectedUser = await resolveProjectedUserDetail({
    instanceId: input.instanceId,
    user: input.user,
    keycloakRoleNames: resolvedKeycloakRoleNames,
  });

  const mergedUser = mergeMainserverCredentialState(projectedUser, resolvedMainserverCredentialState);
  return keycloakProjectionDegraded ? markUserProjectionDegraded(mergedUser) : mergedUser;
};

export const applyCanonicalUserListProjection = async (input: {
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
  return input.users.map((user) => {
    const keycloakRoleNames = keycloakRoleNamesBySubject.get(user.keycloakSubject) ?? null;
    if (keycloakRoleNames === null) {
      return user;
    }

    return {
      ...user,
      keycloakRoles: [...keycloakRoleNames],
    };
  });
};
