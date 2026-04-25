import {
  createKeycloakProvisioningAdapters,
  createKeycloakProvisioningClientFactory,
} from '@sva/instance-registry/provisioning-auth-state';

import {
  KeycloakAdminClient,
  KeycloakAdminRequestError,
  KeycloakAdminUnavailableError,
  getKeycloakAdminClientConfigFromEnv,
  getKeycloakProvisionerClientConfigFromEnv,
} from '../keycloak-admin-client.js';

export const readKeycloakAccessError = (error: unknown): string => {
  if (error instanceof KeycloakAdminUnavailableError) {
    return error.message;
  }
  if (error instanceof KeycloakAdminRequestError) {
    return `HTTP ${error.statusCode} ${error.code}`;
  }
  return error instanceof Error ? error.message : String(error);
};

const createAuthKeycloakClientFactory = (resolveConfig: typeof getKeycloakAdminClientConfigFromEnv) =>
  createKeycloakProvisioningClientFactory(resolveConfig, (config) => new KeycloakAdminClient(config));

const adminAdapters = createKeycloakProvisioningAdapters(
  createAuthKeycloakClientFactory(getKeycloakAdminClientConfigFromEnv)
);

const provisionerAdapters = createKeycloakProvisioningAdapters(
  createAuthKeycloakClientFactory(getKeycloakProvisionerClientConfigFromEnv)
);

export const readKeycloakState = adminAdapters.readKeycloakState;
export const readKeycloakStateViaProvisioner = provisionerAdapters.readKeycloakState;
export const provisionInstanceAuthArtifacts = adminAdapters.provisionInstanceAuthArtifacts;
export const provisionInstanceAuthArtifactsViaProvisioner = provisionerAdapters.provisionInstanceAuthArtifacts;
