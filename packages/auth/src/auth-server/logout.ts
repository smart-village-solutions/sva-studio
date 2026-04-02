import { getAuthConfig, resolveAuthConfigFromSessionAuth } from '../config.js';
import { client, getOidcConfig } from '../oidc.server.js';
import { deleteSession, getSession } from '../redis-session.server.js';
import type { AuthConfig } from '../types.js';

export const logoutSession = async (sessionId: string, authConfigOverride?: AuthConfig): Promise<string> => {
  const session = await getSession(sessionId);
  const authConfig = authConfigOverride
    ?? (session?.auth ? resolveAuthConfigFromSessionAuth(session.auth) : getAuthConfig());
  const config = await getOidcConfig(authConfig);

  await deleteSession(sessionId);

  if (!session?.idToken) {
    return authConfig.postLogoutRedirectUri;
  }

  const endSessionUrl = client.buildEndSessionUrl(config, {
    id_token_hint: session.idToken,
    post_logout_redirect_uri: authConfig.postLogoutRedirectUri,
  });

  return endSessionUrl?.href ?? authConfig.postLogoutRedirectUri;
};
