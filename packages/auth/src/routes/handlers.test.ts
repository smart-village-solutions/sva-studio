import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';

const requestContextMock = vi.fn(async (_ctx: unknown, callback: () => Promise<Response>) => callback());
const loggerMock = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};
const getSessionMock = vi.fn();
const logoutSessionMock = vi.fn();
const emitAuthAuditEventMock = vi.fn(async () => undefined);
const createLoginUrlMock = vi.fn();
const handleCallbackMock = vi.fn();

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => loggerMock,
  initializeOtelSdk: vi.fn(async () => ({ status: 'ready' as const })),
  withRequestContext: requestContextMock,
}));

vi.mock('../auth.server', () => ({
  createLoginUrl: createLoginUrlMock,
  handleCallback: handleCallbackMock,
  logoutSession: logoutSessionMock,
}));

vi.mock('../audit-events.server', () => ({
  emitAuthAuditEvent: emitAuthAuditEventMock,
}));

vi.mock('../config', () => ({
  getAuthConfig: () => ({
    loginStateCookieName: 'sva_auth_state',
    loginStateSecret: 'secret',
    sessionCookieName: 'sva_auth_session',
    silentSsoSuppressCookieName: 'sva_auth_silent_sso',
    silentSsoSuppressAfterLogoutMs: 60_000,
    postLogoutRedirectUri: 'http://localhost:3000',
  }),
}));

vi.mock('../redis-session.server', () => ({
  getSession: getSessionMock,
}));

vi.mock('../shared/log-context', () => ({
  buildLogContext: vi.fn(() => ({ workspace_id: 'default' })),
}));

vi.mock('../middleware.server.js', () => ({
  withAuthenticatedUser: vi.fn(),
}));

describe('routes/handlers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('SVA_MOCK_AUTH', 'false');
    vi.stubEnv('NODE_ENV', 'development');
  });

  it('logs only a summarized logout redirect target', async () => {
    getSessionMock.mockResolvedValue({
      user: {
        id: 'user-1',
        instanceId: 'de-musterhausen',
        roles: ['editor'],
      },
    });
    logoutSessionMock.mockResolvedValue(
      'https://issuer.example/logout?id_token_hint=eyJhbGciOiJub25lIn0.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5vcmcifQ.signature&post_logout_redirect_uri=http://localhost:3000'
    );

    const { logoutHandler } = await import('./handlers.js');

    const response = await logoutHandler(
      new Request('http://localhost/auth/logout', {
        method: 'POST',
        headers: { cookie: 'sva_auth_session=session-1' },
      })
    );

    expect(response.status).toBe(302);
    expect(loggerMock.info).toHaveBeenCalledWith(
      'Logout successful',
      expect.objectContaining({
        redirect_target_origin: 'https://issuer.example',
        redirect_target_path: '/logout',
        has_sensitive_query: true,
      })
    );

    const loggedMetadata = loggerMock.info.mock.calls.find(([message]) => message === 'Logout successful')?.[1];
    expect(JSON.stringify(loggedMetadata)).not.toContain('id_token_hint');
    expect(JSON.stringify(loggedMetadata)).not.toContain('test@example.org');
    expect(emitAuthAuditEventMock).toHaveBeenCalledTimes(1);
  });

  it('stores a sanitized returnTo path in the login state cookie', async () => {
    createLoginUrlMock.mockResolvedValue({
      url: 'https://issuer.example/auth',
      state: 'state-1',
      loginState: {
        codeVerifier: 'verifier-1',
        nonce: 'nonce-1',
        createdAt: Date.now(),
        returnTo: '/account?tab=profile',
        silent: false,
      },
    });

    const { loginHandler } = await import('./handlers.js');

    const response = await loginHandler(new Request('http://localhost/auth/login?returnTo=%2Faccount%3Ftab%3Dprofile'));

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://issuer.example/auth');
    const encodedCookie = (response.headers.get('set-cookie') ?? '').split(';')[0]?.split('=')[1];
    const encodedPayload = encodedCookie?.split('.')[0];
    const decodedPayload = encodedPayload ? JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) : null;

    expect(decodedPayload).toEqual(
      expect.objectContaining({
        returnTo: '/account?tab=profile',
      })
    );
  });

  it('returns a silent failure response when silent SSO is suppressed', async () => {
    const { loginHandler } = await import('./handlers.js');

    const response = await loginHandler(
      new Request('http://localhost/auth/login?silent=1', {
        headers: { cookie: `sva_auth_silent_sso=${Date.now() + 60_000}` },
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(createLoginUrlMock).not.toHaveBeenCalled();
  });

  it('redirects the callback to the original page after login', async () => {
    handleCallbackMock.mockResolvedValue({
      sessionId: 'session-1',
      expiresAt: Date.now() + 60_000,
      user: {
        id: 'user-1',
        instanceId: 'de-musterhausen',
        roles: ['editor'],
      },
    });

    const { callbackHandler } = await import('./handlers.js');
    const statePayload = {
      state: 'state-1',
      codeVerifier: 'verifier-1',
      nonce: 'nonce-1',
      createdAt: Date.now(),
      returnTo: '/account?tab=profile',
    };
    const encodedPayload = Buffer.from(JSON.stringify(statePayload), 'utf8').toString('base64url');
    const signature = createHmac('sha256', 'secret').update(encodedPayload).digest('base64url');

    const response = await callbackHandler(
      new Request('http://localhost/auth/callback?code=abc&state=state-1', {
        headers: { cookie: `sva_auth_state=${encodedPayload}.${signature}` },
      })
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/account?tab=profile');
    expect(handleCallbackMock).toHaveBeenCalledTimes(1);
    expect(loggerMock.info).toHaveBeenCalledWith(
      'Auth callback successful',
      expect.objectContaining({
        redirect_target: '/account?tab=profile',
      })
    );
  });

  it('returns an iframe-safe response for successful silent callback logins', async () => {
    handleCallbackMock.mockResolvedValue({
      sessionId: 'session-1',
      expiresAt: Date.now() + 60_000,
      user: {
        id: 'user-1',
        instanceId: 'de-musterhausen',
        roles: ['editor'],
      },
      loginState: {
        state: 'state-1',
        codeVerifier: 'verifier-1',
        nonce: 'nonce-1',
        createdAt: Date.now(),
        returnTo: '/',
        silent: true,
      },
    });

    const { callbackHandler } = await import('./handlers.js');
    const statePayload = {
      state: 'state-1',
      codeVerifier: 'verifier-1',
      nonce: 'nonce-1',
      createdAt: Date.now(),
      returnTo: '/',
      silent: true,
    };
    const encodedPayload = Buffer.from(JSON.stringify(statePayload), 'utf8').toString('base64url');
    const signature = createHmac('sha256', 'secret').update(encodedPayload).digest('base64url');

    const response = await callbackHandler(
      new Request('http://localhost/auth/callback?code=abc&state=state-1', {
        headers: { cookie: `sva_auth_state=${encodedPayload}.${signature}` },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain('sva-auth:silent-sso');
  });
});
