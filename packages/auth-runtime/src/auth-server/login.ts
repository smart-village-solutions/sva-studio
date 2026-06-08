import { getAuthConfig } from '../config.js';
import { client, getOidcConfig } from '../oidc.js';
import { createLoginState } from '../redis-session.js';
import { getScopeFromAuthConfig } from '../scope.js';
import type { AuthConfig } from '../types.js';

const mapKeycloakAccountActionToIntent = (
  kcAction: 'UPDATE_PASSWORD' | 'UPDATE_EMAIL' | undefined
): 'update-password' | 'update-email' | undefined => {
  if (kcAction === 'UPDATE_PASSWORD') {
    return 'update-password';
  }

  if (kcAction === 'UPDATE_EMAIL') {
    return 'update-email';
  }

  return undefined;
};

export const createLoginUrl = async (input?: {
  returnTo?: string;
  silent?: boolean;
  reauth?: boolean;
  kcAction?: 'UPDATE_PASSWORD' | 'UPDATE_EMAIL';
  authConfig?: AuthConfig;
}) => {
  const authConfig = input?.authConfig ?? getAuthConfig();
  const config = await getOidcConfig(authConfig);
  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();
  const nonce = client.randomNonce();
  const createdAt = Date.now();
  const freshReauthRequested = input?.silent === true ? false : input?.reauth === true;
  const loginState = {
    codeVerifier,
    nonce,
    createdAt,
    returnTo: input?.returnTo,
    silent: input?.silent ?? false,
    freshReauthRequested,
    accountActionIntent: mapKeycloakAccountActionToIntent(input?.kcAction),
    ...getScopeFromAuthConfig(authConfig),
  };

  await createLoginState(state, loginState);

  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: authConfig.redirectUri,
    scope: authConfig.scopes,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    nonce,
    ...(input?.kcAction ? { kc_action: input.kcAction } : {}),
    ...(input?.silent ? { prompt: 'none' } : {}),
    ...(freshReauthRequested ? { prompt: 'login', max_age: '0' } : {}),
  });

  return { url: url.href, state, loginState };
};
