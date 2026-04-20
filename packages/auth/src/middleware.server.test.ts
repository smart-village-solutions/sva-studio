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
const loadInstanceByHostnameMock = vi.hoisted(() => vi.fn(async () => null));
const instanceConfigState = vi.hoisted(() => ({
  canonicalAuthHost: 'studio.example.org',
  parentDomain: 'studio.example.org',
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
  getInstanceConfig: () => instanceConfigState,
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

vi.mock('@sva/data/server', () => ({
  loadInstanceByHostname: loadInstanceByHostnameMock,
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
    vi.stubEnv('SVA_TRUST_FORWARDED_HEADERS', 'true');
    vi.resetAllMocks();
    loadInstanceByHostnameMock.mockResolvedValue(null);
    instanceConfigState.canonicalAuthHost = 'studio.example.org';
    instanceConfigState.parentDomain = 'studio.example.org';
    workspaceContext.workspaceId = 'default';
    workspaceContext.requestId = 'req-middleware';
    workspaceContext.traceId = 'trace-middleware';
    withLegalTextComplianceMock.mockImplementation(
      async (_instanceId: string, _keycloakSubject: string, handler: () => Promise<Response>) => handler()
    );
  });

  it('returns 401 when session cookie is missing', async () => {
    instanceConfigState.canonicalAuthHost = 'localhost';
    instanceConfigState.parentDomain = 'localhost';
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
    instanceConfigState.canonicalAuthHost = 'localhost';
    instanceConfigState.parentDomain = 'localhost';
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

  it('returns a structured tenant host error for inactive tenant hosts before session resolution', async () => {
    instanceConfigState.canonicalAuthHost = 'studio.smart-village.app';
    instanceConfigState.parentDomain = 'studio.smart-village.app';
    loadInstanceByHostnameMock.mockResolvedValue({
      instanceId: 'hb-meinquartier',
      status: 'suspended',
    });
    const { withAuthenticatedUser } = await import('./middleware.server');
    const request = new Request('https://hb-meinquartier.studio.smart-village.app/api/v1/iam/users', {
      headers: { cookie: 'sva_auth_session=session-inactive-tenant' },
    });

    const response = await withAuthenticatedUser(request, () => new Response('ok'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'forbidden',
        message: 'Host not permitted for this operation',
        classification: 'registry_or_provisioning_drift',
        status: 'manuelle_pruefung_erforderlich',
        recommendedAction: 'provisioning_pruefen',
        details: {
          reason_code: 'tenant_inactive',
          instance_id: 'hb-meinquartier',
        },
        safeDetails: {
          reason_code: 'tenant_inactive',
          instance_id: 'hb-meinquartier',
        },
      },
    });
    expect(getSessionUserMock).not.toHaveBeenCalled();
  });

  it('returns a structured database error when tenant host lookup fails', async () => {
    instanceConfigState.canonicalAuthHost = 'studio.smart-village.app';
    instanceConfigState.parentDomain = 'studio.smart-village.app';
    loadInstanceByHostnameMock.mockRejectedValue(new Error('database down'));
    const { withAuthenticatedUser } = await import('./middleware.server');
    const request = new Request('https://hb-meinquartier.studio.smart-village.app/api/v1/iam/users', {
      headers: { cookie: 'sva_auth_session=session-tenant-db-failure' },
    });

    const response = await withAuthenticatedUser(request, () => new Response('ok'));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'database_unavailable',
        message: 'Host not permitted for this operation',
        classification: 'tenant_host_validation',
        status: 'degradiert',
        recommendedAction: 'erneut_versuchen',
        details: {
          dependency: 'database',
          reason_code: 'tenant_lookup_failed',
        },
        safeDetails: {
          dependency: 'database',
          reason_code: 'tenant_lookup_failed',
        },
      },
    });
    expect(getSessionUserMock).not.toHaveBeenCalled();
  });

  it('passes authenticated user to handler', async () => {
    instanceConfigState.canonicalAuthHost = 'localhost';
    instanceConfigState.parentDomain = 'localhost';
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

  it('rejects tenant requests when the session user lacks instance context', async () => {
    instanceConfigState.canonicalAuthHost = 'studio.smart-village.app';
    instanceConfigState.parentDomain = 'studio.smart-village.app';
    loadInstanceByHostnameMock.mockResolvedValue({
      instanceId: 'hb-meinquartier',
      displayName: 'HB Meinquartier',
      status: 'active',
      parentDomain: 'studio.smart-village.app',
      primaryHostname: 'hb-meinquartier.studio.smart-village.app',
      featureFlags: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    getSessionUserMock.mockResolvedValue({
      id: 'user-host-instance',
      name: 'Host Derived',
      roles: ['admin'],
    });
    const { withAuthenticatedUser } = await import('./middleware.server');
    const request = new Request('https://hb-meinquartier.studio.smart-village.app/api/v1/iam/users', {
      headers: { cookie: 'sva_auth_session=session-host-instance' },
    });

    const response = await withAuthenticatedUser(request, () => new Response('ok'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'unauthorized',
        message: 'Die Sitzung enthält keinen gültigen Instanzkontext.',
        classification: 'session_store_or_session_hydration',
        status: 'recovery_laeuft',
        recommendedAction: 'erneut_anmelden',
        details: {
          reason_code: 'missing_session_instance_id',
          request_host: 'hb-meinquartier.studio.smart-village.app',
        },
        safeDetails: {
          reason_code: 'missing_session_instance_id',
        },
      },
      requestId: 'req-middleware',
    });
    expect(middlewareLogger.warn).toHaveBeenCalledWith(
      'Auth middleware rejected tenant request because the session user lacks instance context',
      expect.objectContaining({
        user_id: 'user-host-instance',
        tenant_host: 'hb-meinquartier.studio.smart-village.app',
      })
    );
    expect(middlewareLogger.warn).toHaveBeenCalledWith(
      'Auth middleware rejected request because the session user is missing required tenant context',
      expect.objectContaining({
        reason_code: 'missing_session_instance_id',
        request_host: 'hb-meinquartier.studio.smart-village.app',
      })
    );
  });

  it('keeps platform requests without instance context valid', async () => {
    instanceConfigState.canonicalAuthHost = 'studio.smart-village.app';
    instanceConfigState.parentDomain = 'studio.smart-village.app';
    getSessionUserMock.mockResolvedValue({
      id: 'user-platform',
      name: 'Platform User',
      roles: ['admin'],
    });
    const { withAuthenticatedUser } = await import('./middleware.server');
    const request = new Request('https://studio.smart-village.app/api/v1/iam/users', {
      headers: {
        cookie: 'sva_auth_session=session-platform',
      },
    });

    const response = await withAuthenticatedUser(request, ({ user }) =>
      new Response(JSON.stringify({ instanceId: user.instanceId ?? null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ instanceId: null });
  });

  it('rejects tenant requests when request.url stays on the root host but the host header targets a tenant', async () => {
    instanceConfigState.canonicalAuthHost = 'studio.smart-village.app';
    instanceConfigState.parentDomain = 'studio.smart-village.app';
    loadInstanceByHostnameMock.mockResolvedValue({
      instanceId: 'hb-meinquartier',
      displayName: 'HB Meinquartier',
      status: 'active',
      parentDomain: 'studio.smart-village.app',
      primaryHostname: 'hb-meinquartier.studio.smart-village.app',
      featureFlags: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    getSessionUserMock.mockResolvedValue({
      id: 'user-root-url-instance',
      name: 'Root URL Derived',
      roles: ['admin'],
    });
    const { withAuthenticatedUser } = await import('./middleware.server');
    const request = new Request('https://studio.smart-village.app/api/v1/iam/users', {
      headers: {
        cookie: 'sva_auth_session=session-root-url-instance',
        host: 'hb-meinquartier.studio.smart-village.app',
      },
    });

    const response = await withAuthenticatedUser(request, () => new Response('ok'));

    expect(response.status).toBe(401);
    expect(loadInstanceByHostnameMock).toHaveBeenCalledWith('hb-meinquartier.studio.smart-village.app');
  });

  it('enforces legal text compliance on protected IAM routes', async () => {
    instanceConfigState.canonicalAuthHost = 'localhost';
    instanceConfigState.parentDomain = 'localhost';
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
      expect.any(Function),
      { returnTo: '/api/v1/iam/users' }
    );
  });

  it('logs session diagnostics for self-service profile requests when debug mode is enabled', async () => {
    instanceConfigState.canonicalAuthHost = 'localhost';
    instanceConfigState.parentDomain = 'localhost';
    vi.stubEnv('IAM_DEBUG_PROFILE_ERRORS', 'true');
    getSessionUserMock.mockResolvedValue({
      id: 'user-profile-debug',
      name: 'Profil Debug',
      roles: ['member'],
      instanceId: 'de-musterhausen',
    });
    const { withAuthenticatedUser } = await import('./middleware.server');
    const request = new Request('http://localhost/api/v1/iam/users/me/profile', {
      headers: { cookie: 'sva_auth_session=session-profile-debug' },
    });

    const response = await withAuthenticatedUser(request, () => new Response('ok'));

    expect(response.status).toBe(200);
    expect(middlewareLogger.info).toHaveBeenCalledWith(
      'Auth middleware resolved session user for self-service diagnostics',
      expect.objectContaining({
        auth_state: 'authenticated',
        session_instance_id: 'de-musterhausen',
        session_roles: ['member'],
        session_roles_count: 1,
        user_id: 'user-profile-debug',
      })
    );
  });

  it('skips legal text compliance for acceptance workflow operations', async () => {
    instanceConfigState.canonicalAuthHost = 'localhost';
    instanceConfigState.parentDomain = 'localhost';
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
    instanceConfigState.canonicalAuthHost = 'localhost';
    instanceConfigState.parentDomain = 'localhost';
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
        instanceId: 'de-musterhausen',
        roles: [
          'system_admin',
          'iam_admin',
          'support_admin',
          'security_admin',
          'instance_registry_admin',
          'interface_manager',
          'app_manager',
          'editor',
        ],
      },
    });
    expect(getSessionUserMock).not.toHaveBeenCalled();
  });

  it('skips legal text compliance for exempt auth paths', async () => {
    instanceConfigState.canonicalAuthHost = 'localhost';
    instanceConfigState.parentDomain = 'localhost';
    getSessionUserMock.mockResolvedValue({
      id: 'user-auth-exempt',
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

  it('skips legal text compliance for pending legal text self-service endpoint', async () => {
    instanceConfigState.canonicalAuthHost = 'localhost';
    instanceConfigState.parentDomain = 'localhost';
    getSessionUserMock.mockResolvedValue({
      id: 'user-legal-pending',
      name: 'Legal Pending',
      roles: ['editor'],
      instanceId: 'de-musterhausen',
    });
    const { withAuthenticatedUser } = await import('./middleware.server');
    const request = new Request('http://localhost/iam/me/legal-texts/pending', {
      headers: { cookie: 'sva_auth_session=session-legal-pending' },
    });

    const response = await withAuthenticatedUser(request, () => new Response('ok'));

    expect(response.status).toBe(200);
    expect(withLegalTextComplianceMock).not.toHaveBeenCalled();
  });

  it('skips legal text compliance for legal text self-service subpaths', async () => {
    instanceConfigState.canonicalAuthHost = 'localhost';
    instanceConfigState.parentDomain = 'localhost';
    getSessionUserMock.mockResolvedValue({
      id: 'user-legal-pending-subpath',
      name: 'Legal Pending Subpath',
      roles: ['editor'],
      instanceId: 'de-musterhausen',
    });
    const { withAuthenticatedUser } = await import('./middleware.server');
    const request = new Request('http://localhost/iam/me/legal-texts/pending/', {
      headers: { cookie: 'sva_auth_session=session-legal-pending-subpath' },
    });

    const response = await withAuthenticatedUser(request, () => new Response('ok'));

    expect(response.status).toBe(200);
    expect(withLegalTextComplianceMock).not.toHaveBeenCalled();
  });

  it('skips legal text compliance for legal text admin endpoints', async () => {
    instanceConfigState.canonicalAuthHost = 'localhost';
    instanceConfigState.parentDomain = 'localhost';
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
    instanceConfigState.canonicalAuthHost = 'localhost';
    instanceConfigState.parentDomain = 'localhost';
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
    instanceConfigState.canonicalAuthHost = 'localhost';
    instanceConfigState.parentDomain = 'localhost';
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
      expect.any(Function),
      { returnTo: '/api/v1/iam/governance/workflows' }
    );
  });

  it('enforces legal text compliance for iam authorize endpoint', async () => {
    instanceConfigState.canonicalAuthHost = 'localhost';
    instanceConfigState.parentDomain = 'localhost';
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
      expect.any(Function),
      { returnTo: '/iam/authorize' }
    );
  });

  it('returns legal text enforcement errors unchanged on protected routes', async () => {
    instanceConfigState.canonicalAuthHost = 'localhost';
    instanceConfigState.parentDomain = 'localhost';
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
      expect.any(Function),
      { returnTo: '/api/v1/iam/users' }
    );
  });

  it('returns a flat json 500 and logs correlation ids when session resolution throws', async () => {
    instanceConfigState.canonicalAuthHost = 'localhost';
    instanceConfigState.parentDomain = 'localhost';
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
    instanceConfigState.canonicalAuthHost = 'localhost';
    instanceConfigState.parentDomain = 'localhost';
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

  it('rejects unknown tenant hosts fail-closed before session lookup', async () => {
    instanceConfigState.canonicalAuthHost = 'studio.example.org';
    instanceConfigState.parentDomain = 'studio.example.org';
    loadInstanceByHostnameMock.mockResolvedValue(null);

    const { withAuthenticatedUser } = await import('./middleware.server');
    const response = await withAuthenticatedUser(
      new Request('https://blocked.studio.example.org/auth/me', {
        headers: { cookie: 'sva_auth_session=session-blocked' },
      }),
      () => new Response('ok')
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: {
        code: 'forbidden',
        message: 'Host not permitted for this operation',
        classification: 'registry_or_provisioning_drift',
        status: 'manuelle_pruefung_erforderlich',
        recommendedAction: 'provisioning_pruefen',
        details: {
          reason_code: 'tenant_not_found',
        },
        safeDetails: {
          reason_code: 'tenant_not_found',
        },
      },
    });
    expect(getSessionUserMock).not.toHaveBeenCalled();
  });

  it('rejects suspended tenant hosts with the same public response as unknown hosts', async () => {
    instanceConfigState.canonicalAuthHost = 'studio.example.org';
    instanceConfigState.parentDomain = 'studio.example.org';
    loadInstanceByHostnameMock.mockResolvedValue({
      instanceId: 'hb',
      displayName: 'HB',
      status: 'suspended',
      parentDomain: 'studio.example.org',
      primaryHostname: 'hb.studio.example.org',
      featureFlags: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const { withAuthenticatedUser } = await import('./middleware.server');
    const response = await withAuthenticatedUser(
      new Request('https://hb.studio.example.org/auth/me', {
        headers: { cookie: 'sva_auth_session=session-suspended' },
      }),
      () => new Response('ok')
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: {
        code: 'forbidden',
        message: 'Host not permitted for this operation',
        classification: 'registry_or_provisioning_drift',
        status: 'manuelle_pruefung_erforderlich',
        recommendedAction: 'provisioning_pruefen',
        details: {
          reason_code: 'tenant_inactive',
          instance_id: 'hb',
        },
        safeDetails: {
          reason_code: 'tenant_inactive',
          instance_id: 'hb',
        },
      },
    });
    expect(getSessionUserMock).not.toHaveBeenCalled();
  });
});
