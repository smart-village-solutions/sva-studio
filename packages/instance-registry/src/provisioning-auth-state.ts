import type { KeycloakProvisioningClientFactory } from './provisioning-auth-client.js';
import { createReadKeycloakState } from './provisioning-auth-read-state.js';
import { createProvisionInstanceAuthArtifacts } from './provisioning-auth-artifacts.js';

export { createKeycloakProvisioningClientFactory } from './provisioning-auth-client.js';
export type { KeycloakProvisioningClient, KeycloakProvisioningClientFactory, KeycloakProvisioningClientConfigResolver } from './provisioning-auth-client.js';
export { buildMissingRealmReadState, createReadKeycloakState, createReadKeycloakClientSecrets } from './provisioning-auth-read-state.js';
export { readPluginOidcClientAlignment, readPluginOidcClientRequirements } from './provisioning-auth-plugin-clients.js';
export { createProvisionInstanceAuthArtifacts, reconcilePluginOidcClients } from './provisioning-auth-artifacts.js';

export const createKeycloakProvisioningAdapters = (
  createClient: KeycloakProvisioningClientFactory
) => ({
  listKeycloakRealms: () => createClient().listRealms(),
  readKeycloakRealmCreateCapability: () => createClient().hasRealmCreateCapability(),
  readKeycloakState: createReadKeycloakState(createClient),
  provisionInstanceAuthArtifacts: createProvisionInstanceAuthArtifacts(createClient),
  deleteKeycloakRealm: (realm: string) => createClient(realm).deleteRealm(),
});
