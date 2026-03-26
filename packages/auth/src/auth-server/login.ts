import { getAuthConfig } from '../config.js';
import { client, getOidcConfig } from '../oidc.server.js';
import { createLoginState } from '../redis-session.server.js';

export const createLoginUrl = async (input?: { returnTo?: string; silent?: boolean }) => {
  const authConfig = getAuthConfig();
  const config = await getOidcConfig();
  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();
  const nonce = client.randomNonce();
  const createdAt = Date.now();
  const loginState = {
    codeVerifier,
    nonce,
    createdAt,
    returnTo: input?.returnTo,
    silent: input?.silent ?? false,
  };

  await createLoginState(state, loginState);

  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: authConfig.redirectUri,
    scope: authConfig.scopes,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    nonce,
    ...(input?.silent ? { prompt: 'none' } : {}),
  });

  return { url: url.href, state, loginState };
};
