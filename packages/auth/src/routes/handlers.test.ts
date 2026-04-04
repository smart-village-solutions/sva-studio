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
const withAuthenticatedUserMock = vi.fn();
const loadInstanceByHostnameMock = vi.fn();
const resolvedAuthConfigState = {
  loginStateCookieName: 'sva_auth_state',
  loginStateSecret: 'secret',
  sessionCookieName: 'sva_auth_session',
  silentSsoSuppressCookieName: 'sva_auth_silent_sso',
  silentSsoSuppressAfterLogoutMs: 60_000,
  postLogoutRedirectUri: 'http://localhost:3000',
  redirectUri: 'http://localhost:3000/auth/callback',
  issuer: 'https://issuer.example',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  scopes: 'openid',
  sessionTtlMs: 60 * 60 * 1000,
  sessionRedisTtlBufferMs: 5 * 60 * 1000,
};
const instanceConfigState = {
  canonicalAuthHost: 'studio.example.org',
  parentDomain: 'studio.example.org',
};

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => loggerMock,
  getInstanceConfig: () => instanceConfigState,
  initializeOtelSdk: vi.fn(async () => ({ status: 'ready' as const })),
  isCanonicalAuthHost: (host: string) => {
    const normalized = host.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
    return normalized === instanceConfigState.canonicalAuthHost;
  },
  withRequestContext: requestContextMock,
}));

vi.mock('@sva/data/server', () => ({
  loadInstanceByHostname: loadInstanceByHostnameMock,
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
  resolveAuthConfigForRequest: vi.fn(async () => ({ ...resolvedAuthConfigState })),
}));

vi.mock('../redis-session.server', () => ({
  getSession: getSessionMock,
}));

vi.mock('../shared/log-context', () => ({
  buildLogContext: vi.fn(() => ({ workspace_id: 'default' })),
}));

vi.mock('../middleware.server.js', () => ({
  withAuthenticatedUser: withAuthenticatedUserMock,
}));

