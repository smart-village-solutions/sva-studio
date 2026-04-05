import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Session } from './types';

const authState = vi.hoisted(() => ({
  consumeLoginStateMock: vi.fn(),
  createLoginStateMock: vi.fn(),
  createSessionMock: vi.fn(),
  getSessionMock: vi.fn<(_sessionId: string) => Promise<Session | undefined>>(),
  getSessionControlStateMock: vi.fn(),
  updateSessionMock: vi.fn(),
  deleteSessionMock: vi.fn(),
  refreshTokenGrantMock: vi.fn(),
  getOidcConfigMock: vi.fn(),
  invalidateOidcConfigMock: vi.fn(),
  authorizationCodeGrantMock: vi.fn(),
  buildAuthorizationUrlMock: vi.fn(),
  buildEndSessionUrlMock: vi.fn(),
  jitProvisionAccountMock: vi.fn(),
  getAuthConfigMock: vi.fn(),
  resolveAuthConfigFromSessionAuthMock: vi.fn(),
}));

const {
  consumeLoginStateMock,
  createLoginStateMock,
  createSessionMock,
  getSessionMock,
  getSessionControlStateMock,
  updateSessionMock,
  deleteSessionMock,
  refreshTokenGrantMock,
  getOidcConfigMock,
  invalidateOidcConfigMock,
  authorizationCodeGrantMock,
  buildAuthorizationUrlMock,
  buildEndSessionUrlMock,
  jitProvisionAccountMock,
  getAuthConfigMock,
  resolveAuthConfigFromSessionAuthMock,
} = authState;

vi.mock('./config', () => ({
  getAuthConfig: getAuthConfigMock,
  resolveAuthConfigFromSessionAuth: resolveAuthConfigFromSessionAuthMock,
}));

vi.mock('./redis-session.server', () => ({
  consumeLoginState: consumeLoginStateMock,
  createLoginState: createLoginStateMock,
  createSession: createSessionMock,
  deleteSession: deleteSessionMock,
  getSession: getSessionMock,
  getSessionControlState: getSessionControlStateMock,
  updateSession: updateSessionMock,
}));

vi.mock('./oidc.server', () => ({
  getOidcConfig: getOidcConfigMock,
  invalidateOidcConfig: invalidateOidcConfigMock,
  client: {
    randomPKCECodeVerifier: vi.fn(() => 'verifier-1'),
    calculatePKCECodeChallenge: vi.fn(async () => 'challenge-1'),
    randomState: vi.fn(() => 'state-1'),
    randomNonce: vi.fn(() => 'nonce-1'),
    buildAuthorizationUrl: buildAuthorizationUrlMock,
    authorizationCodeGrant: authorizationCodeGrantMock,
    refreshTokenGrant: refreshTokenGrantMock,
    buildEndSessionUrl: buildEndSessionUrlMock,
  },
}));

vi.mock('./jit-provisioning.server', () => ({
  jitProvisionAccount: jitProvisionAccountMock,
}));

const resolveInstanceIdMock = vi.fn();
const loadInstanceByIdMock = vi.fn();

vi.mock('./shared/instance-id-resolution', () => ({
  resolveInstanceId: resolveInstanceIdMock,
}));

vi.mock('./shared/db-helpers', () => ({
  createPoolResolver: () => () => null,
}));

vi.mock('@sva/data/server', () => ({
  loadInstanceById: loadInstanceByIdMock,
}));

