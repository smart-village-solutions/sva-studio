import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionUser } from './types';

const getSessionUserMock = vi.fn<(_sessionId: string) => Promise<SessionUser | null>>();

vi.mock('./config', () => ({
  getAuthConfig: () => ({
    sessionCookieName: 'sva_auth_session',
  }),
}));

vi.mock('./auth.server', () => ({
  getSessionUser: getSessionUserMock,
}));

describe('withAuthenticatedUser', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 when session cookie is missing', async () => {
    const { withAuthenticatedUser } = await import('./middleware.server');
    const request = new Request('http://localhost/auth/me');

    const response = await withAuthenticatedUser(request, () => new Response('ok'));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
    expect(getSessionUserMock).not.toHaveBeenCalled();
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
});
