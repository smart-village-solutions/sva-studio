import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Session } from './types';

const getSessionMock = vi.fn<(_sessionId: string) => Promise<Session | undefined>>();
const updateSessionMock = vi.fn();
const deleteSessionMock = vi.fn();
const refreshTokenGrantMock = vi.fn();
const getOidcConfigMock = vi.fn();

vi.mock('./config', () => ({
  getAuthConfig: () => ({
    issuer: 'https://issuer.example',
    clientId: 'sva-client',
    clientSecret: 'secret',
    loginStateSecret: 'state-secret',
    redirectUri: 'http://localhost:3000/auth/callback',
    postLogoutRedirectUri: 'http://localhost:3000',
    scopes: 'openid profile email',
    sessionCookieName: 'sva_auth_session',
    loginStateCookieName: 'sva_auth_state',
    sessionTtlMs: 60_000,
  }),
}));

vi.mock('./redis-session.server', () => ({
  consumeLoginState: vi.fn(),
  createLoginState: vi.fn(),
  createSession: vi.fn(),
  deleteSession: deleteSessionMock,
  getSession: getSessionMock,
  updateSession: updateSessionMock,
}));

vi.mock('./oidc.server', () => ({
  getOidcConfig: getOidcConfigMock,
  client: {
    refreshTokenGrant: refreshTokenGrantMock,
  },
}));

describe('getSessionUser', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
        name: 'Max Mustermann',
        email: 'max@example.com',
        instanceId: 'dev-local-1',
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
      name: 'Max Mustermann',
      email: 'max@example.com',
      instanceId: 'dev-local-1',
      roles: ['admin'],
    });
    expect(refreshTokenGrantMock).not.toHaveBeenCalled();
    expect(getOidcConfigMock).not.toHaveBeenCalled();
    expect(updateSessionMock).not.toHaveBeenCalled();
    expect(deleteSessionMock).not.toHaveBeenCalled();
  });

  it('refreshes token and returns updated session user when token is expiring', async () => {
    const now = Date.now();
    const expiredSession: Session = {
      id: 'session-2',
      userId: 'user-old',
      user: {
        id: 'user-old',
        name: 'Alter Nutzer',
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
      instanceId: 'dev-local-1',
      roles: ['editor'],
    };
    const refreshedAccessToken = createUnsignedJwt(refreshedClaims);

    getSessionMock
      .mockResolvedValueOnce(expiredSession)
      .mockResolvedValueOnce({
        ...expiredSession,
        user: {
          id: 'user-2',
          name: 'Neuer Nutzer',
          email: 'new@example.com',
          instanceId: 'dev-local-1',
          roles: ['editor'],
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
      name: 'Neuer Nutzer',
      email: 'new@example.com',
      instanceId: 'dev-local-1',
      roles: ['editor'],
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
        name: 'Abgelaufen',
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
});
