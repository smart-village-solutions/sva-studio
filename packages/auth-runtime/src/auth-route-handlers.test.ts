import { beforeEach, describe, expect, it, vi } from 'vitest';

type SessionUser = {
  id: string;
  instanceId?: string;
  roles: string[];
};

type EffectivePermission = {
  action: string;
  effect: string;
};

const mocks = vi.hoisted(() => {
  const logger = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return {
    logger,
    withRequestContext: vi.fn(async (_input: unknown, handler: () => Promise<Response>) => handler()),
    withAuthenticatedUser: vi.fn(),
    resolveEffectivePermissions: vi.fn(),
    isMockAuthEnabled: vi.fn(),
    createMockSessionUser: vi.fn(),
    getAuthConfig: vi.fn(() => ({ sessionCookieName: 'sva_session' })),
    readCookieFromRequest: vi.fn(() => 'session-1'),
  };
});

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => mocks.logger,
  getWorkspaceContext: () => ({ requestId: 'req-test', traceId: 'trace-test' }),
  initializeOtelSdk: vi.fn(async () => undefined),
  toJsonErrorResponse: vi.fn(
    (status: number, errorCode: string, message: string, options?: { requestId?: string }) =>
      new Response(
        JSON.stringify({
          error: errorCode,
          message,
          requestId: options?.requestId,
        }),
        {
          status,
          headers: { 'Content-Type': 'application/json' },
        }
      )
  ),
  withRequestContext: mocks.withRequestContext,
}));

vi.mock('./middleware.js', () => ({
  withAuthenticatedUser: mocks.withAuthenticatedUser,
}));

vi.mock('./iam-authorization/permission-store.js', () => ({
  resolveEffectivePermissions: mocks.resolveEffectivePermissions,
}));

vi.mock('./mock-auth.js', () => ({
  isMockAuthEnabled: mocks.isMockAuthEnabled,
  createMockSessionUser: mocks.createMockSessionUser,
}));

vi.mock('./config.js', () => ({
  getAuthConfig: mocks.getAuthConfig,
  resolveAuthConfigForRequest: vi.fn(),
}));

vi.mock('./cookies.js', () => ({
  appendSetCookie: vi.fn(),
  deleteCookieHeader: vi.fn(),
  readCookieFromRequest: mocks.readCookieFromRequest,
}));

describe('meHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.isMockAuthEnabled.mockReturnValue(false);
    mocks.createMockSessionUser.mockReturnValue({
      id: 'mock-user',
      instanceId: 'de-test',
      roles: ['system_admin'],
    } satisfies SessionUser);

    mocks.withAuthenticatedUser.mockImplementation(async (_request: Request, handler: (ctx: { user: SessionUser }) => Promise<Response>) =>
      handler({
        user: {
          id: 'kc-user-1',
          instanceId: 'de-test',
          roles: ['editor'],
        },
      })
    );

    mocks.resolveEffectivePermissions.mockResolvedValue({
      ok: true,
      permissions: [
        { action: 'news.read', effect: 'allow' },
        { action: 'news.read', effect: 'deny' },
        { action: 'events.read', effect: 'allow' },
      ] satisfies EffectivePermission[],
      cacheStatus: 'hit',
      snapshotVersion: 'snap-1',
    });
  });

  it('uses keycloakSubject for permission resolution and omits stale userId contract', async () => {
    const { meHandler } = await import('./auth-route-handlers.js');

    await meHandler(new Request('http://localhost/auth/me', { headers: { cookie: 'sva_session=session-1' } }));

    expect(mocks.resolveEffectivePermissions).toHaveBeenCalledTimes(1);
    const [resolverInput] = mocks.resolveEffectivePermissions.mock.calls[0] as [Record<string, unknown>];
    expect(resolverInput.instanceId).toBe('de-test');
    expect(resolverInput.keycloakSubject).toBe('kc-user-1');
    expect('userId' in resolverInput).toBe(false);
  });

  it('returns no-store auth headers and deny-dominant permissionActions', async () => {
    const { meHandler } = await import('./auth-route-handlers.js');

    const response = await meHandler(new Request('http://localhost/auth/me', { headers: { cookie: 'sva_session=session-1' } }));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Pragma')).toBe('no-cache');

    const payload = (await response.json()) as {
      user: {
        id: string;
        permissionActions: string[];
      };
    };

    expect(payload.user.id).toBe('kc-user-1');
    expect(payload.user.permissionActions).toEqual(['events.read']);
  });

  it('returns hardened headers in mock-auth mode without permission lookup', async () => {
    const { meHandler } = await import('./auth-route-handlers.js');

    mocks.isMockAuthEnabled.mockReturnValue(true);

    const response = await meHandler(new Request('http://localhost/auth/me'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Pragma')).toBe('no-cache');
    expect(mocks.resolveEffectivePermissions).not.toHaveBeenCalled();

    const payload = (await response.json()) as { user: SessionUser };
    expect(payload.user).toEqual({
      id: 'mock-user',
      instanceId: 'de-test',
      roles: ['system_admin'],
    });
  });
});
