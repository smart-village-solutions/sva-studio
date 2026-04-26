import { describe, expect, it, vi } from 'vitest';

import { createReconcileHandlerInternal, type ReconcileHandlerDeps } from './reconcile-handler.js';

const jsonResponse = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const createDeps = (overrides: Partial<ReconcileHandlerDeps> = {}): ReconcileHandlerDeps => ({
  asApiItem: vi.fn((data, requestId) => ({ data, requestId })),
  consumeRateLimit: vi.fn(() => null),
  createApiError: vi.fn((status, code, message, requestId, details) =>
    jsonResponse(status, { error: code, message, requestId, details })
  ),
  ensureIamAdminFeature: vi.fn(() => null),
  getRequestContext: vi.fn(() => ({ requestId: 'req-1', traceId: 'trace-1' })),
  jsonResponse,
  logger: {
    error: vi.fn(),
  },
  mapRoleSyncErrorCode: vi.fn(() => 'keycloak_unavailable'),
  reconcilePlatformRoles: vi.fn(() => jsonResponse(200, { platform: true })),
  requireSystemAdminRole: vi.fn(() => null),
  resolveActorInfo: vi.fn(() =>
    Promise.resolve({
      actor: {
        instanceId: 'tenant-a',
        actorAccountId: 'account-1',
        requestId: 'actor-req',
        traceId: 'actor-trace',
      },
    })
  ),
  runRoleCatalogReconciliation: vi.fn(() =>
    Promise.resolve({
      outcome: 'success',
      checkedCount: 1,
      correctedCount: 0,
      failedCount: 0,
      manualReviewCount: 0,
      requiresManualActionCount: 0,
      roles: [],
    })
  ),
  sanitizeRoleErrorMessage: vi.fn((error) => (error instanceof Error ? error.message : String(error))),
  validateCsrf: vi.fn(() => null),
  ...overrides,
});

const ctx = {
  sessionId: 'session-1',
  user: {
    id: 'subject-1',
    instanceId: 'tenant-a',
    roles: ['system-admin'],
  },
};

describe('reconcile handler facade', () => {
  it('returns early for feature and role guard failures', async () => {
    const featureError = jsonResponse(404, { error: 'disabled' });
    const featureDeps = createDeps({ ensureIamAdminFeature: vi.fn(() => featureError) });
    await expect(createReconcileHandlerInternal(featureDeps)(new Request('https://app/reconcile'), ctx)).resolves.toBe(
      featureError
    );

    const roleError = jsonResponse(403, { error: 'forbidden' });
    const roleDeps = createDeps({ requireSystemAdminRole: vi.fn(() => roleError) });
    await expect(createReconcileHandlerInternal(roleDeps)(new Request('https://app/reconcile'), ctx)).resolves.toBe(
      roleError
    );
  });

  it('delegates platform sessions to platform reconciliation', async () => {
    const deps = createDeps();
    const platformCtx = { ...ctx, user: { ...ctx.user, instanceId: undefined } };
    const response = await createReconcileHandlerInternal(deps)(new Request('https://app/reconcile'), platformCtx);

    await expect(response.json()).resolves.toEqual({ platform: true });
    expect(deps.reconcilePlatformRoles).toHaveBeenCalledWith(
      expect.any(Request),
      platformCtx,
      'req-1',
      'trace-1'
    );
  });

  it('runs tenant reconciliation after actor, csrf and rate-limit checks', async () => {
    const deps = createDeps();
    const response = await createReconcileHandlerInternal(deps)(
      new Request('https://app/reconcile', { headers: { 'x-debug-reconcile': '1' } }),
      ctx
    );

    await expect(response.json()).resolves.toMatchObject({
      data: { outcome: 'success' },
      requestId: 'actor-req',
    });
    expect(deps.consumeRateLimit).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      actorKeycloakSubject: 'subject-1',
      scope: 'write',
      requestId: 'actor-req',
    });
    expect(deps.runRoleCatalogReconciliation).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      actorAccountId: 'account-1',
      requestId: 'actor-req',
      traceId: 'actor-trace',
      includeDiagnostics: true,
    });
  });

  it('returns injected actor, csrf and rate-limit errors', async () => {
    const actorError = jsonResponse(401, { error: 'actor' });
    const actorDeps = createDeps({
      resolveActorInfo: vi.fn(() => Promise.resolve({ error: actorError })),
    });
    await expect(createReconcileHandlerInternal(actorDeps)(new Request('https://app/reconcile'), ctx)).resolves.toBe(
      actorError
    );

    const csrfError = jsonResponse(403, { error: 'csrf' });
    const csrfDeps = createDeps({ validateCsrf: vi.fn(() => csrfError) });
    await expect(createReconcileHandlerInternal(csrfDeps)(new Request('https://app/reconcile'), ctx)).resolves.toBe(
      csrfError
    );

    const rateLimit = jsonResponse(429, { error: 'rate-limit' });
    const rateDeps = createDeps({ consumeRateLimit: vi.fn(() => rateLimit) });
    await expect(createReconcileHandlerInternal(rateDeps)(new Request('https://app/reconcile'), ctx)).resolves.toBe(
      rateLimit
    );
  });

  it('maps reconciliation failures to a keycloak unavailable API error', async () => {
    const deps = createDeps({
      runRoleCatalogReconciliation: vi.fn(() => Promise.reject(new Error('keycloak down'))),
    });
    const response = await createReconcileHandlerInternal(deps)(new Request('https://app/reconcile'), ctx);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: 'keycloak_unavailable',
      details: {
        syncState: 'failed',
        syncError: { code: 'keycloak_unavailable' },
      },
    });
    expect(deps.logger.error).toHaveBeenCalledWith(
      'Role reconciliation failed',
      expect.objectContaining({
        instance_id: 'tenant-a',
        request_id: 'actor-req',
        trace_id: 'actor-trace',
        error: 'keycloak down',
      })
    );
  });
});
