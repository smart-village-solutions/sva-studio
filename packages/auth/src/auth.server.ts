// Server-side OIDC helpers for login, session management, and logout flows.
import { randomUUID } from 'node:crypto';

import { getAuthConfig } from './config';
import { client, getOidcConfig } from './oidc.server';
import {
  clearExpiredLoginStates,
  clearExpiredSessions,
  consumeLoginState,
  createLoginState,
  createSession,
  deleteSession,
  getSession,
  updateSession,
} from './session';
import type { LoginState, SessionUser } from './types';

/**
 * Resolve a display name from standard OIDC claims with fallbacks.
 */
const resolveUserName = (claims: Record<string, unknown>) => {
  const name = claims.name;
  if (typeof name === 'string' && name.trim()) {
    return name;
  }
  const preferredUsername = claims.preferred_username;
  if (typeof preferredUsername === 'string' && preferredUsername.trim()) {
    return preferredUsername;
  }
  const givenName = claims.given_name;
  const familyName = claims.family_name;
  if (typeof givenName === 'string' && typeof familyName === 'string') {
    return `${givenName} ${familyName}`.trim();
  }
  return 'Unbekannt';
};

/**
 * Decode a JWT payload without verifying the signature.
 */
const parseJwtPayload = (token: string): Record<string, unknown> | null => {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }
  const payload = parts[1];
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  try {
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const data = JSON.parse(json);
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

type AccessRoles = {
  roles?: unknown;
};

/**
 * Normalize a roles array and filter non-string values.
 */
const readRoles = (value: unknown) =>
  Array.isArray(value) ? value.filter((role): role is string => typeof role === 'string') : [];

/**
 * Extract role strings from a realm/resource access object.
 */
const readAccessRoles = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return [];
  }
  return readRoles((value as AccessRoles).roles);
};

/**
 * Collect roles from access claims, optionally scoped to a client.
 */
const extractRoles = (claims: Record<string, unknown>, clientId?: string) => {
  const roles = new Set<string>();
  for (const role of readRoles(claims.roles)) {
    roles.add(role);
  }
  for (const role of readAccessRoles(claims.realm_access)) {
    roles.add(role);
  }
  const resourceAccess = claims.resource_access;
  if (resourceAccess && typeof resourceAccess === 'object') {
    const accessEntries = resourceAccess as Record<string, unknown>;
    if (clientId && accessEntries[clientId]) {
      for (const role of readAccessRoles(accessEntries[clientId])) {
        roles.add(role);
      }
    } else {
      for (const entry of Object.values(accessEntries)) {
        for (const role of readAccessRoles(entry)) {
          roles.add(role);
        }
      }
    }
  }
  return [...roles];
};

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
  createLoginState(state, loginState);

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

  clearExpiredLoginStates(Date.now(), 10 * 60 * 1000);

  const loginState = params.loginState ?? consumeLoginState(params.state);
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
    roles: extractRoles(roleClaims, authConfig.clientId),
  };

  const sessionId = randomUUID();
  const now = Date.now();
  const expiresAt = tokenSet.expiresIn() ? now + tokenSet.expiresIn()! * 1000 : undefined;

  createSession({
    id: sessionId,
    user,
    accessToken: tokenSet.access_token,
    refreshToken: tokenSet.refresh_token,
    idToken: tokenSet.id_token,
    expiresAt,
    createdAt: now,
  });

  clearExpiredSessions(now, authConfig.sessionTtlMs);

  return { sessionId, user };
};

/**
 * Resolves the session user, refreshing tokens when possible.
 */
export const getSessionUser = async (sessionId: string) => {
  const authConfig = getAuthConfig();
  const session = getSession(sessionId);
  if (!session) {
    return null;
  }

  const now = Date.now();
  if (session.refreshToken) {
    try {
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
        roles: extractRoles(roleClaims, authConfig.clientId),
      };
      updateSession(sessionId, {
        user: updatedUser,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token ?? session.refreshToken,
        idToken: refreshed.id_token ?? session.idToken,
        expiresAt: refreshed.expiresIn() ? now + refreshed.expiresIn()! * 1000 : session.expiresAt,
      });
    } catch (error) {
      console.error('Auth refresh error:', error);
      if (session.expiresAt && session.expiresAt < now) {
        deleteSession(sessionId);
        return null;
      }
    }
  } else if (session.expiresAt && session.expiresAt < now) {
    deleteSession(sessionId);
    return null;
  }

  clearExpiredSessions(now, authConfig.sessionTtlMs);
  return getSession(sessionId)?.user ?? null;
};

/**
 * Ends the session locally and returns the logout redirect URL.
 */
export const logoutSession = async (sessionId: string): Promise<string> => {
  const authConfig = getAuthConfig();
  const config = await getOidcConfig();
  const session = getSession(sessionId);
  deleteSession(sessionId);

  if (!session?.idToken) {
    return authConfig.postLogoutRedirectUri;
  }

  const endSessionUrl = client.buildEndSessionUrl(config, {
    id_token_hint: session.idToken,
    post_logout_redirect_uri: authConfig.postLogoutRedirectUri,
  });

  return endSessionUrl?.href ?? authConfig.postLogoutRedirectUri;
};
