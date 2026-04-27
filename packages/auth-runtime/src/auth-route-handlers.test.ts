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

const authConfigBase = {
  kind: 'platform' as const,
  clientId: 'sva-studio-client',
  redirectUri: 'http://localhost/auth/callback',
  sessionCookieName: 'sva_session',
  loginStateCookieName: 'login_state',
  loginStateSecret: 'test-secret-32-chars-xxxxxxxxxxxxxxxxx',
  silentSsoSuppressCookieName: 'silent_sso',
  postLogoutRedirectUri: 'http://localhost',
  issuer: 'http://localhost/realms/test',
  authRealm: 'test',
};

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

vi.mock('./scope.js', () => ({
  DEFAULT_WORKSPACE_ID: 'default',
  PLATFORM_WORKSPACE_ID: 'platform',
  getScopeFromAuthConfig: vi.fn(() => ({ kind: 'platform' })),
  getWorkspaceIdForScope: vi.fn(() => 'platform'),
}));

vi.mock('./auth-server/login.js', () => ({
  createLoginUrl: vi.fn(),
}));

vi.mock('./login-state-cookie.js', () => ({
  encodeLoginStateCookie: vi.fn(() => 'encoded-login-state-cookie'),
  decodeLoginStateCookie: vi.fn(() => null),
}));

vi.mock('./log-context.js', () => ({
  buildLogContext: vi.fn(() => ({})),
}));

vi.mock('./audit-events.js', () => ({
  emitAuthAuditEvent: vi.fn(),
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

  it('skips permission lookup and returns empty permissionActions when user has no instanceId', async () => {
    const { meHandler } = await import('./auth-route-handlers.js');

    mocks.withAuthenticatedUser.mockImplementationOnce(
      async (_request: Request, handler: (ctx: { user: Omit<SessionUser, 'instanceId'> }) => Promise<Response>) =>
        handler({ user: { id: 'kc-no-instance', roles: [] } })
    );

    const response = await meHandler(new Request('http://localhost/auth/me', { headers: { cookie: 'sva_session=session-1' } }));

    expect(response.status).toBe(200);
    expect(mocks.resolveEffectivePermissions).not.toHaveBeenCalled();

    const payload = (await response.json()) as { user: { permissionActions: string[]; permissionStatus: string } };
    expect(payload.user.permissionActions).toEqual([]);
    expect(payload.user.permissionStatus).toBe('ok');
  });

  it('returns degraded permissionStatus and empty actions when permission snapshot is unavailable', async () => {
    const { meHandler } = await import('./auth-route-handlers.js');

    mocks.resolveEffectivePermissions.mockResolvedValueOnce({
      ok: false,
      status: 503,
      error: 'snapshot_unavailable',
      message: 'Service unavailable',
    });

    const response = await meHandler(new Request('http://localhost/auth/me', { headers: { cookie: 'sva_session=session-1' } }));

    expect(response.status).toBe(200);
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'Auth me resolved user but permission snapshot failed',
      expect.objectContaining({ reason_code: 'permission_snapshot_unavailable' })
    );

    const payload = (await response.json()) as { user: { permissionStatus: string; permissionActions: string[] } };
    expect(payload.user.permissionStatus).toBe('degraded');
    expect(payload.user.permissionActions).toEqual([]);
  });

  it('returns degraded permissionStatus when permission lookup throws', async () => {
    const { meHandler } = await import('./auth-route-handlers.js');

    mocks.resolveEffectivePermissions.mockRejectedValueOnce(new Error('Connection refused'));

    const response = await meHandler(new Request('http://localhost/auth/me', { headers: { cookie: 'sva_session=session-1' } }));

    expect(response.status).toBe(200);
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Auth me permission action lookup failed',
      expect.objectContaining({ reason_code: 'permission_action_lookup_failed', error_type: 'Error' })
    );

    const payload = (await response.json()) as { user: { permissionStatus: string } };
    expect(payload.user.permissionStatus).toBe('degraded');
  });

  it('skips permissions with non-string action values', async () => {
    const { meHandler } = await import('./auth-route-handlers.js');

    mocks.resolveEffectivePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: [
        { action: 999 as unknown as string, effect: 'allow' },
        { action: 'valid.read', effect: 'allow' },
      ] satisfies EffectivePermission[],
      cacheStatus: 'hit',
      snapshotVersion: 'snap-1',
    });

    const response = await meHandler(new Request('http://localhost/auth/me', { headers: { cookie: 'sva_session=session-1' } }));
    const payload = (await response.json()) as { user: { permissionActions: string[] } };
    expect(payload.user.permissionActions).toEqual(['valid.read']);
  });

  it('skips permissions with unknown or absent effect values', async () => {
    const { meHandler } = await import('./auth-route-handlers.js');

    mocks.resolveEffectivePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: [
        { action: 'news.read', effect: 'pending' as 'allow' },
        { action: 'events.read', effect: 'allow' },
      ] satisfies EffectivePermission[],
      cacheStatus: 'hit',
      snapshotVersion: 'snap-1',
    });

    const response = await meHandler(new Request('http://localhost/auth/me', { headers: { cookie: 'sva_session=session-1' } }));
    const payload = (await response.json()) as { user: { permissionActions: string[] } };
    expect(payload.user.permissionActions).toEqual(['events.read']);
  });

  it('deny-first overrides a subsequent allow for the same action', async () => {
    const { meHandler } = await import('./auth-route-handlers.js');

    mocks.resolveEffectivePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: [
        { action: 'news.read', effect: 'deny' },
        { action: 'news.read', effect: 'allow' },
        { action: 'events.read', effect: 'allow' },
      ] satisfies EffectivePermission[],
      cacheStatus: 'hit',
      snapshotVersion: 'snap-1',
    });

    const response = await meHandler(new Request('http://localhost/auth/me', { headers: { cookie: 'sva_session=session-1' } }));
    const payload = (await response.json()) as { user: { permissionActions: string[] } };
    expect(payload.user.permissionActions).toEqual(['events.read']);
  });

  it('sorts multiple allowed permission actions alphabetically', async () => {
    const { meHandler } = await import('./auth-route-handlers.js');

    mocks.resolveEffectivePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: [
        { action: 'z.write', effect: 'allow' },
        { action: 'a.read', effect: 'allow' },
        { action: 'm.update', effect: 'allow' },
      ] satisfies EffectivePermission[],
      cacheStatus: 'hit',
      snapshotVersion: 'snap-1',
    });

    const response = await meHandler(new Request('http://localhost/auth/me', { headers: { cookie: 'sva_session=session-1' } }));
    const payload = (await response.json()) as { user: { permissionActions: string[] } };
    expect(payload.user.permissionActions).toEqual(['a.read', 'm.update', 'z.write']);
  });
});