describe('routes/handlers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('SVA_MOCK_AUTH', 'false');
    vi.stubEnv('NODE_ENV', 'development');
    loadInstanceByHostnameMock.mockResolvedValue(null);
    resolvedAuthConfigState.instanceId = undefined;
    resolvedAuthConfigState.authRealm = undefined;
    resolvedAuthConfigState.clientId = 'client-id';
    resolvedAuthConfigState.redirectUri = 'http://localhost:3000/auth/callback';
    resolvedAuthConfigState.issuer = 'https://issuer.example';
    instanceConfigState.canonicalAuthHost = 'studio.example.org';
    instanceConfigState.parentDomain = 'studio.example.org';
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

  it('logs the resolved auth config for login requests', async () => {
    resolvedAuthConfigState.instanceId = 'bb-guben';
    resolvedAuthConfigState.authRealm = 'bb-guben';
    resolvedAuthConfigState.clientId = 'sva-studio';
    resolvedAuthConfigState.redirectUri = 'https://bb-guben.studio.example.org/auth/callback';
    resolvedAuthConfigState.issuer = 'https://keycloak.example/realms/bb-guben';
    createLoginUrlMock.mockResolvedValue({
      url: 'https://issuer.example/auth',
      state: 'state-log-auth-config',
      loginState: {
        codeVerifier: 'verifier-log-auth-config',
        nonce: 'nonce-log-auth-config',
        createdAt: Date.now(),
        returnTo: '/',
        silent: false,
      },
    });

    const { loginHandler } = await import('./handlers.js');

    await loginHandler(new Request('https://bb-guben.studio.example.org/auth/login'));

    expect(loggerMock.info).toHaveBeenCalledWith(
      'Login auth config resolved',
      expect.objectContaining({
        operation: 'login_auth_config_resolved',
        auth_instance_id: 'bb-guben',
        auth_realm: 'bb-guben',
        auth_client_id: 'sva-studio',
        auth_redirect_uri: 'https://bb-guben.studio.example.org/auth/callback',
        auth_issuer: 'https://keycloak.example/realms/bb-guben',
      })
    );
  });

  it('attaches debug auth headers for login requests when enabled', async () => {
    vi.stubEnv('SVA_AUTH_DEBUG_HEADERS', 'true');
    resolvedAuthConfigState.instanceId = 'bb-guben';
    resolvedAuthConfigState.authRealm = 'bb-guben';
    resolvedAuthConfigState.clientId = 'sva-studio';
    resolvedAuthConfigState.redirectUri = 'https://bb-guben.studio.example.org/auth/callback';
    resolvedAuthConfigState.issuer = 'https://keycloak.example/realms/bb-guben';
    createLoginUrlMock.mockResolvedValue({
      url: 'https://issuer.example/auth',
      state: 'state-debug-headers',
      loginState: {
        codeVerifier: 'verifier-debug-headers',
        nonce: 'nonce-debug-headers',
        createdAt: Date.now(),
        returnTo: '/',
        silent: false,
      },
    });

    const { loginHandler } = await import('./handlers.js');

    const response = await loginHandler(new Request('https://bb-guben.studio.example.org/auth/login'));

    expect(response.headers.get('x-sva-debug-request-host')).toBe('bb-guben.studio.example.org');
    expect(response.headers.get('x-sva-debug-request-origin')).toBe('https://bb-guben.studio.example.org');
    expect(response.headers.get('x-sva-debug-auth-instance-id')).toBe('bb-guben');
    expect(response.headers.get('x-sva-debug-auth-realm')).toBe('bb-guben');
    expect(response.headers.get('x-sva-debug-auth-client-id')).toBe('sva-studio');
    expect(response.headers.get('x-sva-debug-auth-redirect-uri')).toBe(
      'https://bb-guben.studio.example.org/auth/callback'
    );
  });

  it('emits callback failure audit events with the tenant workspace id', async () => {
    resolvedAuthConfigState.instanceId = 'de-musterhausen';
    resolvedAuthConfigState.authRealm = 'de-musterhausen';
    resolvedAuthConfigState.clientId = 'sva-studio';
    resolvedAuthConfigState.redirectUri = 'https://de-musterhausen.studio.example.org/auth/callback';
    handleCallbackMock.mockRejectedValueOnce(new Error('invalid_client'));

    const { callbackHandler } = await import('./handlers.js');

    const secret = 'secret';
    const payload = {
      state: 'state-failure',
      codeVerifier: 'verifier-failure',
      nonce: 'nonce-failure',
      createdAt: Date.now(),
      returnTo: '/',
      silent: false,
      workspaceId: 'de-musterhausen',
    };
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', secret).update(payloadBase64).digest('base64url');
    const cookie = `sva_auth_state=${payloadBase64}.${signature}`;

    const response = await callbackHandler(
      new Request('https://de-musterhausen.studio.example.org/auth/callback?code=code-1&state=state-failure', {
        headers: { cookie },
      })
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/?auth=error');
    expect(emitAuthAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'login',
        outcome: 'failure',
        workspaceId: 'de-musterhausen',
      })
    );
  });

  it('starts tenant-host login locally on the tenant host', async () => {
    createLoginUrlMock.mockResolvedValue({
      url: 'https://issuer.example/auth',
      state: 'state-tenant-login',
      loginState: {
        codeVerifier: 'verifier-tenant-login',
        nonce: 'nonce-tenant-login',
        createdAt: Date.now(),
        returnTo: '/admin/instances',
        silent: false,
      },
    });
    const { loginHandler } = await import('./handlers.js');

    const response = await loginHandler(
      new Request('https://hb.studio.example.org/auth/login?returnTo=%2Fadmin%2Finstances')
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://issuer.example/auth');
    expect(createLoginUrlMock).toHaveBeenCalled();
  });

  it('allows trusted tenant return targets on the canonical auth host', async () => {
    loadInstanceByHostnameMock.mockResolvedValue({
      instanceId: 'hb',
      displayName: 'HB',
      status: 'active',
      parentDomain: 'studio.example.org',
      primaryHostname: 'hb.studio.example.org',
      featureFlags: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    createLoginUrlMock.mockResolvedValue({
      url: 'https://issuer.example/auth',
      state: 'state-tenant',
      loginState: {
        codeVerifier: 'verifier-tenant',
        nonce: 'nonce-tenant',
        createdAt: Date.now(),
        returnTo: 'https://hb.studio.example.org/admin/instances',
        silent: false,
      },
    });

    const { loginHandler } = await import('./handlers.js');

    await loginHandler(
      new Request(
        'https://studio.example.org/auth/login?returnTo=https%3A%2F%2Fhb.studio.example.org%2Fadmin%2Finstances'
      )
    );

    expect(createLoginUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        returnTo: 'https://hb.studio.example.org/admin/instances',
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

  it('falls back to default returnTo when login returnTo points to auth or external targets', async () => {
    createLoginUrlMock.mockResolvedValue({
      url: 'https://issuer.example/auth',
      state: 'state-2',
      loginState: {
        codeVerifier: 'verifier-2',
        nonce: 'nonce-2',
        createdAt: Date.now(),
        returnTo: '/',
        silent: false,
      },
    });

    const { loginHandler } = await import('./handlers.js');

    await loginHandler(new Request('http://localhost/auth/login?returnTo=%2Fauth%2Fcallback'));
    await loginHandler(new Request('http://localhost/auth/login?returnTo=https%3A%2F%2Fevil.example'));
    await loginHandler(new Request('http://localhost/auth/login?returnTo=%2F%2Fevil.example'));

    expect(createLoginUrlMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ returnTo: '/' }));
    expect(createLoginUrlMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ returnTo: '/' }));
    expect(createLoginUrlMock).toHaveBeenNthCalledWith(3, expect.objectContaining({ returnTo: '/' }));
  });

  it('uses session cookie defaults when callback does not provide expiresAt', async () => {
    handleCallbackMock.mockResolvedValue({
      sessionId: 'session-no-expiry',
      user: {
        id: 'user-1',
        instanceId: 'de-musterhausen',
        roles: ['editor'],
      },
    });

    const { callbackHandler } = await import('./handlers.js');
    const statePayload = {
      state: 'state-no-expiry',
      codeVerifier: 'verifier-no-expiry',
      nonce: 'nonce-no-expiry',
      createdAt: Date.now(),
      returnTo: '/account',
    };
    const encodedPayload = Buffer.from(JSON.stringify(statePayload), 'utf8').toString('base64url');
    const signature = createHmac('sha256', 'secret').update(encodedPayload).digest('base64url');

    const response = await callbackHandler(
      new Request('http://localhost/auth/callback?code=abc&state=state-no-expiry', {
        headers: { cookie: `sva_auth_state=${encodedPayload}.${signature}` },
      })
    );

    expect(response.status).toBe(302);
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('sva_auth_session=session-no-expiry');
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

  it('redirects the callback back to a trusted tenant host after login', async () => {
    loadInstanceByHostnameMock.mockResolvedValue({
      instanceId: 'hb',
      displayName: 'HB',
      status: 'active',
      parentDomain: 'studio.example.org',
      primaryHostname: 'hb.studio.example.org',
      featureFlags: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    handleCallbackMock.mockResolvedValue({
      sessionId: 'session-tenant',
      expiresAt: Date.now() + 60_000,
      user: {
        id: 'user-tenant',
        instanceId: 'hb',
        roles: ['editor'],
      },
    });

    const { callbackHandler } = await import('./handlers.js');
    const statePayload = {
      state: 'state-tenant-callback',
      codeVerifier: 'verifier-tenant-callback',
      nonce: 'nonce-tenant-callback',
      createdAt: Date.now(),
      returnTo: 'https://hb.studio.example.org/admin/instances',
    };
    const encodedPayload = Buffer.from(JSON.stringify(statePayload), 'utf8').toString('base64url');
    const signature = createHmac('sha256', 'secret').update(encodedPayload).digest('base64url');

    const response = await callbackHandler(
      new Request('https://studio.example.org/auth/callback?code=abc&state=state-tenant-callback', {
        headers: { cookie: `sva_auth_state=${encodedPayload}.${signature}` },
      })
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://hb.studio.example.org/admin/instances');
  });

  it('falls back to root path when callback returnTo targets an untrusted host', async () => {
    handleCallbackMock.mockResolvedValue({
      sessionId: 'session-untrusted',
      expiresAt: Date.now() + 60_000,
      user: {
        id: 'user-untrusted',
        instanceId: 'hb',
        roles: ['editor'],
      },
    });

    const { callbackHandler } = await import('./handlers.js');
    const statePayload = {
      state: 'state-untrusted-callback',
      codeVerifier: 'verifier-untrusted-callback',
      nonce: 'nonce-untrusted-callback',
      createdAt: Date.now(),
      returnTo: 'https://evil.example/admin/instances',
    };
    const encodedPayload = Buffer.from(JSON.stringify(statePayload), 'utf8').toString('base64url');
    const signature = createHmac('sha256', 'secret').update(encodedPayload).digest('base64url');

    const response = await callbackHandler(
      new Request('https://studio.example.org/auth/callback?code=abc&state=state-untrusted-callback', {
        headers: { cookie: `sva_auth_state=${encodedPayload}.${signature}` },
      })
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/');
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

  it('returns silent callback failure response and clears login-state cookie when idp returns error', async () => {
    const { callbackHandler } = await import('./handlers.js');
    const statePayload = {
      state: 'state-err',
      codeVerifier: 'verifier-err',
      nonce: 'nonce-err',
      createdAt: Date.now(),
      returnTo: '/',
      silent: true,
    };
    const encodedPayload = Buffer.from(JSON.stringify(statePayload), 'utf8').toString('base64url');
    const signature = createHmac('sha256', 'secret').update(encodedPayload).digest('base64url');

    const response = await callbackHandler(
      new Request('http://localhost/auth/callback?state=state-err&error=access_denied', {
        headers: { cookie: `sva_auth_state=${encodedPayload}.${signature}` },
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('sva_auth_state=');
    await expect(response.text()).resolves.toContain("status: 'failure'");
    expect(emitAuthAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'silent_reauth_failed',
        outcome: 'failure',
      })
    );
  });

  it('redirects to /auth/login when callback misses code or state', async () => {
    const { callbackHandler } = await import('./handlers.js');

    const response = await callbackHandler(new Request('http://localhost/auth/callback?state=missing-code'));

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/auth/login');
  });

  it('redirects to state-expired when callback login-state cookie is stale', async () => {
    const { callbackHandler } = await import('./handlers.js');
    const stalePayload = {
      state: 'state-old',
      codeVerifier: 'verifier-old',
      nonce: 'nonce-old',
      createdAt: Date.now() - 11 * 60 * 1000,
      returnTo: '/account',
    };
    const encodedPayload = Buffer.from(JSON.stringify(stalePayload), 'utf8').toString('base64url');
    const signature = createHmac('sha256', 'secret').update(encodedPayload).digest('base64url');

    const response = await callbackHandler(
      new Request('http://localhost/auth/callback?code=abc&state=state-old', {
        headers: { cookie: `sva_auth_state=${encodedPayload}.${signature}` },
      })
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/?auth=state-expired');
    expect(response.headers.get('set-cookie')).toContain('sva_auth_state=');
    expect(emitAuthAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'login_state_expired',
        outcome: 'failure',
      })
    );
  });

  it('emits silent_reauth_failed audit event when silent callback processing throws', async () => {
    handleCallbackMock.mockRejectedValue({ code: 'token_invalid' });

    const { callbackHandler } = await import('./handlers.js');
    const statePayload = {
      state: 'state-fail',
      codeVerifier: 'verifier-fail',
      nonce: 'nonce-fail',
      createdAt: Date.now(),
      returnTo: '/',
      silent: true,
    };
    const encodedPayload = Buffer.from(JSON.stringify(statePayload), 'utf8').toString('base64url');
    const signature = createHmac('sha256', 'secret').update(encodedPayload).digest('base64url');

    const response = await callbackHandler(
      new Request('http://localhost/auth/callback?code=abc&state=state-fail', {
        headers: { cookie: `sva_auth_state=${encodedPayload}.${signature}` },
      })
    );

    expect(response.status).toBe(200);
    expect(loggerMock.warn).toHaveBeenCalled();
    expect(emitAuthAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'silent_reauth_failed',
        outcome: 'failure',
      })
    );
  });

  it('logs token callback failures with oauth error details when available', async () => {
    handleCallbackMock.mockRejectedValue({
      name: 'ResponseBodyError',
      error: 'invalid_client',
      error_description: 'Invalid client secret',
      response: { status: 401 },
    });

    const { callbackHandler } = await import('./handlers.js');
    const statePayload = {
      state: 'state-token-details',
      codeVerifier: 'verifier-token-details',
      nonce: 'nonce-token-details',
      createdAt: Date.now(),
      returnTo: '/',
      silent: false,
    };
    const encodedPayload = Buffer.from(JSON.stringify(statePayload), 'utf8').toString('base64url');
    const signature = createHmac('sha256', 'secret').update(encodedPayload).digest('base64url');

    const response = await callbackHandler(
      new Request('http://localhost/auth/callback?code=abc&state=state-token-details', {
        headers: { cookie: `sva_auth_state=${encodedPayload}.${signature}` },
      })
    );

    expect(response.status).toBe(302);
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'Token validation failed in callback',
      expect.objectContaining({
        oauth_error: 'invalid_client',
        oauth_error_description: 'Invalid client secret',
        oauth_status: 401,
      })
    );
  });

  it('logs callback errors for non-token failures and redirects to auth error', async () => {
    handleCallbackMock.mockRejectedValue(new Error('callback exploded'));

    const { callbackHandler } = await import('./handlers.js');
    const statePayload = {
      state: 'state-hard-error',
      codeVerifier: 'verifier-hard-error',
      nonce: 'nonce-hard-error',
      createdAt: Date.now(),
      returnTo: '/account',
      silent: false,
    };
    const encodedPayload = Buffer.from(JSON.stringify(statePayload), 'utf8').toString('base64url');
    const signature = createHmac('sha256', 'secret').update(encodedPayload).digest('base64url');

    const response = await callbackHandler(
      new Request('http://localhost/auth/callback?code=abc&state=state-hard-error', {
        headers: { cookie: `sva_auth_state=${encodedPayload}.${signature}` },
      })
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/?auth=error');
    expect(loggerMock.error).toHaveBeenCalledWith(
      'Auth callback failed',
      expect.objectContaining({
        operation: 'login_callback',
        is_silent: false,
      })
    );
    expect(emitAuthAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'login',
        outcome: 'failure',
      })
    );
  });

  it('returns mock callback redirect when mock auth is enabled', async () => {
    vi.stubEnv('SVA_MOCK_AUTH', 'true');
    const { callbackHandler } = await import('./handlers.js');

    const response = await callbackHandler(new Request('http://localhost/auth/callback?code=abc&state=state-mock'));

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/?auth=mock-callback');
  });

  it('returns mock user response in meHandler when mock auth is enabled', async () => {
    vi.stubEnv('SVA_MOCK_AUTH', 'true');
    const { meHandler } = await import('./handlers.js');

    const response = await meHandler(new Request('http://localhost/auth/me'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        user: expect.objectContaining({
          id: expect.any(String),
        }),
      })
    );
  });

  it('logs authenticated me requests through middleware branch', async () => {
    withAuthenticatedUserMock.mockImplementation(async (_request: Request, callback: (input: { user: any }) => Response) =>
      callback({
        user: {
          id: 'user-1',
          instanceId: 'de-musterhausen',
          roles: ['editor'],
        },
      })
    );

    const { meHandler } = await import('./handlers.js');
    const response = await meHandler(new Request('http://localhost/auth/me'));

    expect(response.status).toBe(200);
    expect(loggerMock.debug).toHaveBeenCalledWith(
      'Auth check successful',
      expect.objectContaining({
        endpoint: '/auth/me',
        operation: 'get_current_user',
      })
    );
  });

  it('logs logout without session and still sets suppression cookie', async () => {
    const { logoutHandler } = await import('./handlers.js');

    const response = await logoutHandler(new Request('http://localhost/auth/logout', { method: 'POST' }));

    expect(response.status).toBe(302);
    expect(loggerMock.debug).toHaveBeenCalledWith(
      'Logout without session',
      expect.objectContaining({ operation: 'logout', session_exists: false })
    );
    expect(response.headers.get('set-cookie')).toContain('sva_auth_silent_sso=');
  });

  it('handles logout errors and falls back to post logout redirect', async () => {
    getSessionMock.mockResolvedValue({
      user: {
        id: 'user-1',
        instanceId: 'de-musterhausen',
        roles: ['editor'],
      },
    });
    logoutSessionMock.mockRejectedValue(new Error('logout failed'));

    const { logoutHandler } = await import('./handlers.js');
    const response = await logoutHandler(
      new Request('http://localhost/auth/logout', {
        method: 'POST',
        headers: { cookie: 'sva_auth_session=session-err' },
      })
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('http://localhost:3000');
    expect(loggerMock.error).toHaveBeenCalledWith(
      'Logout failed',
      expect.objectContaining({ operation: 'logout' })
    );
  });

  it('summarizes relative logout targets without leaking query details', async () => {
    getSessionMock.mockResolvedValue({
      user: {
        id: 'user-1',
        instanceId: 'de-musterhausen',
        roles: ['editor'],
      },
    });
    logoutSessionMock.mockResolvedValue('/signed-out?code=secret-code');

    const { logoutHandler } = await import('./handlers.js');
    const response = await logoutHandler(
      new Request('http://localhost/auth/logout', {
        method: 'POST',
        headers: { cookie: 'sva_auth_session=session-rel' },
      })
    );

    expect(response.status).toBe(302);
    expect(loggerMock.info).toHaveBeenCalledWith(
      'Logout successful',
      expect.objectContaining({
        redirect_target_path: '/signed-out',
        has_sensitive_query: true,
      })
    );
    const loggedMetadata = loggerMock.info.mock.calls.find(([message]) => message === 'Logout successful')?.[1];
    expect(loggedMetadata?.redirect_target_origin).toBeUndefined();
  });
});
