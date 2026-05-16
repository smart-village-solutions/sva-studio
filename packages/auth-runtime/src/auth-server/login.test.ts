import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createLoginState: vi.fn(),
  getOidcConfig: vi.fn(async () => ({ issuer: 'https://issuer.example/realms/test' })),
  getScopeFromAuthConfig: vi.fn(() => ({ kind: 'platform' })),
  buildAuthorizationUrl: vi.fn(() => new URL('https://issuer.example/protocol/openid-connect/auth')),
}));

vi.mock('../config.js', () => ({
  getAuthConfig: vi.fn(() => ({
    kind: 'platform',
    issuer: 'https://issuer.example/realms/test',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    loginStateSecret: 'state-secret',
    redirectUri: 'https://studio.example/auth/callback',
    postLogoutRedirectUri: 'https://studio.example',
    scopes: 'openid profile',
    sessionCookieName: 'session-cookie',
    loginStateCookieName: 'login-state-cookie',
    silentSsoSuppressCookieName: 'silent-cookie',
    sessionTtlMs: 3_600_000,
    sessionRedisTtlBufferMs: 60_000,
    freshReauthWindowMs: 600_000,
    silentSsoSuppressAfterLogoutMs: 30_000,
  })),
}));

vi.mock('../oidc.js', () => ({
  client: {
    randomPKCECodeVerifier: vi.fn(() => 'verifier-1'),
    calculatePKCECodeChallenge: vi.fn(async () => 'challenge-1'),
    randomState: vi.fn(() => 'state-1'),
    randomNonce: vi.fn(() => 'nonce-1'),
    buildAuthorizationUrl: mocks.buildAuthorizationUrl,
  },
  getOidcConfig: mocks.getOidcConfig,
}));

vi.mock('../redis-session.js', () => ({
  createLoginState: mocks.createLoginState,
}));

vi.mock('../scope.js', () => ({
  getScopeFromAuthConfig: mocks.getScopeFromAuthConfig,
}));

describe('createLoginUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests explicit IdP reauthentication only when the login flow asks for fresh reauth', async () => {
    const { createLoginUrl } = await import('./login.js');

    const result = await createLoginUrl({ returnTo: '/admin/instances', reauth: true });

    expect(result.loginState.freshReauthRequested).toBe(true);
    expect(mocks.createLoginState).toHaveBeenCalledWith('state-1', expect.objectContaining({ freshReauthRequested: true }));
    expect(mocks.buildAuthorizationUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        prompt: 'login',
        max_age: '0',
      })
    );
  });

  it('keeps silent logins free from fresh reauth requests', async () => {
    const { createLoginUrl } = await import('./login.js');

    const result = await createLoginUrl({ silent: true, reauth: true });

    expect(result.loginState.freshReauthRequested).toBe(false);
    expect(mocks.buildAuthorizationUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        prompt: 'none',
      })
    );
  });
});
