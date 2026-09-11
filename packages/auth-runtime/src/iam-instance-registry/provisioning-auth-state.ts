import {
  createKeycloakProvisioningAdapters,
  createKeycloakProvisioningClientFactory,
  createReadKeycloakClientSecrets,
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
import { readInstanceRegistryPluginOidcClientRequirements } from './plugin-activation-policy-snapshot.js';

export const readKeycloakAccessError = (error: unknown): string => {
  if (error instanceof KeycloakAdminUnavailableError) {
    return error.message;
  }
  if (error instanceof KeycloakAdminRequestError) {
    return `HTTP ${error.statusCode} ${error.code}`;
  }
  return error instanceof Error ? error.message : String(error);
};

const createAuthKeycloakClientFactory = (
  resolveConfig: typeof getKeycloakAdminClientConfigFromEnv
) =>
  createKeycloakProvisioningClientFactory(
    resolveConfig,
    (config) => new KeycloakAdminClient(config)
  );

const adminClientFactory = createAuthKeycloakClientFactory(getKeycloakAdminClientConfigFromEnv);
const provisionerClientFactory = createAuthKeycloakClientFactory(
  getKeycloakProvisionerClientConfigFromEnv
);
const adminAdapters = createKeycloakProvisioningAdapters(adminClientFactory);
const provisionerAdapters = createKeycloakProvisioningAdapters(provisionerClientFactory);

export const readKeycloakClientSecretsViaProvisioner =
  createReadKeycloakClientSecrets(provisionerClientFactory);

const withDefaultPluginOidcClients = <
  T extends Pick<KeycloakProvisioningInput, 'pluginOidcClients'>,
>(
  input: T
): T & Pick<KeycloakProvisioningInput, 'pluginOidcClients'> => {
  if (input.pluginOidcClients !== undefined) {
    return input;
  }
  const installedRequirements = readInstanceRegistryPluginOidcClientRequirements();
  return {
    ...input,
    pluginOidcClients: installedRequirements,
  };
};

export const readKeycloakState = (input: KeycloakProvisioningInput) =>
  adminAdapters.readKeycloakState(withDefaultPluginOidcClients(input));
export const readKeycloakStateViaProvisioner = (input: KeycloakProvisioningInput) =>
  provisionerAdapters.readKeycloakState(withDefaultPluginOidcClients(input));
export const readKeycloakStateViaTenantAdmin = async (input: KeycloakProvisioningInput) => {
  const clientId = input.tenantAdminClient?.clientId;
  const secretConfigured = input.tenantAdminClient?.secretConfigured === true;
  const clientSecret = input.tenantAdminClientSecret;
  if (!clientId || !secretConfigured || !clientSecret) {
    throw new KeycloakAdminUnavailableError('Tenant admin client credentials are not configured');
  }

  return createReadKeycloakState(
    () =>
      new KeycloakAdminClient(
        getKeycloakTenantAdminClientConfigFromEnv({
          realm: input.authRealm,
          clientId,
          clientSecret,
        })
      )
  )(withDefaultPluginOidcClients(input));
};
export const provisionInstanceAuthArtifacts = (
  input: Parameters<typeof adminAdapters.provisionInstanceAuthArtifacts>[0]
) => adminAdapters.provisionInstanceAuthArtifacts(withDefaultPluginOidcClients(input));
export const provisionInstanceAuthArtifactsViaProvisioner = (
  input: Parameters<typeof provisionerAdapters.provisionInstanceAuthArtifacts>[0]
) => provisionerAdapters.provisionInstanceAuthArtifacts(withDefaultPluginOidcClients(input));
