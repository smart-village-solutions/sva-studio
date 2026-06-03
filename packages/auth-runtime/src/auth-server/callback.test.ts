import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  getAuthConfig: vi.fn(),
  jitProvisionAccount: vi.fn(),
  getOidcConfig: vi.fn(),
  invalidateOidcConfig: vi.fn(),
  authorizationCodeGrant: vi.fn(),
  consumeLoginState: vi.fn(),
  createSession: vi.fn(),
  getSessionControlState: vi.fn(),
  isRetryableTokenExchangeError: vi.fn(),
  getScopeFromAuthConfig: vi.fn(),
  buildSessionUser: vi.fn(),
  resolveSessionExpiry: vi.fn(),
  runPostLoginTasks: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => mocks.logger,
}));

vi.mock('../config.js', () => ({
  getAuthConfig: mocks.getAuthConfig,
}));

vi.mock('../jit-provisioning.js', () => ({
  jitProvisionAccount: mocks.jitProvisionAccount,
}));

vi.mock('./post-login-tasks.js', () => ({
  runPostLoginTasks: mocks.runPostLoginTasks,
}));

vi.mock('../log-context.js', () => ({
  buildLogContext: vi.fn(() => ({ trace_id: 'trace-test' })),
}));

vi.mock('../oidc.js', () => ({
  client: {
    authorizationCodeGrant: mocks.authorizationCodeGrant,
  },
  getOidcConfig: mocks.getOidcConfig,
  invalidateOidcConfig: mocks.invalidateOidcConfig,
}));

vi.mock('../redis-session.js', () => ({
  consumeLoginState: mocks.consumeLoginState,
  createSession: mocks.createSession,
  getSessionControlState: mocks.getSessionControlState,
}));

vi.mock('../error-guards.js', () => ({
  isRetryableTokenExchangeError: mocks.isRetryableTokenExchangeError,
}));

vi.mock('../scope.js', () => ({
  getScopeFromAuthConfig: mocks.getScopeFromAuthConfig,
}));

vi.mock('./shared.js', () => ({
  buildSessionUser: mocks.buildSessionUser,
  resolveSessionExpiry: mocks.resolveSessionExpiry,
}));

const authConfig = {
  kind: 'platform' as const,
  issuer: 'https://issuer.example/realms/test',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  loginStateSecret: 'login-state-secret',
  redirectUri: 'https://studio.example/auth/callback',
  postLogoutRedirectUri: 'https://studio.example',
  scopes: 'openid profile',
  sessionCookieName: 'sva_session',
  loginStateCookieName: 'login_state',
  silentSsoSuppressCookieName: 'silent_sso',
  sessionTtlMs: 3_600_000,
  sessionRedisTtlBufferMs: 60_000,
  silentSsoSuppressAfterLogoutMs: 30_000,
  authRealm: 'test',
};

