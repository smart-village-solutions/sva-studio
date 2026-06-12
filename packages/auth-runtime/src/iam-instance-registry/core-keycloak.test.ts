import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  auditHandlers: {
    getInstanceAuditRun: vi.fn(async () => new Response('collection', { status: 200 })),
    getSingleInstanceAuditRun: vi.fn(async () => new Response('detail', { status: 200 })),
  },
  keycloakHandlers: {
    getInstanceKeycloakStatus: vi.fn(async () => new Response('status', { status: 200 })),
    getInstanceKeycloakPreflight: vi.fn(async () => new Response('preflight', { status: 200 })),
    planInstanceKeycloakProvisioning: vi.fn(async () => new Response('plan', { status: 200 })),
    getInstanceKeycloakProvisioningRun: vi.fn(async () => new Response('run', { status: 200 })),
  },
  createAuditHandlers: vi.fn(() => state.auditHandlers),
  createKeycloakHandlers: vi.fn(() => state.keycloakHandlers),
}));

vi.mock('@sva/server-runtime', () => ({
  getWorkspaceContext: () => ({ requestId: 'req-1' }),
}));

vi.mock('@sva/instance-registry', () => ({
  createInstanceRegistryAuditHttpHandlers: state.createAuditHandlers,
  createInstanceRegistryKeycloakHttpHandlers: state.createKeycloakHandlers,
}));

vi.mock('../iam-account-management/api-helpers.js', () => ({
  asApiItem: vi.fn((value: unknown) => value),
  createApiError: vi.fn((status: number, code: string, message: string, requestId?: string) =>
    new Response(JSON.stringify({ code, message, requestId }), { status })
  ),
}));

vi.mock('../iam-account-management/csrf.js', () => ({
  validateCsrf: vi.fn(),
}));

vi.mock('../db.js', () => ({
  jsonResponse: vi.fn((status: number, payload: unknown) => new Response(JSON.stringify(payload), { status })),
}));

vi.mock('./http.js', () => ({
  ensurePlatformAccess: vi.fn(() => null),
  requireFreshReauth: vi.fn(),
}));

vi.mock('./repository.js', () => ({
  withRegistryService: vi.fn(),
}));

vi.mock('./core-mutations.js', () => ({
  executeInstanceKeycloakProvisioningMutation: vi.fn(async () => new Response('execute', { status: 200 })),
  mapInstanceMutationError: vi.fn((error: unknown) => new Response(String(error), { status: 500 })),
  probeTenantIamAccessMutation: vi.fn(async () => new Response('probe', { status: 200 })),
  reconcileInstanceKeycloakMutation: vi.fn(async () => new Response('reconcile', { status: 200 })),
}));

describe('iam-instance-registry/core-keycloak', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates audit endpoints to the audit handler factory', async () => {
    const module = await import('./core-keycloak.js');
    const ctx = { user: { id: 'admin-1' } } as never;
    const request = new Request('https://studio.example.org/api/v1/iam/instances/audit');

    const collectionResponse = await module.getInstanceAuditRunInternal(request, ctx);
    const detailResponse = await module.getSingleInstanceAuditRunInternal(
      new Request('https://studio.example.org/api/v1/iam/instances/demo/audit'),
      ctx
    );

    expect(collectionResponse.status).toBe(200);
    expect(detailResponse.status).toBe(200);
    expect(state.createAuditHandlers).toHaveBeenCalledTimes(1);
    expect(state.auditHandlers.getInstanceAuditRun).toHaveBeenCalledWith(request, ctx);
    expect(state.auditHandlers.getSingleInstanceAuditRun).toHaveBeenCalledWith(
      expect.any(Request),
      ctx
    );

    const auditDeps = state.createAuditHandlers.mock.calls[0]?.[0] as {
      getRequestId: () => string | undefined;
      createApiError: (
        status: number,
        code: string,
        message: string,
        requestId?: string,
        details?: Record<string, unknown>
      ) => Response;
      getActorId: (value: typeof ctx) => string | undefined;
    };

    expect(auditDeps.getRequestId()).toBe('req-1');
    expect(auditDeps.getActorId(ctx)).toBe('admin-1');
    expect(auditDeps.createApiError(400, 'invalid_request', 'kaputt', 'req-1').status).toBe(400);
  });
});