describe('loginHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isMockAuthEnabled.mockReturnValue(false);
  });

  it('redirects to /?auth=mock-login in mock-auth mode', async () => {
    const { loginHandler } = await import('./auth-route-handlers.js');

    mocks.isMockAuthEnabled.mockReturnValue(true);

    const response = await loginHandler(new Request('http://localhost/auth/login'));

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/?auth=mock-login');
    expect(mocks.resolveEffectivePermissions).not.toHaveBeenCalled();
  });
});

describe('loginHandler (full auth path)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.isMockAuthEnabled.mockReturnValue(false);

    const { resolveAuthConfigForRequest } = await import('./config.js');
    vi.mocked(resolveAuthConfigForRequest).mockResolvedValue(authConfigBase as never);

    const { createLoginUrl } = await import('./auth-server/login.js');
    vi.mocked(createLoginUrl).mockResolvedValue({
      url: 'http://localhost/realms/test/protocol/openid-connect/auth?client_id=sva-studio-client',
      state: 'state-abc123def456',
      loginState: { nonce: 'nonce-xyz789', returnTo: '/', silent: false } as never,
    });
  });

  it('redirects the browser to the Keycloak authorization endpoint', async () => {
    const { loginHandler } = await import('./auth-route-handlers.js');

    const response = await loginHandler(new Request('http://localhost/auth/login'));

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('openid-connect/auth');
  });

  it('logs and returns 500 when login URL creation fails', async () => {
    const { loginHandler } = await import('./auth-route-handlers.js');
    const { createLoginUrl } = await import('./auth-server/login.js');

    vi.mocked(createLoginUrl).mockRejectedValueOnce(new Error('Keycloak unavailable'));

    const response = await loginHandler(new Request('http://localhost/auth/login'));

    expect(response.status).toBe(500);
  });

  it('falls back to getAuthConfig when called without a request object', async () => {
    const { loginHandler } = await import('./auth-route-handlers.js');

    mocks.getAuthConfig.mockReturnValue({
      ...authConfigBase,
      loginStateCookieName: 'login_state',
      loginStateSecret: 'test-secret-32-chars-xxxxxxxxxxxxxxxxx',
      silentSsoSuppressCookieName: 'silent_sso',
    });

    const response = await loginHandler();

    expect(response.status).toBe(302);
    expect(mocks.getAuthConfig).toHaveBeenCalled();
  });

  it('evaluates silent SSO suppression when called with ?silent=1 and no active suppression', async () => {
    const { loginHandler } = await import('./auth-route-handlers.js');

    mocks.readCookieFromRequest.mockReturnValue(null);

    const response = await loginHandler(new Request('http://localhost/auth/login?silent=1'));

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('openid-connect/auth');
  });
});

describe('logoutHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isMockAuthEnabled.mockReturnValue(false);
  });

  it('redirects to /?auth=mock-logout in mock-auth mode', async () => {
    const { logoutHandler } = await import('./auth-route-handlers.js');

    mocks.isMockAuthEnabled.mockReturnValue(true);

    const response = await logoutHandler(new Request('http://localhost/auth/logout'));

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/?auth=mock-logout');
  });

  it('rejects logout requests that lack explicit logout intent', async () => {
    const { logoutHandler } = await import('./auth-route-handlers.js');

    const response = await logoutHandler(
      new Request('http://localhost/auth/logout', { method: 'POST' })
    );

    expect(response.status).toBe(400);
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'Logout rejected without explicit user intent',
      expect.objectContaining({ reason_code: 'missing_logout_intent' })
    );
  });
});

describe('callbackHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isMockAuthEnabled.mockReturnValue(false);
  });

  it('redirects to /?auth=mock-callback in mock-auth mode', async () => {
    const { callbackHandler } = await import('./auth-route-handlers.js');

    mocks.isMockAuthEnabled.mockReturnValue(true);

    const response = await callbackHandler(new Request('http://localhost/auth/callback?code=abc&state=xyz'));

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/?auth=mock-callback');
  });
});
