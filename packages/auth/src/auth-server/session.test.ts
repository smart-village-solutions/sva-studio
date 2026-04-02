import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  getSessionControlStateMock: vi.fn(),
  updateSessionMock: vi.fn(),
  deleteSessionMock: vi.fn(),
  refreshTokenGrantMock: vi.fn(),
  getOidcConfigMock: vi.fn(),
  getAuthConfigMock: vi.fn(),
  resolveAuthConfigFromSessionAuthMock: vi.fn(),
  loggerMock: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  buildSessionUserMock: vi.fn((input: { claims: Record<string, unknown> }) => ({
    id: String(input.claims.sub ?? ''),
    instanceId: typeof input.claims.instanceId === 'string' ? input.claims.instanceId : undefined,
    roles: Array.isArray(input.claims.roles) ? input.claims.roles : [],
  })),
  resolveSessionExpiryMock: vi.fn(
    (input: { expiresInSeconds?: number; fallback?: number; issuedAt: number; sessionTtlMs: number }) => {
      if (typeof input.expiresInSeconds === 'number') {
        return Math.min(Date.now() + input.expiresInSeconds * 1000, input.issuedAt + input.sessionTtlMs);
      }
      return input.fallback ?? input.issuedAt + input.sessionTtlMs;
    }
  ),
}));

const {
  getSessionMock,
  getSessionControlStateMock,
  updateSessionMock,
  deleteSessionMock,
  refreshTokenGrantMock,
  getOidcConfigMock,
  getAuthConfigMock,
  resolveAuthConfigFromSessionAuthMock,
  loggerMock,
  buildSessionUserMock,
  resolveSessionExpiryMock,
} = mocks;

vi.mock('../config', () => ({
  getAuthConfig: mocks.getAuthConfigMock,
  resolveAuthConfigFromSessionAuth: mocks.resolveAuthConfigFromSessionAuthMock,
}));

vi.mock('../oidc.server', () => ({
  getOidcConfig: mocks.getOidcConfigMock,
  client: {
    refreshTokenGrant: mocks.refreshTokenGrantMock,
  },
}));

vi.mock('../redis-session.server', () => ({
  getSession: mocks.getSessionMock,
  getSessionControlState: mocks.getSessionControlStateMock,
  updateSession: mocks.updateSessionMock,
  deleteSession: mocks.deleteSessionMock,
}));

vi.mock('../shared/error-guards', () => ({
  isTokenErrorLike: (value: unknown) =>
    Boolean(
      value &&
        typeof value === 'object' &&
        ('code' in (value as Record<string, unknown>) || 'error' in (value as Record<string, unknown>))
    ),
}));

vi.mock('../shared/log-context', () => ({
  buildLogContext: (workspaceId?: string) => ({ workspace_id: workspaceId }),
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => mocks.loggerMock,
}));

vi.mock('./shared', () => ({
  TOKEN_REFRESH_SKEW_MS: 60_000,
  buildSessionUser: mocks.buildSessionUserMock,
  resolveSessionExpiry: mocks.resolveSessionExpiryMock,
}));

import { getSessionUser } from './session.ts';

