import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestContextMock = vi.fn(async (_ctx: unknown, callback: () => Promise<Response>) => callback());
const loggerMock = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => loggerMock,
  initializeOtelSdk: vi.fn(async () => undefined),
  withRequestContext: requestContextMock,
}));

vi.mock('../auth.server', () => ({
  createLoginUrl: vi.fn(),
  handleCallback: vi.fn(),
  logoutSession: vi.fn(),
}));

vi.mock('../audit-events.server', () => ({
  emitAuthAuditEvent: vi.fn(async () => undefined),
}));

vi.mock('../config', () => ({
  getAuthConfig: () => ({
    loginStateCookieName: 'sva_auth_state',
    loginStateSecret: 'secret',
    sessionCookieName: 'sva_auth_session',
    postLogoutRedirectUri: 'http://localhost:3000',
  }),
}));

vi.mock('../redis-session.server', () => ({
  getSession: vi.fn(),
}));

vi.mock('../shared/log-context', () => ({
  buildLogContext: vi.fn(() => ({ workspace_id: 'default' })),
}));

vi.mock('../middleware.server.js', () => ({
  withAuthenticatedUser: vi.fn(),
}));

describe('routes/handlers mock auth', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('SVA_MOCK_AUTH', 'true');
  });

  it('returns the mock user on /auth/me', async () => {
    const { meHandler } = await import('./handlers.js');

    const response = await meHandler(new Request('http://localhost/auth/me'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      user: {
        id: 'seed:system_admin',
        name: 'Mock User',
        email: 'mock.user@sva.local',
        instanceId: 'de-musterhausen',
        roles: ['system_admin', 'iam_admin', 'support_admin', 'security_admin', 'interface_manager', 'app_manager', 'editor'],
      },
    });
  });

  it('short-circuits /auth/login and /auth/logout in mock auth mode', async () => {
    const { loginHandler, logoutHandler } = await import('./handlers.js');

    const loginResponse = await loginHandler(new Request('http://localhost/auth/login'));
    const logoutResponse = await logoutHandler(new Request('http://localhost/auth/logout', { method: 'POST' }));

    expect(loginResponse.status).toBe(302);
    expect(loginResponse.headers.get('location')).toBe('/?auth=mock-login');
    expect(logoutResponse.status).toBe(302);
    expect(logoutResponse.headers.get('location')).toBe('/?auth=mock-logout');
  });
});
