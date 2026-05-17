import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionStoreUnavailableError } from '../runtime-errors.js';
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
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('hydrates incomplete session users from the access token on fresh sessions', async () => {
    state.getSession.mockResolvedValue(
      createSession({ user: incompleteUser, refreshToken: undefined, expiresAt: 100_000 })
    );

    const { getSessionUser } = await import('./session.js');

    await expect(getSessionUser('session-1')).resolves.toEqual(completeUser);
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
    state.getSession
      .mockResolvedValueOnce(createSession({ expiresAt: 5_100 }))
      .mockResolvedValueOnce(
        createSession({
          user: completeUser,
          accessToken: 'refreshed-access-token',
          expiresAt: 9_000,
        })
      );

    const { getSessionUser } = await import('./session.js');

    await expect(getSessionUser('session-1')).resolves.toEqual(completeUser);
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
    state.getSession
      .mockResolvedValueOnce(createSession({ expiresAt: 5_100 }))
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
    state.refreshTokenGrant.mockRejectedValue(new SessionStoreUnavailableError('refresh_token'));

    const { getSessionUser } = await import('./session.js');

    await expect(getSessionUser('session-1')).rejects.toBeInstanceOf(SessionStoreUnavailableError);
  });
});
