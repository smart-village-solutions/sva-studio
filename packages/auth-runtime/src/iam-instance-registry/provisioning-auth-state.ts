import {
  createKeycloakProvisioningAdapters,
  createKeycloakProvisioningClientFactory,
  createReadKeycloakState,
} from '@sva/instance-registry/provisioning-auth-state';
import type { KeycloakProvisioningInput } from '@sva/instance-registry';
import { SSF_TENANT_OIDC_CLIENT_REQUIREMENT } from '@sva/plugin-ssf/provisioning';

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

const withInstalledPluginOidcClients = <T extends object>(
  input: T
): T & Pick<KeycloakProvisioningInput, 'pluginOidcClients'> => ({
  ...input,
  pluginOidcClients: [SSF_TENANT_OIDC_CLIENT_REQUIREMENT],
});

export const readKeycloakState = (input: KeycloakProvisioningInput) =>
  adminAdapters.readKeycloakState(withInstalledPluginOidcClients(input));
export const readKeycloakStateViaProvisioner = (input: KeycloakProvisioningInput) =>
  provisionerAdapters.readKeycloakState(withInstalledPluginOidcClients(input));
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
  )(withInstalledPluginOidcClients(input));
};
export const provisionInstanceAuthArtifacts = (
  input: Parameters<typeof adminAdapters.provisionInstanceAuthArtifacts>[0]
) =>
  adminAdapters.provisionInstanceAuthArtifacts(withInstalledPluginOidcClients(input));
export const provisionInstanceAuthArtifactsViaProvisioner = (
  input: Parameters<typeof provisionerAdapters.provisionInstanceAuthArtifacts>[0]
) =>
  provisionerAdapters.provisionInstanceAuthArtifacts(withInstalledPluginOidcClients(input));
