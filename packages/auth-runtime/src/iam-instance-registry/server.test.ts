import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  withAuthenticatedUser: vi.fn(),
  withRequestContext: vi.fn(async (_input: unknown, work: () => Promise<Response>) => work()),
  getInstanceAuditRunInternal: vi.fn(async () => new Response('collection', { status: 200 })),
  getSingleInstanceAuditRunInternal: vi.fn(async () => new Response('detail', { status: 200 })),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({
    error: vi.fn(),
  }),
  toJsonErrorResponse: vi.fn(
    (status: number, code: string, message?: string, options?: { requestId?: string }) =>
      new Response(JSON.stringify({ code, message, requestId: options?.requestId }), { status })
  ),
  withRequestContext: state.withRequestContext,
}));

vi.mock('../middleware.js', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
}));

vi.mock('../log-context.js', () => ({
  buildLogContext: vi.fn(() => ({ request_id: 'req-1' })),
}));

vi.mock('./core.js', () => ({
  activateInstanceInternal: vi.fn(async () => new Response('activate', { status: 200 })),
  archiveInstanceInternal: vi.fn(async () => new Response('archive', { status: 200 })),
  assignInstanceModuleInternal: vi.fn(async () => new Response('assign', { status: 200 })),
  bootstrapInstanceAdminStructureInternal: vi.fn(async () => new Response('bootstrap', { status: 200 })),
  createInstanceInternal: vi.fn(async () => new Response('create', { status: 200 })),
  getInstanceInternal: vi.fn(async () => new Response('get', { status: 200 })),
  listInstancesInternal: vi.fn(async () => new Response('list', { status: 200 })),
  revokeInstanceModuleInternal: vi.fn(async () => new Response('revoke', { status: 200 })),
  seedInstanceIamBaselineInternal: vi.fn(async () => new Response('seed', { status: 200 })),
  suspendInstanceInternal: vi.fn(async () => new Response('suspend', { status: 200 })),
  updateInstanceInternal: vi.fn(async () => new Response('update', { status: 200 })),
}));

vi.mock('./core-keycloak.js', () => ({
  executeInstanceKeycloakProvisioningInternal: vi.fn(async () => new Response('execute', { status: 200 })),
  getInstanceAuditRunInternal: state.getInstanceAuditRunInternal,
  getInstanceKeycloakPreflightInternal: vi.fn(async () => new Response('preflight', { status: 200 })),
  getInstanceKeycloakProvisioningRunInternal: vi.fn(async () => new Response('run', { status: 200 })),
  getInstanceKeycloakStatusInternal: vi.fn(async () => new Response('status', { status: 200 })),
  getSingleInstanceAuditRunInternal: state.getSingleInstanceAuditRunInternal,
  planInstanceKeycloakProvisioningInternal: vi.fn(async () => new Response('plan', { status: 200 })),
  probeTenantIamAccessInternal: vi.fn(async () => new Response('probe', { status: 200 })),
  reconcileInstanceKeycloakInternal: vi.fn(async () => new Response('reconcile', { status: 200 })),
}));

describe('iam-instance-registry/server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.withAuthenticatedUser.mockImplementation(async (request: Request, work: (ctx: unknown) => Promise<Response>) =>
      work({ user: { id: 'admin-1' }, request } as never)
    );
  });

  it('routes audit requests through the authenticated registry handler', async () => {
    const { instanceRegistryHandlers } = await import('./server.js');
    const collectionRequest = new Request('https://studio.example.org/api/v1/iam/instances/audit');
    const detailRequest = new Request('https://studio.example.org/api/v1/iam/instances/demo/audit');

    const collectionResponse = await instanceRegistryHandlers.getInstanceAuditRun(collectionRequest);
    const detailResponse = await instanceRegistryHandlers.getSingleInstanceAuditRun(detailRequest);

    expect(collectionResponse.status).toBe(200);
    expect(detailResponse.status).toBe(200);
    expect(state.withRequestContext).toHaveBeenCalledTimes(2);
    expect(state.withAuthenticatedUser).toHaveBeenCalledTimes(2);
    expect(state.getInstanceAuditRunInternal).toHaveBeenCalledWith(
      collectionRequest,
      expect.objectContaining({ user: { id: 'admin-1' } })
    );
    expect(state.getSingleInstanceAuditRunInternal).toHaveBeenCalledWith(
      detailRequest,
      expect.objectContaining({ user: { id: 'admin-1' } })
    );
  });
});
