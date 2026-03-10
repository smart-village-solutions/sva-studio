import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionUser } from './types';

const getSessionUserMock = vi.fn<(_sessionId: string) => Promise<SessionUser | null>>();
const middlewareLogger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
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

describe('withAuthenticatedUser', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    workspaceContext.workspaceId = 'default';
    workspaceContext.requestId = 'req-middleware';
    workspaceContext.traceId = 'trace-middleware';
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
      instanceId: 'dev-local-1',
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
