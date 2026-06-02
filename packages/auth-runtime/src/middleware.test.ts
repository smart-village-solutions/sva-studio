import { beforeEach, describe, expect, it, vi } from 'vitest';

type TestSessionUser = {
  id: string;
  name: string;
  roles: string[];
  instanceId?: string;
};

type SessionResolutionResult =
  | { kind: 'authenticated'; user: TestSessionUser | null; expiresAt?: number; freshReauthAt?: number }
  | { kind: 'invalid'; reason: string };

const getSessionUserMock = vi.hoisted(() =>
  vi.fn<(_sessionId: string) => Promise<SessionResolutionResult>>()
);
const middlewareLogger = vi.hoisted(() => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));
const authServerMocks = vi.hoisted(() => ({
  hasActiveMockAuthSession: vi.fn(() => false),
  createMockSessionUser: vi.fn(() => ({
    id: 'mock-user',
    name: 'Mock User',
    roles: ['admin'],
    instanceId: 'mock-instance',
  })),
  getAuthConfig: vi.fn(() => ({
    sessionCookieName: 'sva_auth_session',
  })),
  isMockAuthEnabled: vi.fn(() => false),
  resolveSessionUser: vi.fn(async (_request: Request, sessionUser: TestSessionUser) => sessionUser),
  shouldEnforceLegalTextCompliance: vi.fn(async () => false),
  validateTenantHost: vi.fn(async () => null as Response | null),
  withLegalTextCompliance: vi.fn(
    async (_instanceId: string, _userId: string, handler: () => Promise<Response> | Response) =>
      handler()
  ),
}));
const dbMocks = vi.hoisted(() => ({
  jsonResponse: vi.fn((status: number, payload: unknown, headers?: Record<string, string>) => {
    const responseHeaders = new Headers(headers);
    responseHeaders.set('Content-Type', 'application/json');
    return new Response(JSON.stringify(payload), { status, headers: responseHeaders });
  }),
  resolvePool: vi.fn(() => ({}) as object),
  withResolvedInstanceDb: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => middlewareLogger,
  getWorkspaceContext: () => ({
    requestId: 'req-auth-runtime',
    traceId: 'trace-auth-runtime',
    workspaceId: 'de-musterhausen',
  }),
}));

vi.mock('./middleware-hosts.js', () => ({
  resolveSessionUser: authServerMocks.resolveSessionUser,
  validateTenantHost: authServerMocks.validateTenantHost,
}));

vi.mock('./middleware-compliance.js', () => ({
  shouldEnforceLegalTextCompliance: authServerMocks.shouldEnforceLegalTextCompliance,
}));

vi.mock('./legal-text-enforcement.js', () => ({
  withLegalTextCompliance: authServerMocks.withLegalTextCompliance,
}));

vi.mock('./config.js', () => ({
  getAuthConfig: authServerMocks.getAuthConfig,
}));

vi.mock('./db.js', () => ({
  jsonResponse: dbMocks.jsonResponse,
  resolvePool: dbMocks.resolvePool,
  withResolvedInstanceDb: dbMocks.withResolvedInstanceDb,
}));

vi.mock('./mock-auth.js', () => ({
  DEV_AUTH_COOKIE_NAME: 'sva_dev_auth',
  createMockSessionUser: authServerMocks.createMockSessionUser,
  hasActiveMockAuthSession: authServerMocks.hasActiveMockAuthSession,
  isMockAuthEnabled: authServerMocks.isMockAuthEnabled,
}));

vi.mock('./auth-server/session.js', () => ({
  resolveSessionUser: getSessionUserMock,
}));

