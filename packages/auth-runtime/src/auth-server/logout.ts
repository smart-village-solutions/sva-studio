import {
  getAuthConfig,
  resolveAuthConfigFromSessionAuth,
  type AuthConfig,
} from '@sva/auth/server';

import { client, getOidcConfig } from '../oidc.js';
import { deleteSession, getSession } from '../redis-session.js';

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
