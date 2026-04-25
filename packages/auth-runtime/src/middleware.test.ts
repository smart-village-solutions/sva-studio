import { beforeEach, describe, expect, it, vi } from 'vitest';

type TestSessionUser = {
  id: string;
  name: string;
  roles: string[];
  instanceId?: string;
};

const getSessionUserMock = vi.hoisted(() => vi.fn<(_sessionId: string) => Promise<TestSessionUser | null>>());
const middlewareLogger = vi.hoisted(() => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));
const authServerMocks = vi.hoisted(() => ({
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
    async (_instanceId: string, _userId: string, handler: () => Promise<Response> | Response) => handler()
  ),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => middlewareLogger,
  getWorkspaceContext: () => ({
    requestId: 'req-auth-runtime',
    traceId: 'trace-auth-runtime',
    workspaceId: 'de-musterhausen',
  }),
  toJsonErrorResponse: (status: number, code: string, publicMessage?: string, options?: { requestId?: string }) =>
    new Response(
      JSON.stringify({
        error: code,
        ...(publicMessage ? { message: publicMessage } : {}),
        ...(options?.requestId ? { requestId: options.requestId } : {}),
      }),
      {
        status,
        headers: {
          'Content-Type': 'application/json',
          ...(options?.requestId ? { 'X-Request-Id': options.requestId } : {}),
        },
      }
    ),
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

vi.mock('./mock-auth.js', () => ({
  createMockSessionUser: authServerMocks.createMockSessionUser,
  isMockAuthEnabled: authServerMocks.isMockAuthEnabled,
}));

vi.mock('./auth-server/session.js', () => ({
  getSessionUser: getSessionUserMock,
}));

describe('auth-runtime withAuthenticatedUser', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authServerMocks.getAuthConfig.mockReturnValue({
      sessionCookieName: 'sva_auth_session',
    });
    authServerMocks.isMockAuthEnabled.mockReturnValue(false);
    authServerMocks.resolveSessionUser.mockImplementation(async (_request, sessionUser) => sessionUser);
    authServerMocks.shouldEnforceLegalTextCompliance.mockResolvedValue(false);
    authServerMocks.validateTenantHost.mockResolvedValue(null);
    authServerMocks.withLegalTextCompliance.mockImplementation(async (_instanceId, _userId, handler) => handler());
  });

  it('rejects requests without a session cookie before reading the session store', async () => {
    const { withAuthenticatedUser } = await import('./middleware.js');
    const response = await withAuthenticatedUser(new Request('http://localhost/auth/me'), () => new Response('ok'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
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
    getSessionUserMock.mockResolvedValue(null);
    const { withAuthenticatedUser } = await import('./middleware.js');
    const request = new Request('http://localhost/auth/me', {
      headers: { cookie: 'sva_auth_session=session-1' },
    });

    const response = await withAuthenticatedUser(request, () => new Response('ok'));

    expect(getSessionUserMock).toHaveBeenCalledWith('session-1');
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
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
      id: 'user-1',
      name: 'Max',
      roles: ['admin'],
      instanceId: 'de-musterhausen',
    });
    const { withAuthenticatedUser } = await import('./middleware.js');
    const request = new Request('http://localhost/auth/me', {
      headers: { cookie: 'sva_auth_session=session-2' },
    });

    const response = await withAuthenticatedUser(request, ({ sessionId, user }) =>
      Response.json({ sessionId, userId: user.id })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ sessionId: 'session-2', userId: 'user-1' });
    expect(authServerMocks.resolveSessionUser).toHaveBeenCalledWith(
      request,
      expect.objectContaining({ id: 'user-1' })
    );
  });

  it('runs protected handlers through legal text compliance for tenant users when required', async () => {
    getSessionUserMock.mockResolvedValue({
      id: 'user-2',
      name: 'Erika',
      roles: ['editor'],
      instanceId: 'de-musterhausen',
    });
    authServerMocks.shouldEnforceLegalTextCompliance.mockResolvedValue(true);
    const { withAuthenticatedUser } = await import('./middleware.js');
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
