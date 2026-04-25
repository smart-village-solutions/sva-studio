import { afterEach, describe, expect, it, vi } from 'vitest';

import { getAuthConfig, resolveAuthConfigFromSessionAuth, resolveBaseAuthConfig } from './config.js';

describe('auth runtime config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds base auth config from env with numeric fallbacks', () => {
    vi.stubEnv('SVA_AUTH_CLIENT_SECRET', 'client-secret');
    vi.stubEnv('SVA_AUTH_STATE_SECRET', 'state-secret');
    vi.stubEnv('SVA_AUTH_SCOPES', 'openid profile');
    vi.stubEnv('SVA_AUTH_SESSION_COOKIE', 'session-cookie');
    vi.stubEnv('SVA_AUTH_LOGIN_STATE_COOKIE', 'state-cookie');
    vi.stubEnv('SVA_AUTH_SESSION_TTL_MS', '9000');
    vi.stubEnv('SVA_AUTH_SESSION_REDIS_TTL_BUFFER_MS', 'not-a-number');

    expect(resolveBaseAuthConfig()).toMatchObject({
      clientSecret: 'client-secret',
      loginStateSecret: 'state-secret',
      scopes: 'openid profile',
      sessionCookieName: 'session-cookie',
      loginStateCookieName: 'state-cookie',
      sessionTtlMs: 9000,
      sessionRedisTtlBufferMs: 300000,
    });
  });

  it('requires a client secret for base config', () => {
    vi.stubEnv('SVA_AUTH_CLIENT_SECRET', '');
    vi.stubEnv('SVA_AUTH_STATE_SECRET', '');
    vi.stubEnv('APP_AUTH_CLIENT_SECRET', '');

    expect(() => resolveBaseAuthConfig()).toThrow('Missing auth client secret');
  });

  it('builds platform auth config from required env values', () => {
    vi.stubEnv('SVA_AUTH_CLIENT_SECRET', 'client-secret');
    vi.stubEnv('SVA_AUTH_ISSUER', 'https://keycloak.example/realms/global');
    vi.stubEnv('SVA_AUTH_CLIENT_ID', 'studio');
    vi.stubEnv('SVA_AUTH_REDIRECT_URI', 'https://app.example/auth/callback');
    vi.stubEnv('SVA_AUTH_POST_LOGOUT_REDIRECT_URI', 'https://app.example/');

    expect(getAuthConfig()).toMatchObject({
      kind: 'platform',
      issuer: 'https://keycloak.example/realms/global',
      clientId: 'studio',
      redirectUri: 'https://app.example/auth/callback',
      postLogoutRedirectUri: 'https://app.example/',
      clientSecret: 'client-secret',
    });
  });

  it('merges session auth context with current base config', () => {
    vi.stubEnv('SVA_AUTH_CLIENT_SECRET', 'client-secret');

    expect(
      resolveAuthConfigFromSessionAuth({
        kind: 'instance',
        instanceId: 'tenant-a',
        authRealm: 'tenant-realm',
        issuer: 'https://keycloak.example/realms/tenant-realm',
        clientId: 'tenant-client',
        redirectUri: 'https://tenant.example/auth/callback',
        postLogoutRedirectUri: 'https://tenant.example/',
      })
    ).toMatchObject({
      kind: 'instance',
      instanceId: 'tenant-a',
      clientSecret: 'client-secret',
      authRealm: 'tenant-realm',
    });
  });
});
