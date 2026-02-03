import type { AuthConfig } from './types';

/**
 * Reads a required environment variable or throws.
 */
const requireEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
};

/**
 * Parses a numeric environment variable with a fallback.
 */
const readNumber = (key: string, fallback: number) => {
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Builds the auth configuration from environment variables.
 */
export const getAuthConfig = (): AuthConfig => {
  return {
    issuer: requireEnv('SVA_AUTH_ISSUER'),
    clientId: requireEnv('SVA_AUTH_CLIENT_ID'),
    clientSecret: requireEnv('SVA_AUTH_CLIENT_SECRET'),
    redirectUri: requireEnv('SVA_AUTH_REDIRECT_URI'),
    postLogoutRedirectUri: requireEnv('SVA_AUTH_POST_LOGOUT_REDIRECT_URI'),
    scopes: process.env.SVA_AUTH_SCOPES ?? 'openid profile email',
    sessionCookieName: process.env.SVA_AUTH_SESSION_COOKIE ?? 'sva_auth_session',
    loginStateCookieName: process.env.SVA_AUTH_LOGIN_STATE_COOKIE ?? 'sva_auth_state',
    sessionTtlMs: readNumber('SVA_AUTH_SESSION_TTL_MS', 60 * 60 * 1000),
  };
};