describe('handleCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    mocks.getAuthConfig.mockReturnValue(authConfig);
    mocks.getOidcConfig.mockResolvedValue({ issuer: authConfig.issuer });
    mocks.getSessionControlState.mockResolvedValue({ minimumSessionVersion: 2 });
    mocks.isRetryableTokenExchangeError.mockReturnValue(false);
    mocks.getScopeFromAuthConfig.mockReturnValue({ kind: 'platform' });
    mocks.resolveSessionExpiry.mockReturnValue(1_717_171_717_000);
    mocks.buildSessionUser.mockReturnValue({
      id: 'kc-user-1',
      instanceId: 'de-test',
      roles: ['iam_admin'],
    });
    mocks.createSession.mockResolvedValue(undefined);
    mocks.jitProvisionAccount.mockResolvedValue(undefined);
    mocks.runPostLoginTasks.mockResolvedValue(undefined);
    mocks.authorizationCodeGrant.mockResolvedValue({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      id_token: 'id-token',
      expiresIn: () => 300,
      claims: () => ({ sub: 'kc-user-1', preferred_username: 'admin' }),
    });
  });

  it('rejects missing login state from the session store', async () => {
    const { handleCallback } = await import('./callback.js');

    mocks.consumeLoginState.mockResolvedValueOnce(null);

    await expect(handleCallback({ code: 'code-1', state: 'state-1', authConfig })).rejects.toThrow(
      'Invalid login state'
    );

    expect(mocks.authorizationCodeGrant).not.toHaveBeenCalled();
  });

  it('rejects new sessions for subjects with a persistent login block', async () => {
    const { handleCallback } = await import('./callback.js');

    mocks.getSessionControlState.mockResolvedValueOnce({
      minimumSessionVersion: 2,
      loginBlocked: true,
      loginBlockedReason: 'account_lifecycle_blocked',
    });

    await expect(
      handleCallback({
        code: 'code-1',
        state: 'state-1',
        authConfig,
        loginState: {
          kind: 'platform',
          codeVerifier: 'verifier',
          nonce: 'nonce',
          createdAt: Date.now(),
        },
      })
    ).rejects.toThrow('Account is blocked from starting new sessions');

    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it('rejects instance login states without an instanceId', async () => {
    const { handleCallback } = await import('./callback.js');

    await expect(
      handleCallback({
        code: 'code-1',
        state: 'state-1',
        authConfig: { ...authConfig, kind: 'instance', instanceId: 'de-test' },
        loginState: {
          kind: 'instance',
          codeVerifier: 'verifier',
          nonce: 'nonce',
          createdAt: Date.now(),
        },
      })
    ).rejects.toThrow('Invalid login state: missing instanceId for instance scope');
  });

  it('rejects login states that do not match the configured scope', async () => {
    const { handleCallback } = await import('./callback.js');

    mocks.getScopeFromAuthConfig.mockReturnValueOnce({ kind: 'instance', instanceId: 'de-test' });

    await expect(
      handleCallback({
        code: 'code-1',
        state: 'state-1',
        authConfig: { ...authConfig, kind: 'instance', instanceId: 'de-test' },
        loginState: {
          kind: 'platform',
          codeVerifier: 'verifier',
          nonce: 'nonce',
          createdAt: Date.now(),
        },
      })
    ).rejects.toThrow('Invalid login state: scope mismatch');
  });

  it('invalidates cached OIDC config and retries the token exchange once', async () => {
    const { handleCallback } = await import('./callback.js');

    const retryableError = new Error('jwks rotation');
    mocks.authorizationCodeGrant
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValueOnce({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        id_token: 'id-token',
        expiresIn: () => 300,
        claims: () => ({ sub: 'kc-user-1' }),
      });
    mocks.isRetryableTokenExchangeError.mockImplementation((error: unknown) => error === retryableError);

    const result = await handleCallback({
      code: 'code-1',
      state: 'state-1',
      iss: 'https://issuer.example/realms/test',
      authConfig,
      loginState: {
        kind: 'platform',
        codeVerifier: 'verifier',
        nonce: 'nonce',
        createdAt: Date.now(),
        silent: true,
      },
    });

    expect(mocks.invalidateOidcConfig).toHaveBeenCalledWith(authConfig);
    expect(mocks.authorizationCodeGrant).toHaveBeenCalledTimes(2);
    expect(mocks.createSession).toHaveBeenCalledTimes(1);
    expect(mocks.createSession).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        freshReauthAt: undefined,
      })
    );
    expect(mocks.runPostLoginTasks).toHaveBeenCalledWith('de-test', 'kc-user-1');
    expect(result.retryPerformed).toBe(true);
    expect(result.sessionId).toBeTypeOf('string');
    expect(result.loginState).toMatchObject({ kind: 'platform', silent: true });
  });

  it('returns the authenticated session after post-login tasks were triggered', async () => {
    const { handleCallback } = await import('./callback.js');

    const result = await handleCallback({
      code: 'code-1',
      state: 'state-1',
      authConfig,
      loginState: {
        kind: 'platform',
        codeVerifier: 'verifier',
        nonce: 'nonce',
        createdAt: Date.now(),
      },
    });

    expect(result.user.id).toBe('kc-user-1');
    expect(mocks.createSession).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        freshReauthAt: undefined,
      })
    );
    expect(mocks.runPostLoginTasks).toHaveBeenCalledWith('de-test', 'kc-user-1');
  });

  it('runs post-login tasks for the authenticated subject after a successful callback', async () => {
    const { handleCallback } = await import('./callback.js');

    await handleCallback({
      code: 'code-1',
      state: 'state-1',
      authConfig,
      loginState: {
        kind: 'platform',
        codeVerifier: 'verifier',
        nonce: 'nonce',
        createdAt: Date.now(),
      },
    });

    expect(mocks.runPostLoginTasks).toHaveBeenCalledWith('de-test', 'kc-user-1');
  });

  it('stamps fresh reauth only for explicit reauth callbacks with a fresh auth_time claim', async () => {
    const { handleCallback } = await import('./callback.js');

    mocks.authorizationCodeGrant.mockResolvedValueOnce({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      id_token: 'id-token',
      expiresIn: () => 300,
      claims: () => ({ sub: 'kc-user-1', auth_time: 2_000 }),
    });

    await handleCallback({
      code: 'code-1',
      state: 'state-1',
      authConfig,
      loginState: {
        kind: 'platform',
        codeVerifier: 'verifier',
        nonce: 'nonce',
        createdAt: 1_999_500,
        freshReauthRequested: true,
      },
    });

    expect(mocks.createSession).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        freshReauthAt: 2_000_000,
      })
    );
  });

  it('does not stamp fresh reauth when the callback lacks fresh auth evidence', async () => {
    const { handleCallback } = await import('./callback.js');

    mocks.authorizationCodeGrant.mockResolvedValueOnce({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      id_token: 'id-token',
      expiresIn: () => 300,
      claims: () => ({ sub: 'kc-user-1', auth_time: 1_000 }),
    });

    await handleCallback({
      code: 'code-1',
      state: 'state-1',
      authConfig,
      loginState: {
        kind: 'platform',
        codeVerifier: 'verifier',
        nonce: 'nonce',
        createdAt: 2_000_000,
        freshReauthRequested: true,
      },
    });

    expect(mocks.createSession).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        freshReauthAt: undefined,
      })
    );
  });
});
