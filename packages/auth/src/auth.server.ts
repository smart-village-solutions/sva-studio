// Server-side OIDC helpers for login, session management, and logout flows.
import { randomUUID } from 'node:crypto';
import { extractRoles, parseJwtPayload, resolveInstanceId, resolveUserName } from '@sva/core';
import { createSdkLogger } from '@sva/sdk/server';

import { getAuthConfig } from './config';
import { client, getOidcConfig } from './oidc.server';
import {
  consumeLoginState,
  createLoginState,
  createSession,
  deleteSession,
  getSession,
  updateSession,
} from './redis-session.server';
import type { LoginState, SessionUser } from './types';
import { isTokenErrorLike } from './shared/error-guards';
import { buildLogContext } from './shared/log-context';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });
const TOKEN_REFRESH_SKEW_MS = 60_000;

/**
 * Builds the OIDC authorization URL and stores the login state.
 */
export const createLoginUrl = async () => {
  const authConfig = getAuthConfig();
  const config = await getOidcConfig();

  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();
  const nonce = client.randomNonce();
  const createdAt = Date.now();

  const loginState = { codeVerifier, nonce, createdAt };
  await createLoginState(state, loginState);

  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: authConfig.redirectUri,
    scope: authConfig.scopes,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    nonce,
  });

  return { url: url.href, state, loginState };
};

/**
 * Exchanges the authorization code for tokens and creates a session.
 */
export const handleCallback = async (params: {
  code: string;
  state: string;
  iss?: string | null;
  loginState?: LoginState | null;
}) => {
  const authConfig = getAuthConfig();
  const config = await getOidcConfig();

  const loginState = params.loginState ?? (await consumeLoginState(params.state));
  if (!loginState) {
    throw new Error('Invalid login state');
  }

  const callbackUrl = new URL(authConfig.redirectUri);
  callbackUrl.searchParams.set('code', params.code);
  callbackUrl.searchParams.set('state', params.state);
  if (params.iss) {
    callbackUrl.searchParams.set('iss', params.iss);
  }

  const tokenSet = await client.authorizationCodeGrant(config, callbackUrl, {
    pkceCodeVerifier: loginState.codeVerifier,
    expectedState: params.state,
    expectedNonce: loginState.nonce,
  });

  const tokenClaims = (tokenSet.claims() ?? {}) as Record<string, unknown>;
  const accessTokenClaims = tokenSet.access_token ? parseJwtPayload(tokenSet.access_token) : null;
  const claims = { ...accessTokenClaims, ...tokenClaims };
  const roleClaims = accessTokenClaims ?? tokenClaims;
  const user: SessionUser = {
    id: String(claims.sub ?? ''),
    name: resolveUserName(claims),
    email: typeof claims.email === 'string' ? claims.email : undefined,
    instanceId: resolveInstanceId(claims),
    roles: extractRoles(roleClaims, authConfig.clientId),
  };

  const sessionId = randomUUID();
  const now = Date.now();
  const expiresAt = tokenSet.expiresIn() ? now + tokenSet.expiresIn()! * 1000 : undefined;

  await createSession(sessionId, {
    id: sessionId,
    userId: user.id,
    user,
    accessToken: tokenSet.access_token,
    refreshToken: tokenSet.refresh_token,
    idToken: tokenSet.id_token,
    expiresAt,
    createdAt: now,
  });

  logger.debug('Session created for authenticated user', {
    operation: 'session_create',
    user_id: user.id,
    has_refresh_token: Boolean(tokenSet.refresh_token),
    ...buildLogContext(user.instanceId),
  });

  return { sessionId, user };
};

/**
 * Resolves the session user, refreshing tokens when possible.
 */
export const getSessionUser = async (sessionId: string) => {
  const authConfig = getAuthConfig();
  const session = await getSession(sessionId);
  if (!session) {
    return null;
  }

  const now = Date.now();
  const hasValidUnexpiredToken =
    typeof session.expiresAt !== 'number' || session.expiresAt > now + TOKEN_REFRESH_SKEW_MS;

  if (hasValidUnexpiredToken) {
    return session.user ?? null;
  }

  if (session.refreshToken) {
    try {
      logger.debug('Refreshing access token for session', {
        operation: 'token_refresh',
        has_refresh_token: true,
        ...buildLogContext(session.user?.instanceId),
      });
      const config = await getOidcConfig();
      const refreshed = await client.refreshTokenGrant(config, session.refreshToken);
      const tokenClaims = (refreshed.claims() ?? {}) as Record<string, unknown>;
      const accessTokenClaims = refreshed.access_token
        ? parseJwtPayload(refreshed.access_token)
        : null;
      const claims = { ...accessTokenClaims, ...tokenClaims };
      const roleClaims = accessTokenClaims ?? tokenClaims;
      const updatedUser: SessionUser = {
        id: String(claims.sub ?? ''),
        name: resolveUserName(claims),
        email: typeof claims.email === 'string' ? claims.email : undefined,
        instanceId: resolveInstanceId(claims),
        roles: extractRoles(roleClaims, authConfig.clientId),
      };
      const expiresAt = refreshed.expiresIn()
        ? now + refreshed.expiresIn()! * 1000
        : session.expiresAt;
      await updateSession(sessionId, {
        user: updatedUser,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token ?? session.refreshToken,
        idToken: refreshed.id_token ?? session.idToken,
        expiresAt,
      });
      logger.debug('Token refresh succeeded', {
        operation: 'token_refresh',
        has_refresh_token: true,
        ...buildLogContext(updatedUser.instanceId),
      });
    } catch (error) {
      const workspaceId = session.user?.instanceId;
      if (isTokenErrorLike(error)) {
        logger.warn('Token validation/refresh failed', {
          operation: 'refresh_token',
          error_type: error instanceof Error ? error.constructor.name : typeof error,
          has_refresh_token: Boolean(session.refreshToken),
          session_expired: session.expiresAt && session.expiresAt < now,
          ...buildLogContext(workspaceId),
        });
      } else {
        logger.error('Token refresh failed', {
          operation: 'refresh_token',
          error: error instanceof Error ? error.message : String(error),
          error_type: error instanceof Error ? error.constructor.name : typeof error,
          session_expired: session.expiresAt && session.expiresAt < now,
          ...buildLogContext(workspaceId),
        });
      }
      if (session.expiresAt && session.expiresAt < now) {
        await deleteSession(sessionId);
        return null;
      }

      // Keep the current session user when token is still within grace period.
      return session.user ?? null;
    }
  } else if (session.expiresAt && new Date(session.expiresAt) < new Date(now)) {
    await deleteSession(sessionId);
    return null;
  }

  const updatedSession = await getSession(sessionId);
  return updatedSession?.user ?? null;
};

/**
 * Ends the session locally and returns the logout redirect URL.
 */
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
