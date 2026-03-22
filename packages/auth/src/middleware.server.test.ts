import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionUser } from './types';

const getSessionUserMock = vi.fn<(_sessionId: string) => Promise<SessionUser | null>>();
const middlewareLogger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
const withLegalTextComplianceMock = vi.hoisted(() => vi.fn());
const workspaceContext = vi.hoisted(() => ({
  workspaceId: 'default',
  requestId: 'req-middleware',
  traceId: 'trace-middleware',
}));

vi.mock('./config', () => ({
  getAuthConfig: () => ({
    sessionCookieName: 'sva_auth_session',
  }),
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => middlewareLogger,
  getWorkspaceContext: () => workspaceContext,
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

vi.mock('./auth.server', () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock('./legal-text-enforcement.server', () => ({
  withLegalTextCompliance: withLegalTextComplianceMock,
}));

describe('withAuthenticatedUser', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
    workspaceContext.workspaceId = 'default';
    workspaceContext.requestId = 'req-middleware';
    workspaceContext.traceId = 'trace-middleware';
    withLegalTextComplianceMock.mockImplementation(
      async (_instanceId: string, _keycloakSubject: string, handler: () => Promise<Response>) => handler()
    );
  });

  it('returns 401 when session cookie is missing', async () => {
    const { withAuthenticatedUser } = await import('./middleware.server');
    const request = new Request('http://localhost/auth/me');

    const response = await withAuthenticatedUser(request, () => new Response('ok'));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
    expect(getSessionUserMock).not.toHaveBeenCalled();
    expect(middlewareLogger.debug).toHaveBeenCalledWith(
      'Auth middleware rejected request without session cookie',
      expect.objectContaining({
        auth_state: 'unauthenticated',
        request_id: 'req-middleware',
        trace_id: 'trace-middleware',
      })
    );
  });

  it('returns 401 when session is invalid', async () => {
    getSessionUserMock.mockResolvedValue(null);
    const { withAuthenticatedUser } = await import('./middleware.server');
    const request = new Request('http://localhost/auth/me', {
      headers: { cookie: 'sva_auth_session=session-1' },
    });

    const response = await withAuthenticatedUser(request, () => new Response('ok'));

    expect(getSessionUserMock).toHaveBeenCalledWith('session-1');
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
    expect(middlewareLogger.warn).toHaveBeenCalledWith(
      'Auth middleware rejected request with invalid session',
      expect.objectContaining({
        auth_state: 'invalid_session',
        request_id: 'req-middleware',
        trace_id: 'trace-middleware',
      })
    );
  });

  it('passes authenticated user to handler', async () => {
    getSessionUserMock.mockResolvedValue({
      id: 'user-1',
      name: 'Max',
      roles: ['admin'],
      instanceId: 'de-musterhausen',
    });
    const { withAuthenticatedUser } = await import('./middleware.server');
    const request = new Request('http://localhost/auth/me', {
      headers: { cookie: 'sva_auth_session=session-2' },
    });

    const response = await withAuthenticatedUser(request, ({ sessionId, user }) =>
      new Response(JSON.stringify({ sessionId, userId: user.id }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sessionId: 'session-2', userId: 'user-1' });
  });

  it('enforces legal text compliance on protected IAM routes', async () => {
    getSessionUserMock.mockResolvedValue({
      id: 'user-2',
      name: 'Erika',
      roles: ['admin'],
      instanceId: 'de-musterhausen',
    });
    const { withAuthenticatedUser } = await import('./middleware.server');
    const request = new Request('http://localhost/api/v1/iam/users', {
      headers: { cookie: 'sva_auth_session=session-legal-1' },
    });

    const response = await withAuthenticatedUser(request, () => new Response('ok'));

    expect(response.status).toBe(200);
    expect(withLegalTextComplianceMock).toHaveBeenCalledWith(
      'de-musterhausen',
      'user-2',
      expect.any(Function)
    );
  });

  it('skips legal text compliance for acceptance workflow operations', async () => {
    getSessionUserMock.mockResolvedValue({
      id: 'user-3',
      name: 'Jule',
      roles: ['admin'],
      instanceId: 'de-musterhausen',
    });
    const { withAuthenticatedUser } = await import('./middleware.server');
    const request = new Request('http://localhost/api/v1/iam/governance/workflows', {
      method: 'POST',
      headers: {
        cookie: 'sva_auth_session=session-legal-2',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: 'accept_legal_text',
        instanceId: 'de-musterhausen',
        payload: { legalTextVersionId: 'version-1' },
      }),
    });

    const response = await withAuthenticatedUser(request, () => new Response('ok'));

    expect(response.status).toBe(200);
    expect(withLegalTextComplianceMock).not.toHaveBeenCalled();
  });

  it('returns the configured mock user when mock auth is enabled', async () => {
    vi.stubEnv('SVA_MOCK_AUTH', 'true');
    const { withAuthenticatedUser } = await import('./middleware.server');
    const request = new Request('http://localhost/auth/me');

    const response = await withAuthenticatedUser(request, ({ sessionId, user }) =>
      new Response(JSON.stringify({ sessionId, user }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      sessionId: 'mock-auth-session',
      user: {
        id: 'seed:system_admin',
        name: 'Mock User',
        email: 'mock.user@sva.local',
        instanceId: 'de-musterhausen',
        roles: ['system_admin', 'iam_admin', 'support_admin', 'security_admin', 'interface_manager', 'app_manager', 'editor'],
      },
    });
    expect(getSessionUserMock).not.toHaveBeenCalled();
  });

  it('skips legal text compliance for exempt auth paths', async () => {
    getSessionUserMock.mockResolvedValue({
      id: 'user-auth-exempt',
      name: 'Exempt Auth',
      roles: ['admin'],
      instanceId: 'de-musterhausen',
    });
    const { withAuthenticatedUser } = await import('./middleware.server');
    const request = new Request('http://localhost/auth/login', {
      headers: { cookie: 'sva_auth_session=session-auth-exempt' },
    });

    const response = await withAuthenticatedUser(request, () => new Response('ok'));

    expect(response.status).toBe(200);
    expect(withLegalTextComplianceMock).not.toHaveBeenCalled();
  });

  it('skips legal text compliance for legal text admin endpoints', async () => {
    getSessionUserMock.mockResolvedValue({
      id: 'user-legal-admin',
      name: 'Legal Admin',
      roles: ['admin'],
      instanceId: 'de-musterhausen',
    });
    const { withAuthenticatedUser } = await import('./middleware.server');
    const request = new Request('http://localhost/api/v1/iam/legal-texts', {
      method: 'POST',
      headers: {
        cookie: 'sva_auth_session=session-legal-admin',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Nutzungsbestimmungen', legalTextVersion: '2' }),
    });

    const response = await withAuthenticatedUser(request, () => new Response('ok'));

    expect(response.status).toBe(200);
    expect(withLegalTextComplianceMock).not.toHaveBeenCalled();
  });

  it('skips legal text compliance for legal text admin detail endpoints', async () => {
    getSessionUserMock.mockResolvedValue({
      id: 'user-legal-admin-detail',
      name: 'Legal Admin Detail',
      roles: ['admin'],
      instanceId: 'de-musterhausen',
    });
    const { withAuthenticatedUser } = await import('./middleware.server');
    const request = new Request('http://localhost/api/v1/iam/legal-texts/version-123', {
      method: 'PATCH',
      headers: {
        cookie: 'sva_auth_session=session-legal-admin-detail',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Nutzungsbestimmungen 2' }),
    });

    const response = await withAuthenticatedUser(request, () => new Response('ok'));

    expect(response.status).toBe(200);
    expect(withLegalTextComplianceMock).not.toHaveBeenCalled();
  });

  it('enforces legal text compliance for non-exempt governance workflow operations', async () => {
    getSessionUserMock.mockResolvedValue({
      id: 'user-governance-enforced',
      name: 'Governance User',
      roles: ['admin'],
      instanceId: 'de-musterhausen',
    });
    const { withAuthenticatedUser } = await import('./middleware.server');
    const request = new Request('http://localhost/api/v1/iam/governance/workflows', {
      method: 'POST',
      headers: {
        cookie: 'sva_auth_session=session-governance-enforced',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ operation: 'approve_access_request' }),
    });

    const response = await withAuthenticatedUser(request, () => new Response('ok'));

    expect(response.status).toBe(200);
    expect(withLegalTextComplianceMock).toHaveBeenCalledWith(
      'de-musterhausen',
      'user-governance-enforced',
      expect.any(Function)
    );
  });

  it('enforces legal text compliance for iam authorize endpoint', async () => {
    getSessionUserMock.mockResolvedValue({
      id: 'user-authorize',
      name: 'Authorize User',
      roles: ['admin'],
      instanceId: 'de-musterhausen',
    });
    const { withAuthenticatedUser } = await import('./middleware.server');
    const request = new Request('http://localhost/iam/authorize', {
      method: 'POST',
      headers: {
        cookie: 'sva_auth_session=session-authorize',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'content.read' }),
    });

    const response = await withAuthenticatedUser(request, () => new Response('ok'));

    expect(response.status).toBe(200);
    expect(withLegalTextComplianceMock).toHaveBeenCalledWith(
      'de-musterhausen',
      'user-authorize',
      expect.any(Function)
    );
  });

  it('returns legal text enforcement errors unchanged on protected routes', async () => {
    getSessionUserMock.mockResolvedValue({
      id: 'user-enforcement-error',
      name: 'Enforcement Error',
      roles: ['admin'],
      instanceId: 'de-musterhausen',
    });
    withLegalTextComplianceMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'service_unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const { withAuthenticatedUser } = await import('./middleware.server');
    const request = new Request('http://localhost/api/v1/iam/users', {
      headers: { cookie: 'sva_auth_session=session-enforcement-error' },
    });

    const response = await withAuthenticatedUser(request, () => new Response('ok'));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'service_unavailable' });
    expect(withLegalTextComplianceMock).toHaveBeenCalledWith(
      'de-musterhausen',
      'user-enforcement-error',
      expect.any(Function)
    );
  });

  it('returns a flat json 500 and logs correlation ids when session resolution throws', async () => {
    getSessionUserMock.mockRejectedValue(new Error('boom'));
    const { withAuthenticatedUser } = await import('./middleware.server');
    const request = new Request('http://localhost/auth/me', {
      headers: { cookie: 'sva_auth_session=session-3' },
    });

    const response = await withAuthenticatedUser(request, () => new Response('ok'));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'internal_error',
      message: 'Authentifizierungsfehler.',
      requestId: 'req-middleware',
    });
    expect(middlewareLogger.error).toHaveBeenCalledWith(
      'Auth middleware failed unexpectedly',
      expect.objectContaining({
        request_id: 'req-middleware',
        trace_id: 'trace-middleware',
        error_type: 'Error',
        error_message: 'boom',
      })
    );
  });

  it('logs undefined correlation ids without follow-up failures when request context is missing', async () => {
    getSessionUserMock.mockRejectedValue('boom');
    workspaceContext.requestId = undefined;
    workspaceContext.traceId = undefined;
    const { withAuthenticatedUser } = await import('./middleware.server');
    const request = new Request('http://localhost/auth/me', {
      headers: { cookie: 'sva_auth_session=session-4' },
    });

    const response = await withAuthenticatedUser(request, () => new Response('ok'));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'internal_error',
      message: 'Authentifizierungsfehler.',
    });
    expect(middlewareLogger.error).toHaveBeenCalledWith(
      'Auth middleware failed unexpectedly',
      expect.objectContaining({
        request_id: undefined,
        trace_id: undefined,
        error_type: 'string',
        error_message: 'boom',
      })
    );
  });
});
