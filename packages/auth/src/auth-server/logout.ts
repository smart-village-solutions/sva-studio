import { getAuthConfig } from '../config.js';
import { client, getOidcConfig } from '../oidc.server.js';
import { deleteSession, getSession } from '../redis-session.server.js';

export const logoutSession = async (sessionId: string): Promise<string> => {
  const authConfig = getAuthConfig();
  const config = await getOidcConfig();
  const session = await getSession(sessionId);

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