describe('auth-runtime withAuthenticatedUser', () => {
  let withAuthenticatedUser: typeof import('./middleware.js').withAuthenticatedUser;

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    authServerMocks.getAuthConfig.mockReturnValue({
      sessionCookieName: 'sva_auth_session',
    });
    authServerMocks.isMockAuthEnabled.mockReturnValue(false);
    authServerMocks.hasActiveMockAuthSession.mockReturnValue(false);
    authServerMocks.resolveSessionUser.mockImplementation(
      async (_request, sessionUser) => sessionUser
    );
    authServerMocks.shouldEnforceLegalTextCompliance.mockResolvedValue(false);
    authServerMocks.validateTenantHost.mockResolvedValue(null);
    authServerMocks.withLegalTextCompliance.mockImplementation(
      async (_instanceId, _userId, handler) => handler()
    );
    dbMocks.resolvePool.mockReturnValue({} as object);
    dbMocks.withResolvedInstanceDb.mockImplementation(async (_resolvePool, _instanceId, work) =>
      work({
        query: vi.fn(async () => ({
          rowCount: 1,
          rows: [{ deletion_lifecycle_state: 'active' }],
        })),
      })
    );
    getSessionUserMock.mockResolvedValue({
      kind: 'authenticated',
      user: {
        id: 'user-1',
        name: 'Max',
        roles: ['admin'],
        instanceId: 'de-musterhausen',
      },
    });
  });

  beforeEach(async () => {
    ({ withAuthenticatedUser } = await import('./middleware.js'));
  });

  it('rejects requests without a session cookie before reading the session store', async () => {
    const response = await withAuthenticatedUser(
      new Request('http://localhost/auth/me'),
      () => new Response('ok')
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'unauthorized',
        message: 'Anmeldung erforderlich.',
        classification: 'session_store_or_session_hydration',
        recommendedAction: 'erneut_anmelden',
        status: 'recovery_laeuft',
        safeDetails: {
          reason_code: 'missing_session_cookie',
        },
        details: {
          reason_code: 'missing_session_cookie',
        },
      },
      requestId: 'req-auth-runtime',
    });
    expect(getSessionUserMock).not.toHaveBeenCalled();
    expect(middlewareLogger.debug).toHaveBeenCalledWith(
      'Auth middleware rejected request without session cookie',
      expect.objectContaining({
        auth_state: 'unauthenticated',
        request_id: 'req-auth-runtime',
        trace_id: 'trace-auth-runtime',
      })
    );
  });

  it('rejects invalid sessions', async () => {
    getSessionUserMock.mockResolvedValue({ kind: 'invalid', reason: 'invalid_session' });
    const request = new Request('http://localhost/auth/me', {
      headers: { cookie: 'sva_auth_session=session-1' },
    });

    const response = await withAuthenticatedUser(request, () => new Response('ok'));

    expect(getSessionUserMock).toHaveBeenCalledWith('session-1');
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'unauthorized',
        message: 'Die Sitzung ist nicht mehr gültig.',
        classification: 'session_store_or_session_hydration',
        recommendedAction: 'erneut_anmelden',
        status: 'recovery_laeuft',
        safeDetails: {
          reason_code: 'invalid_session',
        },
        details: {
          reason_code: 'invalid_session',
        },
      },
      requestId: 'req-auth-runtime',
    });
    expect(middlewareLogger.warn).toHaveBeenCalledWith(
      'Auth middleware rejected request with invalid session',
      expect.objectContaining({
        auth_state: 'invalid_session',
        request_id: 'req-auth-runtime',
        trace_id: 'trace-auth-runtime',
      })
    );
  });

  it('passes the authenticated runtime session context to the protected handler', async () => {
    getSessionUserMock.mockResolvedValue({
      kind: 'authenticated',
      user: {
        id: 'user-1',
        name: 'Max',
        roles: ['admin'],
        instanceId: 'de-musterhausen',
      },
      expiresAt: 1_800_000_000_000,
      freshReauthAt: 1_700_000_000_000,
    });
    const request = new Request('http://localhost/auth/me', {
      headers: { cookie: 'sva_auth_session=session-2' },
    });
    dbMocks.withResolvedInstanceDb.mockImplementationOnce(async (_resolvePool, _instanceId, work) =>
      work({
        query: vi.fn(async () => ({
          rowCount: 1,
          rows: [{ role_key: 'system_admin' }],
        })),
      })
    );

    const response = await withAuthenticatedUser(request, ({ sessionId, sessionExpiresAt, freshReauthAt, user }) =>
      Response.json({ sessionId, sessionExpiresAt, freshReauthAt, userId: user.id, roles: user.roles })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sessionId: 'session-2',
      sessionExpiresAt: 1_800_000_000_000,
      freshReauthAt: 1_700_000_000_000,
      userId: 'user-1',
      roles: ['admin', 'system_admin'],
    });
    expect(authServerMocks.resolveSessionUser).toHaveBeenCalledWith(
      request,
      expect.objectContaining({ id: 'user-1' })
    );
    expect(dbMocks.withResolvedInstanceDb).toHaveBeenCalledTimes(1);
  });

  it('logs middleware timing diagnostics when authorize timing debug is enabled', async () => {
    vi.stubEnv('IAM_DEBUG_AUTHORIZE_TIMINGS', 'true');
    const request = new Request('http://localhost/iam/authorize', {
      headers: { cookie: 'sva_auth_session=session-2' },
    });

    const response = await withAuthenticatedUser(request, () => new Response('ok'));

    expect(response.status).toBe(200);
    expect(middlewareLogger.info).toHaveBeenCalledWith(
      'Auth middleware timing diagnostics',
      expect.objectContaining({
        operation: 'auth_middleware_timing',
        endpoint: '/iam/authorize',
        user_id: 'user-1',
        instance_id: 'de-musterhausen',
      })
    );
  });

  it('keeps authenticated requests alive when effective role hydration fails', async () => {
    const request = new Request('http://localhost/auth/me', {
      headers: { cookie: 'sva_auth_session=session-2' },
    });

    dbMocks.withResolvedInstanceDb.mockImplementationOnce(async () => {
      throw new Error('IAM database not configured');
    });
    const response = await withAuthenticatedUser(request, () => new Response('ok'));

    expect(response.status).toBe(200);
    expect(dbMocks.withResolvedInstanceDb).toHaveBeenCalledTimes(1);
  });

  it('accepts requests with an active local dev auth cookie in dev auth mode', async () => {
    authServerMocks.isMockAuthEnabled.mockReturnValue(true);
    authServerMocks.hasActiveMockAuthSession.mockReturnValue(true);

    const response = await withAuthenticatedUser(
      new Request('http://localhost/auth/me'),
      ({ user, sessionId, isLocalDevelopmentAuth }) =>
        new Response(JSON.stringify({ sessionId, isLocalDevelopmentAuth, user }), {
          headers: { 'content-type': 'application/json' },
        })
    );

    expect(getSessionUserMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      sessionId: 'mock-auth-session',
      isLocalDevelopmentAuth: true,
      user: {
        id: 'mock-user',
        name: 'Mock User',
        roles: ['admin'],
        instanceId: 'mock-instance',
      },
    });
    expect(dbMocks.withResolvedInstanceDb).not.toHaveBeenCalled();
  });

  it('relies on revoked sessions instead of lifecycle row checks for blocked accounts', async () => {
    const request = new Request('http://localhost/auth/me', {
      headers: { cookie: 'sva_auth_session=session-4' },
    });
    getSessionUserMock.mockResolvedValueOnce({ kind: 'invalid', reason: 'forced_reauth' });

    const response = await withAuthenticatedUser(request, () => new Response('ok'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'unauthorized',
        message: 'Die Sitzung ist nicht mehr gültig.',
        safeDetails: {
          reason_code: 'forced_reauth',
        },
        details: {
          reason_code: 'forced_reauth',
        },
      },
      requestId: 'req-auth-runtime',
    });
    expect(middlewareLogger.warn).toHaveBeenCalledWith(
      'Auth middleware rejected request because the session requires reauthentication',
      expect.objectContaining({
        reason_code: 'forced_reauth',
      })
    );
    expect(dbMocks.withResolvedInstanceDb).not.toHaveBeenCalled();
  });

  it('runs protected handlers through legal text compliance for tenant users when required', async () => {
    getSessionUserMock.mockResolvedValue({
      kind: 'authenticated',
      user: {
        id: 'user-2',
        name: 'Erika',
        roles: ['editor'],
        instanceId: 'de-musterhausen',
      },
    });
    authServerMocks.shouldEnforceLegalTextCompliance.mockResolvedValue(true);
    const request = new Request('http://localhost/api/v1/iam/users/me/profile?tab=account', {
      headers: { cookie: 'sva_auth_session=session-3' },
    });

    const response = await withAuthenticatedUser(request, () => Response.json({ ok: true }));

    expect(response.status).toBe(200);
    expect(authServerMocks.withLegalTextCompliance).toHaveBeenCalledWith(
      'de-musterhausen',
      'user-2',
      expect.any(Function),
      { returnTo: '/api/v1/iam/users/me/profile?tab=account' }
    );
  });
});
