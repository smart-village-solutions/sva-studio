import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Session, SessionAuthContext, SessionUser } from '../types.js';

const state = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  getAuthConfig: vi.fn(),
  resolveAuthConfigFromSessionAuth: vi.fn(),
  resolveAuthConfigForInstance: vi.fn(),
  getOidcConfig: vi.fn(),
  refreshTokenGrant: vi.fn(),
  deleteSession: vi.fn(),
  getSession: vi.fn(),
  getSessionControlState: vi.fn(),
  updateSession: vi.fn(),
  buildSessionUser: vi.fn(),
  resolveSessionExpiry: vi.fn(),
  isTokenErrorLike: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
}));

vi.mock('../config.js', () => ({
  getAuthConfig: state.getAuthConfig,
  resolveAuthConfigFromSessionAuth: state.resolveAuthConfigFromSessionAuth,
  resolveAuthConfigForInstance: state.resolveAuthConfigForInstance,
}));

vi.mock('../log-context.js', () => ({
  buildLogContext: vi.fn(() => ({ trace_id: 'trace-1' })),
}));

vi.mock('../oidc.js', () => ({
  client: {
    refreshTokenGrant: state.refreshTokenGrant,
  },
  getOidcConfig: state.getOidcConfig,
}));

vi.mock('../redis-session.js', () => ({
  deleteSession: state.deleteSession,
  getSession: state.getSession,
  getSessionControlState: state.getSessionControlState,
  updateSession: state.updateSession,
}));

vi.mock('../error-guards.js', () => ({
  isTokenErrorLike: state.isTokenErrorLike,
}));

vi.mock('./shared.js', () => ({
  TOKEN_REFRESH_SKEW_MS: 60_000,
  buildSessionUser: state.buildSessionUser,
  resolveSessionExpiry: state.resolveSessionExpiry,
}));

const auth: SessionAuthContext = {
  kind: 'instance',
  instanceId: 'tenant-a',
  authRealm: 'tenant-a',
  issuer: 'https://issuer.example/realms/tenant-a',
  clientId: 'tenant-client',
  redirectUri: 'https://tenant.example/auth/callback',
  postLogoutRedirectUri: 'https://tenant.example/',
};

const completeUser: SessionUser = {
  id: 'user-1',
  instanceId: 'tenant-a',
  roles: ['iam_admin'],
};

const incompleteUser: SessionUser = {
  id: 'user-1',
  roles: [],
};

const createSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'session-1',
  userId: 'user-1',
  user: completeUser,
  auth,
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  createdAt: 1_000,
  issuedAt: 1_000,
  expiresAt: 10_000,
  freshReauthAt: 4_500,
  sessionVersion: 2,
  ...overrides,
});

