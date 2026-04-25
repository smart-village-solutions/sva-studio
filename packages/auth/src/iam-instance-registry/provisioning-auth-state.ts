import {
  createProvisionInstanceAuthArtifacts,
  createReadKeycloakState,
  type KeycloakProvisioningClientFactory,
} from '@sva/instance-registry/provisioning-auth-state';

import {
  KeycloakAdminClient,
  KeycloakAdminRequestError,
  KeycloakAdminUnavailableError,
  getKeycloakAdminClientConfigFromEnv,
  getKeycloakProvisionerClientConfigFromEnv,
  type KeycloakAdminClientConfig,
} from '../keycloak-admin-client.js';

type KeycloakClientConfigResolver = (realm?: string) => KeycloakAdminClientConfig;

const createKeycloakClientFactory =
  (resolveConfig: KeycloakClientConfigResolver): KeycloakProvisioningClientFactory =>
  (realm?: string) =>
    new KeycloakAdminClient(resolveConfig(realm));

export const readKeycloakAccessError = (error: unknown): string => {
  if (error instanceof KeycloakAdminUnavailableError) {
    return error.message;
  }
  if (error instanceof KeycloakAdminRequestError) {
    return `HTTP ${error.statusCode} ${error.code}`;
  }
  return error instanceof Error ? error.message : String(error);
};

export const readKeycloakState = createReadKeycloakState(
  createKeycloakClientFactory(getKeycloakAdminClientConfigFromEnv)
);

export const readKeycloakStateViaProvisioner = createReadKeycloakState(
  createKeycloakClientFactory(getKeycloakProvisionerClientConfigFromEnv)
);

export const provisionInstanceAuthArtifacts = createProvisionInstanceAuthArtifacts(
  createKeycloakClientFactory(getKeycloakAdminClientConfigFromEnv)
);

export const provisionInstanceAuthArtifactsViaProvisioner = createProvisionInstanceAuthArtifacts(
  createKeycloakClientFactory(getKeycloakProvisionerClientConfigFromEnv)
);
