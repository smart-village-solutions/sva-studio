import {
  isKeycloakIdentityProvider,
  resolveIdentityProviderForInstance,
} from './iam-account-management/shared-runtime.js';

export const resolveInstanceKeycloakProjectionTenant = async (
  instanceId: string,
  clientId: string
) => {
  const resolution = await resolveIdentityProviderForInstance(instanceId);
  if (!resolution || !isKeycloakIdentityProvider(resolution.provider)) return null;

  return {
    instanceId,
    clientId,
    client: resolution.provider,
  };
};
