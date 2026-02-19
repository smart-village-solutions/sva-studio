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

  it('returns existing user without refresh when token is still valid', async () => {
    const now = Date.now();
    getSessionMock.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      user: {
        id: 'user-1',
        name: 'Max Mustermann',
        email: 'max@example.com',
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
      roles: ['admin'],
    });
    expect(refreshTokenGrantMock).not.toHaveBeenCalled();
    expect(getOidcConfigMock).not.toHaveBeenCalled();
    expect(updateSessionMock).not.toHaveBeenCalled();
    expect(deleteSessionMock).not.toHaveBeenCalled();
  });
});
