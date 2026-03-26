import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getAuthConfig } from './config';

const originalEnv = { ...process.env };

describe('getAuthConfig', () => {
  beforeEach(() => {
    process.env.SVA_AUTH_ISSUER = 'https://issuer.example.com';
    process.env.SVA_AUTH_CLIENT_ID = 'client-id';
    process.env.SVA_AUTH_CLIENT_SECRET = 'client-secret';
    process.env.SVA_AUTH_REDIRECT_URI = 'https://app.example.com/auth/callback';
    process.env.SVA_AUTH_POST_LOGOUT_REDIRECT_URI = 'https://app.example.com/logout';
    delete process.env.SVA_AUTH_STATE_SECRET;
    delete process.env.SVA_AUTH_SCOPES;
    delete process.env.SVA_AUTH_SESSION_COOKIE;
    delete process.env.SVA_AUTH_LOGIN_STATE_COOKIE;
    delete process.env.SVA_AUTH_SESSION_TTL_MS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('builds the config with defaults derived from required environment variables', () => {
    expect(getAuthConfig()).toEqual({
      issuer: 'https://issuer.example.com',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      loginStateSecret: 'client-secret',
      redirectUri: 'https://app.example.com/auth/callback',
      postLogoutRedirectUri: 'https://app.example.com/logout',
      scopes: 'openid',
      sessionCookieName: 'sva_auth_session',
      loginStateCookieName: 'sva_auth_state',
      sessionTtlMs: 60 * 60 * 1000,
    });
  });

  it('uses explicit optional overrides when configured', () => {
    process.env.SVA_AUTH_STATE_SECRET = 'separate-state-secret';
    process.env.SVA_AUTH_SCOPES = 'openid profile offline_access';
    process.env.SVA_AUTH_SESSION_COOKIE = 'custom-session';
    process.env.SVA_AUTH_LOGIN_STATE_COOKIE = 'custom-state';
    process.env.SVA_AUTH_SESSION_TTL_MS = '900000';

    expect(getAuthConfig()).toEqual(
      expect.objectContaining({
        loginStateSecret: 'separate-state-secret',
        scopes: 'openid profile offline_access',
        sessionCookieName: 'custom-session',
        loginStateCookieName: 'custom-state',
        sessionTtlMs: 900000,
      })
    );
  });

  it('falls back to the default TTL when the configured TTL is invalid', () => {
    process.env.SVA_AUTH_SESSION_TTL_MS = 'not-a-number';

    expect(getAuthConfig().sessionTtlMs).toBe(60 * 60 * 1000);
  });

  it('throws when required environment variables are missing', () => {
    delete process.env.SVA_AUTH_CLIENT_SECRET;

    expect(() => getAuthConfig()).toThrow(
      'Missing auth client secret (SVA_AUTH_CLIENT_SECRET or /run/secrets/sva_studio_app_auth_client_secret)'
    );
  });
});
