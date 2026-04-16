import { getAuthConfig, resolveAuthConfigFromSessionAuth } from '../config.js';
import { client, getOidcConfig } from '../oidc.server.js';
import { deleteSession, getSession } from '../redis-session.server.js';
import type { AuthConfig } from '../types.js';

export const buildLogoutUrl = async (authConfigOverride?: AuthConfig, idTokenHint?: string): Promise<string> => {
  const authConfig = authConfigOverride ?? getAuthConfig();
  const config = await getOidcConfig(authConfig);
  const parameters: Record<string, string> = {
    post_logout_redirect_uri: authConfig.postLogoutRedirectUri,
  };

  if (idTokenHint) {
    parameters.id_token_hint = idTokenHint;
  }

  const endSessionUrl = client.buildEndSessionUrl(config, parameters);
  return endSessionUrl?.href ?? authConfig.postLogoutRedirectUri;
};

export const logoutSession = async (sessionId: string, authConfigOverride?: AuthConfig): Promise<string> => {
  const session = await getSession(sessionId);
  const authConfig = authConfigOverride
    ?? (session?.auth ? resolveAuthConfigFromSessionAuth(session.auth) : getAuthConfig());

  await deleteSession(sessionId);

  return buildLogoutUrl(authConfig, session?.idToken);
};