describe('auth server session resolution', () => {
  let previousAuthorizeTimingDebug: string | undefined;

  beforeEach(() => {
    previousAuthorizeTimingDebug = process.env.IAM_DEBUG_AUTHORIZE_TIMINGS;
    delete process.env.IAM_DEBUG_AUTHORIZE_TIMINGS;
    vi.clearAllMocks();
    vi.resetModules();
    vi.spyOn(Date, 'now').mockReturnValue(5_000);
    state.getAuthConfig.mockReturnValue({
      ...auth,
      clientSecret: 'secret',
      loginStateSecret: 'login-secret',
      redirectUri: 'https://tenant.example/auth/callback',
      scopes: 'openid profile',
      sessionCookieName: 'sva_session',
      loginStateCookieName: 'login_state',
      silentSsoSuppressCookieName: 'silent_sso',
      sessionTtlMs: 3_600_000,
      sessionRedisTtlBufferMs: 60_000,
      silentSsoSuppressAfterLogoutMs: 30_000,
    });
    state.resolveAuthConfigFromSessionAuth.mockReturnValue({
      ...state.getAuthConfig.mock.results[0]?.value,
      ...auth,
    });
    state.resolveAuthConfigForInstance.mockResolvedValue({
      ...state.getAuthConfig.mock.results[0]?.value,
      ...auth,
      clientSecret: 'tenant-secret',
      redirectUri: 'https://tenant.example/auth/callback',
    });
    state.getSessionControlState.mockResolvedValue(null);
    state.resolveSessionExpiry.mockReturnValue(9_000);
    state.buildSessionUser.mockReturnValue(completeUser);
    state.getOidcConfig.mockResolvedValue({ issuer: auth.issuer });
    state.refreshTokenGrant.mockResolvedValue({
      access_token: 'refreshed-access-token',
      refresh_token: 'refreshed-refresh-token',
      id_token: 'refreshed-id-token',
      expiresIn: () => 120,
      claims: () => ({ sub: 'user-1', instance_id: 'tenant-a' }),
    });
    state.deleteSession.mockResolvedValue(undefined);
    state.updateSession.mockResolvedValue(undefined);
    state.isTokenErrorLike.mockReturnValue(false);
  });

  afterEach(() => {
    if (previousAuthorizeTimingDebug === undefined) {
      delete process.env.IAM_DEBUG_AUTHORIZE_TIMINGS;
    } else {
      process.env.IAM_DEBUG_AUTHORIZE_TIMINGS = previousAuthorizeTimingDebug;
    }
    vi.restoreAllMocks();
  });

  it('returns invalid_session when the session is missing', async () => {
    state.getSession.mockResolvedValue(null);

    const { resolveSessionUser } = await import('./session.js');

    await expect(resolveSessionUser('session-1')).resolves.toEqual({
      kind: 'invalid',
      reason: 'invalid_session',
    });
  });

  it('revalidates session data on every request and briefly caches absent control state', async () => {
    state.getSession.mockResolvedValue(createSession({ expiresAt: 100_000 }));

    const { resolveSessionUser } = await import('./session.js');

    await expect(resolveSessionUser('session-1')).resolves.toEqual({
      kind: 'authenticated',
      user: completeUser,
      expiresAt: 100_000,
      freshReauthAt: 4_500,
    });
    await expect(resolveSessionUser('session-1')).resolves.toEqual({
      kind: 'authenticated',
      user: completeUser,
      expiresAt: 100_000,
      freshReauthAt: 4_500,
    });

    expect(state.getSession).toHaveBeenCalledTimes(2);
    expect(state.getSession).toHaveBeenNthCalledWith(1, 'session-1', { decryptTokens: false });
    expect(state.getSession).toHaveBeenNthCalledWith(2, 'session-1', { decryptTokens: false });
    expect(state.getSessionControlState).toHaveBeenCalledTimes(1);
  });

  it('logs session resolution timing diagnostics when authorize timing debug is enabled', async () => {
    process.env.IAM_DEBUG_AUTHORIZE_TIMINGS = 'true';
    state.getSession.mockResolvedValue(createSession({ expiresAt: 100_000 }));

    const { resolveSessionUser } = await import('./session.js');

    await expect(resolveSessionUser('session-1')).resolves.toMatchObject({
      kind: 'authenticated',
      user: completeUser,
    });
    expect(state.getSession).toHaveBeenCalledWith('session-1', { decryptTokens: false });

    expect(state.logger.info).toHaveBeenCalledWith(
      'Session resolution timing diagnostics',
      expect.objectContaining({
        operation: 'session_resolution_timing',
        result_reason: 'authenticated',
        get_session_ms: expect.any(Number),
        control_state_ms: expect.any(Number),
        control_state_cache_status: 'miss_absent',
        hydrate_user_ms: expect.any(Number),
        refresh_ms: 0,
        refresh_session_read_ms: 0,
        delete_session_ms: 0,
        total_ms: expect.any(Number),
        session_id_present: true,
        user_id: 'user-1',
        session_refresh_required: false,
        trace_id: 'trace-1',
      })
    );
  });

  it('rechecks absent control state after the short hot-path cache expires', async () => {
    state.getSession.mockResolvedValue(createSession({ expiresAt: 100_000 }));

    const { resolveSessionUser } = await import('./session.js');

    await expect(resolveSessionUser('session-1')).resolves.toMatchObject({
      kind: 'authenticated',
      user: completeUser,
    });

    vi.mocked(Date.now).mockReturnValue(10_001);

    await expect(resolveSessionUser('session-1')).resolves.toMatchObject({
      kind: 'authenticated',
      user: completeUser,
    });

    expect(state.getSession).toHaveBeenCalledTimes(2);
    expect(state.getSession).toHaveBeenNthCalledWith(1, 'session-1', { decryptTokens: false });
    expect(state.getSession).toHaveBeenNthCalledWith(2, 'session-1', { decryptTokens: false });
    expect(state.getSessionControlState).toHaveBeenCalledTimes(2);
  });

  it('treats tenant sessions with empty canonical IAM roles as complete', async () => {
    const userWithoutHydratedRoles: SessionUser = {
      id: 'user-1',
      instanceId: 'tenant-a',
      roles: [],
      keycloakRoles: ['legacy_editor'],
    };
    state.getSession.mockResolvedValue(
      createSession({ user: userWithoutHydratedRoles, expiresAt: 100_000 })
    );

    const { resolveSessionUser } = await import('./session.js');

    await expect(resolveSessionUser('session-1')).resolves.toMatchObject({
      kind: 'authenticated',
      user: userWithoutHydratedRoles,
    });
    expect(state.buildSessionUser).not.toHaveBeenCalled();
    expect(state.updateSession).not.toHaveBeenCalled();
    expect(state.logger.warn).not.toHaveBeenCalledWith(
      'Session user is missing required IAM context',
      expect.anything()
    );
  });

  it('deletes disallowed sessions when control state invalidates them', async () => {
    state.getSession.mockResolvedValue(createSession({ sessionVersion: 1 }));
    state.getSessionControlState.mockResolvedValue({ minimumSessionVersion: 2 });

    const { resolveSessionUser } = await import('./session.js');

    await expect(resolveSessionUser('session-1')).resolves.toEqual({
      kind: 'invalid',
      reason: 'forced_reauth',
    });
    expect(state.deleteSession).toHaveBeenCalledWith('session-1');
  });

  it('deletes sessions when the subject is blocked from starting new sessions', async () => {
    state.getSession.mockResolvedValue(createSession({ sessionVersion: 2 }));
    state.getSessionControlState.mockResolvedValue({
      minimumSessionVersion: 2,
      loginBlocked: true,
      loginBlockedReason: 'dsr_deletion_requested',
    });

    const { resolveSessionUser } = await import('./session.js');

    await expect(resolveSessionUser('session-1')).resolves.toEqual({
      kind: 'invalid',
      reason: 'forced_reauth',
    });
    expect(state.deleteSession).toHaveBeenCalledWith('session-1');
  });

  it('hydrates incomplete session users from the access token on fresh sessions', async () => {
    state.getSession.mockResolvedValue(
      createSession({ user: incompleteUser, refreshToken: undefined, expiresAt: 100_000 })
    );

    const { getSessionUser } = await import('./session.js');

    await expect(getSessionUser('session-1')).resolves.toEqual(completeUser);
    expect(state.getSession).toHaveBeenNthCalledWith(1, 'session-1', { decryptTokens: false });
    expect(state.getSession).toHaveBeenNthCalledWith(2, 'session-1', { decryptTokens: true });
    expect(state.updateSession).toHaveBeenCalledWith('session-1', { user: completeUser });
  });

  it('deletes expired sessions without a refresh token', async () => {
    state.getSession.mockResolvedValue(
      createSession({ refreshToken: undefined, expiresAt: 4_000 })
    );

    const { resolveSessionUser } = await import('./session.js');

    await expect(resolveSessionUser('session-1')).resolves.toEqual({
      kind: 'invalid',
      reason: 'session_expired',
    });
    expect(state.deleteSession).toHaveBeenCalledWith('session-1');
  });

  it('refreshes expiring sessions and returns the updated user', async () => {
    const expiringSession = createSession({ expiresAt: 5_100 });
    state.getSession
      .mockResolvedValueOnce(expiringSession)
      .mockResolvedValueOnce(expiringSession)
      .mockResolvedValueOnce(
        createSession({
          user: completeUser,
          accessToken: 'refreshed-access-token',
          expiresAt: 9_000,
        })
      );

    const { getSessionUser } = await import('./session.js');

    await expect(getSessionUser('session-1')).resolves.toEqual(completeUser);
    expect(state.getSession).toHaveBeenNthCalledWith(1, 'session-1', { decryptTokens: false });
    expect(state.getSession).toHaveBeenNthCalledWith(2, 'session-1', { decryptTokens: true });
    expect(state.getSession).toHaveBeenNthCalledWith(3, 'session-1', { decryptTokens: false });
    expect(state.refreshTokenGrant).toHaveBeenCalledTimes(1);
    expect(state.updateSession).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        user: completeUser,
        accessToken: 'refreshed-access-token',
        refreshToken: 'refreshed-refresh-token',
        idToken: 'refreshed-id-token',
        expiresAt: 9_000,
      })
    );
  });

  it('resolves tenant auth config with the instance secret before refreshing an instance session', async () => {
    const expiringSession = createSession({ expiresAt: 5_100 });
    state.getSession
      .mockResolvedValueOnce(expiringSession)
      .mockResolvedValueOnce(expiringSession)
      .mockResolvedValueOnce(
        createSession({
          user: completeUser,
          accessToken: 'refreshed-access-token',
          expiresAt: 9_000,
        })
      );

    const { getSessionUser } = await import('./session.js');

    await expect(getSessionUser('session-1')).resolves.toEqual(completeUser);
    expect(state.resolveAuthConfigForInstance).toHaveBeenCalledWith('tenant-a', {
      origin: 'https://tenant.example',
    });
    expect(state.getOidcConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        clientSecret: 'tenant-secret',
      })
    );
    expect(state.resolveAuthConfigFromSessionAuth).not.toHaveBeenCalled();
  });

  it('prefers the redirect uri origin over the post-logout redirect uri during instance refresh', async () => {
    const expiringSession = createSession({
      auth: {
        ...auth,
        redirectUri: 'https://studio.tenant.example/auth/callback',
        postLogoutRedirectUri: 'https://marketing.example/logout',
      },
      expiresAt: 5_100,
    });
    state.getSession
      .mockResolvedValueOnce(expiringSession)
      .mockResolvedValueOnce(expiringSession)
      .mockResolvedValueOnce(
        createSession({
          user: completeUser,
          accessToken: 'refreshed-access-token',
          expiresAt: 9_000,
        })
      );

    const { getSessionUser } = await import('./session.js');

    await expect(getSessionUser('session-1')).resolves.toEqual(completeUser);
    expect(state.resolveAuthConfigForInstance).toHaveBeenCalledWith('tenant-a', {
      origin: 'https://studio.tenant.example',
    });
  });

  it('falls back to the post-logout redirect uri for legacy instance sessions without redirect uri', async () => {
    const expiringSession = createSession({
      auth: {
        ...auth,
        redirectUri: undefined,
        postLogoutRedirectUri: 'https://legacy-tenant.example/logout',
      },
      expiresAt: 5_100,
    });
    state.getSession
      .mockResolvedValueOnce(expiringSession)
      .mockResolvedValueOnce(expiringSession)
      .mockResolvedValueOnce(
        createSession({
          user: completeUser,
          accessToken: 'refreshed-access-token',
          expiresAt: 9_000,
        })
      );

    const { getSessionUser } = await import('./session.js');

    await expect(getSessionUser('session-1')).resolves.toEqual(completeUser);
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Instance session refresh fell back to post-logout redirect URI because redirect URI is missing',
      expect.objectContaining({
        instance_id: 'tenant-a',
        post_logout_redirect_uri: 'https://legacy-tenant.example/logout',
      })
    );
    expect(state.resolveAuthConfigForInstance).toHaveBeenCalledWith('tenant-a', {
      origin: 'https://legacy-tenant.example',
    });
  });

  it('returns the fallback user and preserves expiry when token refresh fails before expiry', async () => {
    const session = createSession({ expiresAt: 5_100, user: completeUser });
    state.getSession.mockResolvedValue(session);
    state.refreshTokenGrant.mockRejectedValue(new Error('oauth unavailable'));
    state.isTokenErrorLike.mockReturnValue(true);

    const { resolveSessionUser } = await import('./session.js');

    await expect(resolveSessionUser('session-1')).resolves.toEqual({
      kind: 'authenticated',
      user: completeUser,
      expiresAt: 5_100,
      freshReauthAt: 4_500,
    });
    expect(state.deleteSession).not.toHaveBeenCalled();
  });

  it('deletes expired sessions when token refresh fails after expiry', async () => {
    const session = createSession({ expiresAt: 4_000, user: completeUser });
    state.getSession.mockResolvedValue(session);
    state.refreshTokenGrant.mockRejectedValue(new Error('oauth unavailable'));
    state.isTokenErrorLike.mockReturnValue(true);

    const { resolveSessionUser } = await import('./session.js');

    await expect(resolveSessionUser('session-1')).resolves.toEqual({
      kind: 'invalid',
      reason: 'token_refresh_failed_after_expiry',
    });
    expect(state.deleteSession).toHaveBeenCalledWith('session-1');
  });

  it('rethrows session store failures from the refresh path', async () => {
    const session = createSession({ expiresAt: 5_100, user: completeUser });
    state.getSession.mockResolvedValue(session);
    const { SessionStoreUnavailableError: RuntimeSessionStoreUnavailableError } =
      await import('../runtime-errors.js');
    state.refreshTokenGrant.mockRejectedValue(
      new RuntimeSessionStoreUnavailableError('refresh_token')
    );

    const { getSessionUser } = await import('./session.js');

    await expect(getSessionUser('session-1')).rejects.toBeInstanceOf(
      RuntimeSessionStoreUnavailableError
    );
  });
});
