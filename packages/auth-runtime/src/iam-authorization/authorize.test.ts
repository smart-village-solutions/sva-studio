import { beforeEach, describe, expect, it, vi } from 'vitest';

type SessionUser = {
  id: string;
  instanceId?: string;
};

const INSTANCE_ID = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222';
const RESOURCE_ID = '33333333-3333-4333-8333-333333333333';

const state = vi.hoisted(() => ({
  withAuthenticatedUser: vi.fn(),
  withRequestContext: vi.fn(async (_input: unknown, work: () => Promise<Response>) => work()),
  getWorkspaceContext: vi.fn(() => ({ requestId: 'workspace-request', traceId: 'workspace-trace' })),
  resolveImpersonationSubject: vi.fn(async () => ({ ok: true })),
  loadAuthorizeRequest: vi.fn(),
  errorResponse: vi.fn((status: number, error: string) =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
  resolveEffectivePermissions: vi.fn(),
  resolveAuthorizeGeoContext: vi.fn(() => ({})),
  denyAuthorizeRequest: vi.fn(async () =>
    new Response(JSON.stringify({ denied: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
  emitPluginActionAuditEvent: vi.fn(async () => undefined),
  evaluateAuthorizeDecision: vi.fn(),
  jsonResponse: vi.fn((status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
  buildRequestContext: vi.fn((instanceId?: string) => ({ workspaceId: instanceId })),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  histogramRecord: vi.fn(),
}));

vi.mock('@sva/iam-core', () => ({
  evaluateAuthorizeDecision: state.evaluateAuthorizeDecision,
}));

vi.mock('@sva/server-runtime', () => ({
  getWorkspaceContext: state.getWorkspaceContext,
  withRequestContext: state.withRequestContext,
}));

vi.mock('../governance-impersonation.js', () => ({
  resolveImpersonationSubject: state.resolveImpersonationSubject,
}));

vi.mock('../middleware.js', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
}));

vi.mock('../db.js', () => ({
  jsonResponse: state.jsonResponse,
}));

vi.mock('./permission-store.js', () => ({
  resolveEffectivePermissions: state.resolveEffectivePermissions,
}));

vi.mock('./authorize-runtime.js', () => ({
  denyAuthorizeRequest: state.denyAuthorizeRequest,
  emitPluginActionAuditEvent: state.emitPluginActionAuditEvent,
  resolveAuthorizeGeoContext: state.resolveAuthorizeGeoContext,
}));

vi.mock('./shared.js', () => ({
  buildRequestContext: state.buildRequestContext,
  errorResponse: state.errorResponse,
  iamAuthorizeLatencyHistogram: { record: state.histogramRecord },
  loadAuthorizeRequest: state.loadAuthorizeRequest,
  logger: state.logger,
}));

const baseUser: SessionUser = {
  id: 'actor-1',
  instanceId: INSTANCE_ID,
};

const createPayload = () => ({
  instanceId: INSTANCE_ID,
  action: 'waste.publish',
  resource: {
    type: 'waste',
    id: RESOURCE_ID,
    organizationId: ORGANIZATION_ID,
  },
  context: {
    requestId: 'request-1',
    traceId: 'trace-1',
  },
});

describe('authorize handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();

    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: SessionUser }) => Promise<Response>) =>
        handler({ user: baseUser })
    );
    state.loadAuthorizeRequest.mockResolvedValue(createPayload());
    state.resolveImpersonationSubject.mockResolvedValue({ ok: true });
    state.resolveAuthorizeGeoContext.mockReturnValue({});
    state.resolveEffectivePermissions.mockResolvedValue({
      ok: true,
      permissions: [{ action: 'waste.publish', resourceType: 'waste', effect: 'allow' }],
      snapshotVersion: 'snapshot-1',
      cacheStatus: 'hit',
    });
    state.evaluateAuthorizeDecision.mockReturnValue({
      allowed: true,
      reason: 'allowed',
      requestId: undefined,
      traceId: undefined,
    });
  });

  it('rejects invalid payloads before any authorization lookup', async () => {
    const { authorizeHandler } = await import('./authorize.js');
    state.loadAuthorizeRequest.mockResolvedValueOnce(null);

    const response = await authorizeHandler(new Request('https://example.test/api/v1/iam/authorize'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_request' });
    expect(state.histogramRecord).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ allowed: false, reason: 'invalid_request', endpoint: '/iam/authorize' })
    );
    expect(state.resolveEffectivePermissions).not.toHaveBeenCalled();
  });

  it('rejects blank instance ids after parsing the request body', async () => {
    const { authorizeHandler } = await import('./authorize.js');
    state.loadAuthorizeRequest.mockResolvedValueOnce({
      ...createPayload(),
      instanceId: '   ',
    });

    const response = await authorizeHandler(new Request('https://example.test/api/v1/iam/authorize'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_instance_id' });
    expect(state.histogramRecord).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ allowed: false, reason: 'invalid_instance_id' })
    );
  });

  it('denies requests when the authenticated user is scoped to another instance', async () => {
    const { authorizeHandler } = await import('./authorize.js');
    state.withAuthenticatedUser.mockImplementationOnce(
      async (_request: Request, handler: (ctx: { user: SessionUser }) => Promise<Response>) =>
        handler({ user: { ...baseUser, instanceId: '44444444-4444-4444-8444-444444444444' } })
    );

    const response = await authorizeHandler(new Request('https://example.test/api/v1/iam/authorize'));

    expect(response.status).toBe(200);
    expect(state.denyAuthorizeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: INSTANCE_ID }),
      'actor-1',
      expect.objectContaining({
        reason: 'instance_scope_mismatch',
        instanceId: INSTANCE_ID,
        resourceType: 'waste',
        resourceId: RESOURCE_ID,
      }),
      expect.any(Function)
    );
  });

  it('denies impersonation attempts with governance diagnostics', async () => {
    const { authorizeHandler } = await import('./authorize.js');
    state.loadAuthorizeRequest.mockResolvedValueOnce({
      ...createPayload(),
      context: {
        ...createPayload().context,
        actingAsUserId: 'delegate-1',
      },
    });
    state.resolveImpersonationSubject.mockResolvedValueOnce({
      ok: false,
      reasonCode: 'DENY_TICKET_REQUIRED',
    });

    const response = await authorizeHandler(new Request('https://example.test/api/v1/iam/authorize'));

    expect(response.status).toBe(200);
    expect(state.resolveImpersonationSubject).toHaveBeenCalledWith({
      instanceId: INSTANCE_ID,
      actorKeycloakSubject: 'actor-1',
      targetKeycloakSubject: 'delegate-1',
    });
    expect(state.denyAuthorizeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'waste.publish' }),
      'actor-1',
      expect.objectContaining({
        reason: 'context_attribute_missing',
        diagnostics: { stage: 'impersonation', reason_code: 'DENY_TICKET_REQUIRED' },
      }),
      expect.any(Function)
    );
    expect(state.histogramRecord).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ allowed: false, reason: 'context_attribute_missing' })
    );
  });

  it('fails invalid geo context with plugin action audit emission', async () => {
    const { authorizeHandler } = await import('./authorize.js');
    state.resolveAuthorizeGeoContext.mockReturnValueOnce(null);

    const response = await authorizeHandler(new Request('https://example.test/api/v1/iam/authorize'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_request' });
    expect(state.emitPluginActionAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'waste.publish' }),
      'actor-1',
      'failure',
      'invalid_request'
    );
  });

  it('returns 503 and logs when permission resolution fails', async () => {
    const { authorizeHandler } = await import('./authorize.js');
    state.resolveEffectivePermissions.mockResolvedValueOnce({
      ok: false,
      error: 'database_unavailable',
    });

    const response = await authorizeHandler(new Request('https://example.test/api/v1/iam/authorize'));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'database_unavailable' });
    expect(state.logger.error).toHaveBeenCalledWith(
      'Failed to evaluate authorize decision from cache/database',
      expect.objectContaining({
        operation: 'authorize',
        error: 'database_unavailable',
        workspaceId: INSTANCE_ID,
      })
    );
    expect(state.emitPluginActionAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'waste.publish' }),
      'actor-1',
      'failure',
      'database_unavailable'
    );
  });

  it('denies root-only tenant permissions fail-closed before decision evaluation', async () => {
    const { authorizeHandler } = await import('./authorize.js');
    state.loadAuthorizeRequest.mockResolvedValueOnce({
      ...createPayload(),
      action: 'instance.registry.manage',
      resource: {
        type: 'instance',
        organizationId: ORGANIZATION_ID,
      },
    });
    state.resolveEffectivePermissions.mockResolvedValueOnce({
      ok: true,
      permissions: [{ action: 'instance.registry.manage', resourceType: 'instance', effect: 'allow' }],
      snapshotVersion: 'snapshot-1',
      cacheStatus: 'hit',
    });
    state.evaluateAuthorizeDecision.mockImplementationOnce((payload, permissions: Array<{ action: string }>) =>
      permissions.some((permission) => permission.action === payload.action)
        ? {
            allowed: true,
            reason: 'allowed_by_root_only_permission',
            requestId: undefined,
            traceId: undefined,
          }
        : {
            allowed: false,
            reason: 'permission_missing',
            requestId: undefined,
            traceId: undefined,
          }
    );

    const response = await authorizeHandler(new Request('https://example.test/api/v1/iam/authorize'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      allowed: false,
      reason: 'permission_missing',
    });
    expect(state.evaluateAuthorizeDecision).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'instance.registry.manage' }),
      []
    );
  });

  it('returns successful authorization decisions with workspace fallback ids', async () => {
    const { authorizeHandler } = await import('./authorize.js');

    const response = await authorizeHandler(new Request('https://example.test/api/v1/iam/authorize'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      allowed: true,
      reason: 'allowed',
      requestId: 'workspace-request',
      traceId: 'workspace-trace',
      snapshotVersion: 'snapshot-1',
      cacheStatus: 'hit',
    });
    expect(state.resolveEffectivePermissions).toHaveBeenCalledWith({
      instanceId: INSTANCE_ID,
      keycloakSubject: 'actor-1',
      organizationId: ORGANIZATION_ID,
      geoUnitId: undefined,
      geoHierarchy: undefined,
    });
    expect(state.logger.debug).toHaveBeenCalledWith(
      'Authorize decision evaluated',
      expect.objectContaining({ allowed: true, reason: 'allowed', action: 'waste.publish' })
    );
    expect(state.emitPluginActionAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'waste.publish' }),
      'actor-1',
      'success',
      'allowed'
    );
  });

  it('logs timing diagnostics when authorize timing debug is enabled', async () => {
    vi.stubEnv('IAM_DEBUG_AUTHORIZE_TIMINGS', 'true');
    const { authorizeHandler } = await import('./authorize.js');

    const response = await authorizeHandler(new Request('https://example.test/api/v1/iam/authorize'));

    expect(response.status).toBe(200);
    expect(state.logger.info).toHaveBeenCalledWith(
      'Authorize timing diagnostics',
      expect.objectContaining({
        operation: 'authorize_timing',
        action: 'waste.publish',
        resource_type: 'waste',
        cache_status: 'hit',
      })
    );
  });

  it('returns denied decisions while preserving explicit request and trace ids', async () => {
    const { authorizeHandler } = await import('./authorize.js');
    state.evaluateAuthorizeDecision.mockReturnValueOnce({
      allowed: false,
      reason: 'forbidden',
      requestId: 'decision-request',
      traceId: 'decision-trace',
    });

    const response = await authorizeHandler(new Request('https://example.test/api/v1/iam/authorize'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      allowed: false,
      reason: 'forbidden',
      requestId: 'decision-request',
      traceId: 'decision-trace',
      snapshotVersion: 'snapshot-1',
      cacheStatus: 'hit',
    });
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Authorize decision evaluated',
      expect.objectContaining({ allowed: false, reason: 'forbidden' })
    );
    expect(state.emitPluginActionAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'waste.publish' }),
      'actor-1',
      'denied',
      'forbidden'
    );
  });
});
