import { loadInstanceById } from '@sva/data-repositories/server';

import {
  KeycloakAdminClient,
  getKeycloakProvisionerClientConfigFromEnv,
} from './keycloak-admin-client.js';

export const resolveInstanceKeycloakProjectionTenant = async (
  instanceId: string,
  clientId: string,
  authRealm?: string
): Promise<{
  readonly instanceId: string;
  readonly clientId: string;
  readonly client: KeycloakAdminClient;
} | null> => {
  const resolvedAuthRealm = authRealm ?? (await loadInstanceById(instanceId))?.authRealm;
  if (!resolvedAuthRealm) return null;

  return {
    instanceId,
    clientId,
    client: new KeycloakAdminClient(getKeycloakProvisionerClientConfigFromEnv(resolvedAuthRealm)),
  };
};
