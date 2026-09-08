import { loadInstanceById } from '@sva/data-repositories/server';

import {
  KeycloakAdminClient,
  getKeycloakProvisionerClientConfigFromEnv,
} from './keycloak-admin-client.js';

export const resolveInstanceKeycloakProjectionTenant = async (
  instanceId: string,
  clientId: string
) => {
  const instance = await loadInstanceById(instanceId);
  if (!instance) return null;

  return {
    instanceId,
    clientId,
    client: new KeycloakAdminClient(getKeycloakProvisionerClientConfigFromEnv(instance.authRealm)),
  };
};
