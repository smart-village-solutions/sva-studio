import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  return {
    createSdkLogger: vi.fn(() => ({
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
    toJsonErrorResponse: vi.fn(
      (status: number, code: string, message: string, options?: { requestId?: string }) =>
        new Response(JSON.stringify({ error: code, message, requestId: options?.requestId }), { status })
    ),
    withRequestContext: vi.fn(async (_context, work: () => Promise<Response>) => work()),
    withAuthenticatedUser: vi.fn(async (_request: Request, work: (ctx: { user: { id: string } }) => Promise<Response>) =>
      work({ user: { id: 'actor-1' } })
    ),
    buildLogContext: vi.fn(() => ({ request_id: 'req-1', trace_id: 'trace-1' })),
    listInstancesInternal: vi.fn(async () => new Response('list')),
    getInstanceInternal: vi.fn(async () => new Response('get')),
    createInstanceInternal: vi.fn(async () => new Response('create')),
    updateInstanceInternal: vi.fn(async () => new Response('update')),
    activateInstanceInternal: vi.fn(async () => new Response('active')),
    suspendInstanceInternal: vi.fn(async () => new Response('suspended')),
    archiveInstanceInternal: vi.fn(async () => new Response('archived')),
    assignInstanceModuleInternal: vi.fn(async () => new Response('assign')),
    bootstrapInstanceAdminStructureInternal: vi.fn(async () => new Response('bootstrap')),
    revokeInstanceModuleInternal: vi.fn(async () => new Response('revoke')),
    seedInstanceIamBaselineInternal: vi.fn(async () => new Response('seed')),
    getInstanceAuditRunInternal: vi.fn(async () => new Response('audit-run')),
    getSingleInstanceAuditRunInternal: vi.fn(async () => new Response('single-audit-run')),
    getInstanceKeycloakStatusInternal: vi.fn(async () => new Response('status')),
    getInstanceKeycloakPreflightInternal: vi.fn(async () => new Response('preflight')),
    planInstanceKeycloakProvisioningInternal: vi.fn(async () => new Response('plan')),
    executeInstanceKeycloakProvisioningInternal: vi.fn(async () => new Response('execute')),
    getInstanceKeycloakProvisioningRunInternal: vi.fn(async () => new Response('run')),
    reconcileInstanceKeycloakInternal: vi.fn(async () => new Response('reconcile')),
    probeTenantIamAccessInternal: vi.fn(async () => new Response('probe')),
  };
});

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: state.createSdkLogger,
  toJsonErrorResponse: state.toJsonErrorResponse,
  withRequestContext: state.withRequestContext,
}));

vi.mock('../middleware.js', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
}));

vi.mock('../log-context.js', () => ({
  buildLogContext: state.buildLogContext,
}));

vi.mock('./core.js', () => ({
  activateInstanceInternal: state.activateInstanceInternal,
  assignInstanceModuleInternal: state.assignInstanceModuleInternal,
  archiveInstanceInternal: state.archiveInstanceInternal,
  bootstrapInstanceAdminStructureInternal: state.bootstrapInstanceAdminStructureInternal,
  createInstanceInternal: state.createInstanceInternal,
  getInstanceInternal: state.getInstanceInternal,
  listInstancesInternal: state.listInstancesInternal,
  revokeInstanceModuleInternal: state.revokeInstanceModuleInternal,
  seedInstanceIamBaselineInternal: state.seedInstanceIamBaselineInternal,
  suspendInstanceInternal: state.suspendInstanceInternal,
  updateInstanceInternal: state.updateInstanceInternal,
}));

vi.mock('./core-keycloak.js', () => ({
  executeInstanceKeycloakProvisioningInternal: state.executeInstanceKeycloakProvisioningInternal,
  getInstanceAuditRunInternal: state.getInstanceAuditRunInternal,
  getInstanceKeycloakPreflightInternal: state.getInstanceKeycloakPreflightInternal,
  getInstanceKeycloakProvisioningRunInternal: state.getInstanceKeycloakProvisioningRunInternal,
  getInstanceKeycloakStatusInternal: state.getInstanceKeycloakStatusInternal,
  getSingleInstanceAuditRunInternal: state.getSingleInstanceAuditRunInternal,
  planInstanceKeycloakProvisioningInternal: state.planInstanceKeycloakProvisioningInternal,
  probeTenantIamAccessInternal: state.probeTenantIamAccessInternal,
  reconcileInstanceKeycloakInternal: state.reconcileInstanceKeycloakInternal,
}));

describe('iam-instance-registry server handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('wraps audit endpoints with request context and authenticated access', async () => {
    const subject = await import('./server.js');
    const request = new Request('https://example.test/api/v1/iam/instances/audit');

    await subject.instanceRegistryHandlers.getInstanceAuditRun(request);
    await subject.instanceRegistryHandlers.getSingleInstanceAuditRun(request);

    expect(state.withRequestContext).toHaveBeenCalledTimes(2);
    expect(state.withAuthenticatedUser).toHaveBeenCalledTimes(2);
    expect(state.getInstanceAuditRunInternal).toHaveBeenCalledWith(request, { user: { id: 'actor-1' } });
    expect(state.getSingleInstanceAuditRunInternal).toHaveBeenCalledWith(request, { user: { id: 'actor-1' } });
  });

  it('returns a JSON error response for unexpected authenticated handler failures', async () => {
    state.withAuthenticatedUser.mockRejectedValueOnce(new Error('boom'));
    const subject = await import('./server.js');

    const response = await subject.instanceRegistryHandlers.getInstanceAuditRun(
      new Request('https://example.test/api/v1/iam/instances/audit')
    );

    expect(response.status).toBe(500);
    expect(state.toJsonErrorResponse).toHaveBeenCalledWith(
      500,
      'internal_error',
      'Unbehandelter Instanzverwaltungsfehler.',
      { requestId: 'req-1' }
    );
  });
});
