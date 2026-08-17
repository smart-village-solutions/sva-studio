import {
  createKeycloakProvisioningAdapters,
  createKeycloakProvisioningClientFactory,
  createReadKeycloakState,
} from '@sva/instance-registry/provisioning-auth-state';
import type { KeycloakProvisioningInput } from '@sva/instance-registry';

import {
  KeycloakAdminClient,
  KeycloakAdminRequestError,
  KeycloakAdminUnavailableError,
  getKeycloakAdminClientConfigFromEnv,
  getKeycloakProvisionerClientConfigFromEnv,
  getKeycloakTenantAdminClientConfigFromEnv,
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
export const readKeycloakStateViaTenantAdmin = async (input: KeycloakProvisioningInput) => {
  const clientId = input.tenantAdminClient?.clientId;
  const secretConfigured = input.tenantAdminClient?.secretConfigured === true;
  const clientSecret = input.tenantAdminClientSecret;
  if (!clientId || !secretConfigured || !clientSecret) {
    throw new KeycloakAdminUnavailableError('Tenant admin client credentials are not configured');
  }

  return createReadKeycloakState(
    () => new KeycloakAdminClient(
      getKeycloakTenantAdminClientConfigFromEnv({
        realm: input.authRealm,
        clientId,
        clientSecret,
      })
    )
  )(input);
};
export const provisionInstanceAuthArtifacts = adminAdapters.provisionInstanceAuthArtifacts;
export const provisionInstanceAuthArtifactsViaProvisioner = provisionerAdapters.provisionInstanceAuthArtifacts;