describe('auth-server/session', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T10:00:00.000Z'));
    getSessionControlStateMock.mockResolvedValue(undefined);
    getAuthConfigMock.mockReturnValue({
      issuer: 'https://issuer.example',
      clientId: 'sva-client',
      clientSecret: 'secret',
      sessionTtlMs: 60_000,
    });
    resolveAuthConfigFromSessionAuthMock.mockImplementation((auth) => ({
      issuer: auth.issuer,
      clientId: auth.clientId,
      clientSecret: 'secret',
      postLogoutRedirectUri: auth.postLogoutRedirectUri,
      sessionTtlMs: 60_000,
      instanceId: auth.instanceId,
      authRealm: auth.authRealm,
    }));
  });

  it('returns null when the session is missing', async () => {
    getSessionMock.mockResolvedValue(undefined);

    await expect(getSessionUser('session-1')).resolves.toBeNull();
  });

  it('invalidates sessions below the minimum session version', async () => {
    getSessionMock.mockResolvedValue({
      userId: 'user-versioned',
      user: {
        id: 'user-versioned',
        instanceId: 'instance-1',
        roles: ['viewer'],
      },
      sessionVersion: 1,
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60_000,
    });
    getSessionControlStateMock.mockResolvedValue({
      minimumSessionVersion: 2,
      forcedReauthAt: Date.now(),
    });

    await expect(getSessionUser('session-versioned')).resolves.toBeNull();
    expect(deleteSessionMock).toHaveBeenCalledWith('session-versioned');
  });

  it('invalidates sessions that were issued before forced reauth', async () => {
    getSessionMock.mockResolvedValue({
      userId: 'user-forced',
      user: {
        id: 'user-forced',
        instanceId: 'instance-1',
        roles: ['viewer'],
      },
      sessionVersion: 3,
      issuedAt: Date.now() - 10_000,
      createdAt: Date.now() - 20_000,
      expiresAt: Date.now() + 5 * 60_000,
    });
    getSessionControlStateMock.mockResolvedValue({
      forcedReauthAt: Date.now() - 5_000,
    });

    await expect(getSessionUser('session-forced')).resolves.toBeNull();
    expect(deleteSessionMock).toHaveBeenCalledWith('session-forced');
  });

  it('keeps the current user when no hydration is needed and no refresh is due', async () => {
    getSessionMock.mockResolvedValue({
      user: {
        id: 'user-2',
        instanceId: 'instance-1',
        roles: ['viewer'],
      },
      expiresAt: Date.now() + 5 * 60_000,
    });

    await expect(getSessionUser('session-2')).resolves.toEqual(
      expect.objectContaining({
        id: 'user-2',
        instanceId: 'instance-1',
      })
    );
    expect(updateSessionMock).not.toHaveBeenCalled();
  });

  it('returns the original user when hydration from access token still lacks required fields', async () => {
    getSessionMock.mockResolvedValue({
      user: { id: 'user-legacy', roles: [] },
      accessToken: 'token-1',
      expiresAt: Date.now() + 5 * 60_000,
    });

    await expect(getSessionUser('session-hydrate')).resolves.toEqual({
      id: 'user-legacy',
      roles: [],
    });
    expect(updateSessionMock).not.toHaveBeenCalled();
  });

  it('refreshes the session when expiry is within the skew window', async () => {
    getSessionMock
      .mockResolvedValueOnce({
        user: { id: 'user-3', roles: ['viewer'] },
        refreshToken: 'refresh-1',
        expiresAt: Date.now() + 1_000,
        createdAt: Date.now(),
      })
      .mockResolvedValueOnce({
        user: {
          id: 'user-3',
          instanceId: 'instance-1',
          roles: ['Admin'],
        },
      });
    getOidcConfigMock.mockResolvedValue({ issuer: 'https://issuer.example' });
    refreshTokenGrantMock.mockResolvedValue({
      access_token: 'access-2',
      refresh_token: 'refresh-2',
      id_token: 'id-2',
      claims: () => ({
        sub: 'user-3',
        preferred_username: 'Refreshed',
        email: 'refresh@example.com',
        instanceId: 'instance-1',
        roles: ['Admin'],
      }),
      expiresIn: () => 600,
    });

    const user = await getSessionUser('session-3');

    expect(refreshTokenGrantMock).toHaveBeenCalledTimes(1);
    expect(updateSessionMock).toHaveBeenCalledWith(
      'session-3',
      expect.objectContaining({
        accessToken: 'access-2',
        refreshToken: 'refresh-2',
      })
    );
    expect(user).toEqual(
      expect.objectContaining({
        id: 'user-3',
        roles: ['Admin'],
      })
    );
  });

  it('hydrates from stored session auth without requiring global auth config', async () => {
    buildSessionUserMock.mockReturnValueOnce({
      id: 'hydrated-user',
      instanceId: 'bb-guben',
      roles: ['editor'],
    });
    getAuthConfigMock.mockImplementation(() => {
      throw new Error('Missing required env: SVA_AUTH_ISSUER');
    });
    getSessionMock.mockResolvedValue({
      user: { id: 'legacy-user', roles: [] },
      accessToken: 'access-token',
      auth: {
        issuer: 'https://issuer.example/realms/bb-guben',
        clientId: 'tenant-client',
        postLogoutRedirectUri: 'https://bb-guben.studio.smart-village.app/',
        instanceId: 'bb-guben',
        authRealm: 'bb-guben',
      },
      expiresAt: Date.now() + 10_000,
      createdAt: Date.now() - 5_000,
    });

    await expect(getSessionUser('session-hydrate-tenant')).resolves.toEqual({
      id: 'hydrated-user',
      instanceId: 'bb-guben',
      roles: ['editor'],
    });
    expect(resolveAuthConfigFromSessionAuthMock).toHaveBeenCalled();
  });

  it('refreshes with stored session auth without requiring global auth config', async () => {
    getAuthConfigMock.mockImplementation(() => {
      throw new Error('Missing required env: SVA_AUTH_ISSUER');
    });
    getSessionMock
      .mockResolvedValueOnce({
        user: { id: 'user-tenant', roles: ['viewer'] },
        auth: {
          issuer: 'https://issuer.example/realms/bb-guben',
          clientId: 'tenant-client',
          postLogoutRedirectUri: 'https://bb-guben.studio.smart-village.app/',
          instanceId: 'bb-guben',
          authRealm: 'bb-guben',
        },
        refreshToken: 'refresh-tenant',
        expiresAt: Date.now() + 1_000,
        createdAt: Date.now(),
      })
      .mockResolvedValueOnce({
        user: {
          id: 'user-tenant',
          instanceId: 'bb-guben',
          roles: ['Admin'],
        },
      });
    getOidcConfigMock.mockResolvedValue({ issuer: 'https://issuer.example/realms/bb-guben' });
    refreshTokenGrantMock.mockResolvedValue({
      access_token: 'access-tenant',
      refresh_token: 'refresh-tenant-2',
      id_token: 'id-tenant',
      claims: () => ({
        sub: 'user-tenant',
        instanceId: 'bb-guben',
        roles: ['Admin'],
      }),
      expiresIn: () => 600,
    });

    await expect(getSessionUser('session-tenant-refresh')).resolves.toEqual(
      expect.objectContaining({
        id: 'user-tenant',
        roles: ['Admin'],
      })
    );
    expect(resolveAuthConfigFromSessionAuthMock).toHaveBeenCalled();
    expect(getOidcConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({
        issuer: 'https://issuer.example/realms/bb-guben',
        clientId: 'tenant-client',
      })
    );
  });

  it('deletes expired sessions when no refresh token exists', async () => {
    getSessionMock.mockResolvedValue({
      user: { id: 'user-4', roles: ['viewer'] },
      expiresAt: Date.now() - 1_000,
      createdAt: Date.now() - 10_000,
    });

    await expect(getSessionUser('session-4')).resolves.toBeNull();
    expect(deleteSessionMock).toHaveBeenCalledWith('session-4');
  });

  it('hydrates session user from access token when no refresh token exists but session is still valid', async () => {
    buildSessionUserMock.mockReturnValueOnce({
      id: 'hydrated-user',
      instanceId: 'instance-1',
      roles: ['editor'],
    });

    getSessionMock.mockResolvedValue({
      user: { id: 'legacy-user', roles: [] },
      accessToken: 'access-token-with-claims',
      expiresAt: Date.now() + 10_000,
      createdAt: Date.now() - 5_000,
    });

    await expect(getSessionUser('session-hydrate-no-refresh')).resolves.toEqual({
      id: 'hydrated-user',
      instanceId: 'instance-1',
      roles: ['editor'],
    });

    expect(updateSessionMock).toHaveBeenCalledWith(
      'session-hydrate-no-refresh',
      expect.objectContaining({
        user: {
          id: 'hydrated-user',
          instanceId: 'instance-1',
          roles: ['editor'],
        },
      })
    );
  });

  it('returns the fallback user when token refresh fails but the session is still valid', async () => {
    getSessionMock.mockResolvedValue({
      user: { id: 'user-5', roles: ['viewer'], instanceId: 'instance-1' },
      refreshToken: 'refresh-5',
      expiresAt: Date.now() + 5_000,
      createdAt: Date.now(),
    });
    getOidcConfigMock.mockResolvedValue({ issuer: 'https://issuer.example' });
    refreshTokenGrantMock.mockRejectedValue({ code: 'token_invalid' });

    await expect(getSessionUser('session-5')).resolves.toEqual(
      expect.objectContaining({
        id: 'user-5',
      })
    );
    expect(loggerMock.warn).toHaveBeenCalledTimes(1);
    expect(deleteSessionMock).not.toHaveBeenCalled();
  });

  it('deletes the session when refresh fails after expiry', async () => {
    getSessionMock.mockResolvedValue({
      user: { id: 'user-6', roles: ['viewer'], instanceId: 'instance-1' },
      refreshToken: 'refresh-6',
      expiresAt: Date.now() - 5_000,
      createdAt: Date.now() - 10_000,
    });
    getOidcConfigMock.mockResolvedValue({ issuer: 'https://issuer.example' });
    refreshTokenGrantMock.mockRejectedValue(new Error('refresh failed'));

    await expect(getSessionUser('session-6')).resolves.toBeNull();
    expect(loggerMock.error).toHaveBeenCalledTimes(1);
    expect(deleteSessionMock).toHaveBeenCalledWith('session-6');
  });
});