describe('getSessionUser', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getAuthConfigMock.mockReturnValue({
      issuer: 'https://issuer.example',
      clientId: 'sva-client',
      clientSecret: 'secret',
      loginStateSecret: 'state-secret',
      redirectUri: 'http://localhost:3000/auth/callback',
      postLogoutRedirectUri: 'http://localhost:3000',
      scopes: 'openid',
      sessionCookieName: 'sva_auth_session',
      loginStateCookieName: 'sva_auth_state',
      silentSsoSuppressCookieName: 'sva_auth_silent_sso',
      sessionTtlMs: 60_000,
      sessionRedisTtlBufferMs: 5_000,
      silentSsoSuppressAfterLogoutMs: 60_000,
    });
    resolveAuthConfigFromSessionAuthMock.mockImplementation((auth) => ({
      clientSecret: 'secret',
      loginStateSecret: 'state-secret',
      scopes: 'openid',
      sessionCookieName: 'sva_auth_session',
      loginStateCookieName: 'sva_auth_state',
      silentSsoSuppressCookieName: 'sva_auth_silent_sso',
      sessionTtlMs: 60_000,
      sessionRedisTtlBufferMs: 5_000,
      silentSsoSuppressAfterLogoutMs: 60_000,
      ...auth,
    }));
    getOidcConfigMock.mockResolvedValue({ issuer: 'https://issuer.example' });
    invalidateOidcConfigMock.mockReset();
    buildAuthorizationUrlMock.mockReturnValue(new URL('https://issuer.example/auth?state=state-1'));
    buildEndSessionUrlMock.mockReturnValue(new URL('https://issuer.example/logout'));
    jitProvisionAccountMock.mockResolvedValue({ skipped: false, accountId: 'acc-1', created: true });
    getSessionControlStateMock.mockResolvedValue(undefined);
  });

  const createUnsignedJwt = (claims: Record<string, unknown>) => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return `${header}.${payload}.signature`;
  };

  it('returns existing user without refresh when token is still valid', async () => {
    const now = Date.now();
    getSessionMock.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      user: {
        id: 'user-1',
        instanceId: 'de-musterhausen',
        roles: ['admin'],
      },
      refreshToken: 'refresh-token',
      expiresAt: now + 5 * 60_000,
      createdAt: now,
    } satisfies Session);

    const { getSessionUser } = await import('./auth.server');
    const user = await getSessionUser('session-1');

    expect(user).toEqual({
      id: 'user-1',
      instanceId: 'de-musterhausen',
      roles: ['admin'],
    });
    expect(refreshTokenGrantMock).not.toHaveBeenCalled();
    expect(getOidcConfigMock).not.toHaveBeenCalled();
    expect(updateSessionMock).not.toHaveBeenCalled();
    expect(deleteSessionMock).not.toHaveBeenCalled();
  });

  it('hydrates a stale session user from the stored access token when instanceId is missing', async () => {
    const now = Date.now();
    const accessToken = createUnsignedJwt({
      sub: 'user-legacy-1',
      preferred_username: 'Legacy User',
      email: 'legacy@example.com',
      instanceId: 'de-musterhausen',
      realm_access: { roles: ['Admin'] },
    });

    getSessionMock.mockResolvedValue({
      id: 'session-legacy-1',
      userId: 'user-legacy-1',
      user: {
        id: 'user-legacy-1',
        roles: [],
      },
      accessToken,
      refreshToken: 'refresh-token-legacy',
      expiresAt: now + 5 * 60_000,
      createdAt: now,
    } satisfies Session);

    const { getSessionUser } = await import('./auth.server');
    const user = await getSessionUser('session-legacy-1');

    expect(user).toEqual({
      id: 'user-legacy-1',
      instanceId: 'de-musterhausen',
      roles: ['Admin', 'system_admin'],
      username: 'Legacy User',
      email: 'legacy@example.com',
      firstName: undefined,
      lastName: undefined,
      displayName: 'Legacy User',
    });
    expect(updateSessionMock).toHaveBeenCalledWith(
      'session-legacy-1',
      expect.objectContaining({
        user: expect.objectContaining({
          id: 'user-legacy-1',
          instanceId: 'de-musterhausen',
        }),
      })
    );
    expect(refreshTokenGrantMock).not.toHaveBeenCalled();
  });

  it('refreshes token and returns updated session user when token is expiring', async () => {
    const now = Date.now();
    const expiredSession: Session = {
      id: 'session-2',
      userId: 'user-old',
      user: {
        id: 'user-old',
        roles: ['viewer'],
      },
      refreshToken: 'refresh-token-2',
      expiresAt: now - 5_000,
      createdAt: now - 60_000,
    };

    const refreshedClaims = {
      sub: 'user-2',
      preferred_username: 'Neuer Nutzer',
      email: 'new@example.com',
      instanceId: 'de-musterhausen',
      roles: ['Admin'],
    };
    const refreshedAccessToken = createUnsignedJwt(refreshedClaims);

    getSessionMock
      .mockResolvedValueOnce(expiredSession)
      .mockResolvedValueOnce({
        ...expiredSession,
        user: {
          id: 'user-2',
          instanceId: 'de-musterhausen',
          roles: ['Admin', 'system_admin'],
        },
      });

    getOidcConfigMock.mockResolvedValue({ issuer: 'https://issuer.example' });
    refreshTokenGrantMock.mockResolvedValue({
      access_token: refreshedAccessToken,
      refresh_token: 'refresh-token-2b',
      id_token: 'id-token-2',
      claims: () => refreshedClaims,
      expiresIn: () => 3600,
    });

    const { getSessionUser } = await import('./auth.server');
    const user = await getSessionUser('session-2');

    expect(getOidcConfigMock).toHaveBeenCalledTimes(1);
    expect(refreshTokenGrantMock).toHaveBeenCalledTimes(1);
    expect(updateSessionMock).toHaveBeenCalledTimes(1);
    expect(updateSessionMock).toHaveBeenCalledWith(
      'session-2',
      expect.objectContaining({
        accessToken: refreshedAccessToken,
        refreshToken: 'refresh-token-2b',
      })
    );
    expect(user).toEqual({
      id: 'user-2',
      instanceId: 'de-musterhausen',
      roles: ['Admin', 'system_admin'],
    });
    expect(deleteSessionMock).not.toHaveBeenCalled();
  });

  it('deletes session when refresh fails and session is expired', async () => {
    const now = Date.now();
    getSessionMock.mockResolvedValue({
      id: 'session-3',
      userId: 'user-3',
      user: {
        id: 'user-3',
        roles: ['viewer'],
      },
      refreshToken: 'refresh-token-3',
      expiresAt: now - 10_000,
      createdAt: now - 60_000,
    } satisfies Session);

    getOidcConfigMock.mockResolvedValue({ issuer: 'https://issuer.example' });
    refreshTokenGrantMock.mockRejectedValue(new Error('refresh failed'));

    const { getSessionUser } = await import('./auth.server');
    const user = await getSessionUser('session-3');

    expect(getOidcConfigMock).toHaveBeenCalledTimes(1);
    expect(refreshTokenGrantMock).toHaveBeenCalledTimes(1);
    expect(deleteSessionMock).toHaveBeenCalledWith('session-3');
    expect(user).toBeNull();
  });

  it('deletes session without refresh token when expired', async () => {
    const now = Date.now();
    getSessionMock.mockResolvedValue({
      id: 'session-4',
      userId: 'user-4',
      user: {
        id: 'user-4',
        name: 'No Refresh',
        roles: ['viewer'],
      },
      expiresAt: now - 30_000,
      createdAt: now - 60_000,
    } satisfies Session);

    const { getSessionUser } = await import('./auth.server');
    const user = await getSessionUser('session-4');

    expect(user).toBeNull();
    expect(deleteSessionMock).toHaveBeenCalledWith('session-4');
    expect(refreshTokenGrantMock).not.toHaveBeenCalled();
  });

  it('createLoginUrl persists PKCE login state and returns redirect url', async () => {
    const { createLoginUrl } = await import('./auth.server');

    const result = await createLoginUrl();

    expect(result.state).toBe('state-1');
    expect(result.url).toContain('https://issuer.example/auth');
    expect(createLoginStateMock).toHaveBeenCalledWith(
      'state-1',
      expect.objectContaining({
        codeVerifier: 'verifier-1',
        nonce: 'nonce-1',
        silent: false,
      })
    );
  });

  it('createLoginUrl persists a silent login state and requests prompt none', async () => {
    const { createLoginUrl } = await import('./auth.server');

    await createLoginUrl({ returnTo: '/', silent: true });

    expect(createLoginStateMock).toHaveBeenCalledWith(
      'state-1',
      expect.objectContaining({
        returnTo: '/',
        silent: true,
      })
    );
    expect(buildAuthorizationUrlMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        prompt: 'none',
      })
    );
  });

  it('handleCallback creates session and user from OIDC claims', async () => {
    const accessToken = createUnsignedJwt({
      sub: 'user-cb-1',
      preferred_username: 'Callback User',
      email: 'callback@example.com',
      instanceId: 'de-musterhausen',
      realm_access: { roles: ['Admin'] },
    });

    authorizationCodeGrantMock.mockResolvedValue({
      access_token: accessToken,
      refresh_token: 'refresh-cb',
      id_token: 'id-cb',
      claims: () => ({
        sub: 'user-cb-1',
        preferred_username: 'Callback User',
        email: 'callback@example.com',
        instanceId: 'de-musterhausen',
        realm_access: { roles: ['Admin'] },
      }),
      expiresIn: () => 300,
    });

    const { handleCallback } = await import('./auth.server');
    const result = await handleCallback({
      code: 'code-1',
      state: 'state-1',
      loginState: {
        codeVerifier: 'verifier-1',
        nonce: 'nonce-1',
        createdAt: Date.now(),
      },
    });

    expect(result.user.id).toBe('user-cb-1');
    expect(result.user.roles.sort()).toEqual(['Admin', 'system_admin'].sort());
    expect(createSessionMock).toHaveBeenCalledTimes(1);
    expect(jitProvisionAccountMock).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'user-cb-1',
    });
  });

  it('handleCallback persists string instanceId claims unchanged', async () => {
    const accessToken = createUnsignedJwt({
      sub: 'user-cb-2',
      preferred_username: 'Tenant User',
      email: 'tenant@example.com',
      instanceId: 'tenant-1',
      realm_access: { roles: ['Editor'] },
    });

    authorizationCodeGrantMock.mockResolvedValue({
      access_token: accessToken,
      refresh_token: 'refresh-cb-2',
      id_token: 'id-cb-2',
      claims: () => ({
        sub: 'user-cb-2',
        preferred_username: 'Tenant User',
        email: 'tenant@example.com',
        instanceId: 'tenant-1',
        realm_access: { roles: ['Editor'] },
      }),
      expiresIn: () => 300,
    });

    const { handleCallback } = await import('./auth.server');
    const result = await handleCallback({
      code: 'code-3',
      state: 'state-3',
      loginState: {
        codeVerifier: 'verifier-3',
        nonce: 'nonce-3',
        createdAt: Date.now(),
      },
    });

    expect(result.user.instanceId).toBe('tenant-1');
    expect(resolveInstanceIdMock).not.toHaveBeenCalled();
    expect(createSessionMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        user: expect.objectContaining({ instanceId: 'tenant-1' }),
      }),
    );
  });

  it('handleCallback throws for invalid login state', async () => {
    consumeLoginStateMock.mockResolvedValue(undefined);

    const { handleCallback } = await import('./auth.server');

    await expect(handleCallback({ code: 'code-2', state: 'state-missing' })).rejects.toThrow(
      'Invalid login state'
    );
  });

  it('handleCallback invalidates the cached OIDC config and retries token exchange once', async () => {
    const accessToken = createUnsignedJwt({
      sub: 'user-cb-retry',
      preferred_username: 'Retry User',
      email: 'retry@example.com',
      instanceId: 'bb-guben',
      realm_access: { roles: ['Admin'] },
    });

    authorizationCodeGrantMock
      .mockRejectedValueOnce({
        name: 'ResponseBodyError',
        error: 'invalid_client',
        error_description: 'Secret changed',
      })
      .mockResolvedValueOnce({
        access_token: accessToken,
        refresh_token: 'refresh-cb-retry',
        id_token: 'id-cb-retry',
        claims: () => ({
          sub: 'user-cb-retry',
          preferred_username: 'Retry User',
          email: 'retry@example.com',
          instanceId: 'bb-guben',
          realm_access: { roles: ['Admin'] },
        }),
        expiresIn: () => 300,
      });

    const { handleCallback } = await import('./auth.server');
    const result = await handleCallback({
      code: 'code-retry',
      state: 'state-retry',
      authConfig: {
        issuer: 'https://issuer.example/realms/bb-guben',
        clientId: 'sva-studio',
        clientSecret: 'tenant-secret',
        loginStateSecret: 'state-secret',
        redirectUri: 'https://bb-guben.studio.example.org/auth/callback',
        postLogoutRedirectUri: 'https://bb-guben.studio.example.org/',
        scopes: 'openid',
        sessionCookieName: 'sva_auth_session',
        loginStateCookieName: 'sva_auth_state',
        silentSsoSuppressCookieName: 'sva_auth_silent_sso',
        sessionTtlMs: 60_000,
        sessionRedisTtlBufferMs: 5_000,
        silentSsoSuppressAfterLogoutMs: 60_000,
        instanceId: 'bb-guben',
        authRealm: 'bb-guben',
      },
      loginState: {
        codeVerifier: 'verifier-retry',
        nonce: 'nonce-retry',
        createdAt: Date.now(),
      },
    });

    expect(result.user.instanceId).toBe('bb-guben');
    expect(invalidateOidcConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({
        issuer: 'https://issuer.example/realms/bb-guben',
        clientId: 'sva-studio',
      }),
    );
    expect(authorizationCodeGrantMock).toHaveBeenCalledTimes(2);
  });

  it('handleCallback does not retry non-secret token exchange failures', async () => {
    authorizationCodeGrantMock.mockRejectedValueOnce({
      name: 'ResponseBodyError',
      error: 'invalid_grant',
      error_description: 'Code already used',
      status: 400,
    });

    const { handleCallback } = await import('./auth.server');

    await expect(
      handleCallback({
        code: 'code-invalid-grant',
        state: 'state-invalid-grant',
        authConfig: {
          issuer: 'https://issuer.example/realms/bb-guben',
          clientId: 'sva-studio',
          clientSecret: 'tenant-secret',
          loginStateSecret: 'state-secret',
          redirectUri: 'https://bb-guben.studio.example.org/auth/callback',
          postLogoutRedirectUri: 'https://bb-guben.studio.example.org/',
          scopes: 'openid',
          sessionCookieName: 'sva_auth_session',
          loginStateCookieName: 'sva_auth_state',
          silentSsoSuppressCookieName: 'sva_auth_silent_sso',
          sessionTtlMs: 60_000,
          sessionRedisTtlBufferMs: 5_000,
          silentSsoSuppressAfterLogoutMs: 60_000,
          instanceId: 'bb-guben',
          authRealm: 'bb-guben',
        },
        loginState: {
          codeVerifier: 'verifier-no-retry',
          nonce: 'nonce-no-retry',
          createdAt: Date.now(),
        },
      }),
    ).rejects.toMatchObject({
      error: 'invalid_grant',
    });

    expect(invalidateOidcConfigMock).not.toHaveBeenCalled();
    expect(authorizationCodeGrantMock).toHaveBeenCalledTimes(1);
  });

  it('logoutSession falls back to post logout redirect without id token', async () => {
    getSessionMock.mockResolvedValue({
      id: 'session-logout-1',
      userId: 'user-1',
      user: { id: 'user-1', name: 'User', roles: [] },
      createdAt: Date.now(),
    } satisfies Session);

    const { logoutSession } = await import('./auth.server');
    const url = await logoutSession('session-logout-1');

    expect(url).toBe('http://localhost:3000');
    expect(deleteSessionMock).toHaveBeenCalledWith('session-logout-1');
  });

  it('logoutSession returns end session url when id token is present', async () => {
    getSessionMock.mockResolvedValue({
      id: 'session-logout-2',
      userId: 'user-2',
      user: { id: 'user-2', name: 'User 2', roles: [] },
      idToken: 'id-token-logout',
      createdAt: Date.now(),
    } satisfies Session);

    const { logoutSession } = await import('./auth.server');
    const url = await logoutSession('session-logout-2');

    expect(url).toBe('https://issuer.example/logout');
    expect(buildEndSessionUrlMock).toHaveBeenCalledTimes(1);
    expect(deleteSessionMock).toHaveBeenCalledWith('session-logout-2');
  });

  it('logoutSession resolves auth config from the stored session context without global env config', async () => {
    getAuthConfigMock.mockImplementation(() => {
      throw new Error('Missing required env: SVA_AUTH_ISSUER');
    });
    getSessionMock.mockResolvedValue({
      id: 'session-logout-3',
      userId: 'user-3',
      user: { id: 'user-3', roles: [] },
      auth: {
        issuer: 'https://issuer.example/realms/bb-guben',
        clientId: 'tenant-client',
        postLogoutRedirectUri: 'https://bb-guben.studio.smart-village.app/',
        instanceId: 'bb-guben',
        authRealm: 'bb-guben',
      },
      createdAt: Date.now(),
    } satisfies Session);

    const { logoutSession } = await import('./auth.server');
    const url = await logoutSession('session-logout-3');

    expect(url).toBe('https://bb-guben.studio.smart-village.app/');
    expect(resolveAuthConfigFromSessionAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'bb-guben',
        authRealm: 'bb-guben',
      })
    );
  });
});
