import { KeycloakAdminClient, getKeycloakAdminClientConfigFromEnv } from '../keycloak-admin-client.js';

const resolveProtocol = (): string => {
  const baseUrl = process.env.SVA_PUBLIC_BASE_URL;
  if (!baseUrl) {
    return 'https';
  }

  try {
    return new URL(baseUrl).protocol.replace(':', '') || 'https';
  } catch {
    return 'https';
  }
};

export const provisionInstanceAuthArtifacts = async (input: {
  instanceId: string;
  primaryHostname: string;
  authRealm: string;
  authClientId: string;
}): Promise<void> => {
  const client = new KeycloakAdminClient(getKeycloakAdminClientConfigFromEnv(input.authRealm));
  const origin = `${resolveProtocol()}://${input.primaryHostname}`;

  await client.ensureRealm({ displayName: input.instanceId });
  await client.ensureOidcClient({
    clientId: input.authClientId,
    redirectUris: [`${origin}/auth/callback`],
    postLogoutRedirectUris: [`${origin}/`],
    webOrigins: [origin],
    rootUrl: origin,
  });
};
