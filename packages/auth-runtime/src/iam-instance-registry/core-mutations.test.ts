import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  const handlers = {
    reconcileInstanceKeycloak: vi.fn(async () => new Response('reconcile')),
    executeInstanceKeycloakProvisioning: vi.fn(async () => new Response('execute')),
    assignModule: vi.fn(async () => new Response('assign')),
    bootstrapAdminStructure: vi.fn(async () => new Response('bootstrap')),
    revokeModule: vi.fn(async () => new Response('revoke')),
    seedIamBaseline: vi.fn(async () => new Response('seed')),
    probeTenantIamAccess: vi.fn(async () => new Response('probe')),
    mutateInstanceStatus: vi.fn(async (_request, _ctx, nextStatus: string) => new Response(nextStatus)),
  };

  return {
    asApiItem: vi.fn(),
    createApiError: vi.fn(),
    requireIdempotencyKey: vi.fn(),
    validateCsrf: vi.fn(),
    jsonResponse: vi.fn(),
    getWorkspaceContext: vi.fn(() => ({ requestId: 'workspace-request' })),
    createInstanceMutationErrorMapper: vi.fn(() => 'mapped-error'),
    createInstanceRegistryMutationHttpHandlers: vi.fn(() => handlers),
    handlers,
    ensurePlatformAccess: vi.fn(),
    requireFreshReauth: vi.fn(),
    parseRegistryRequestBody: vi.fn(),
    withRegistryService: vi.fn(),
    withScopedRegistryService: vi.fn(),
    loadWasteTenantProvisioningRecord: vi.fn(),
    startPluginOperationJobFromFacade: vi.fn(),
    loggerError: vi.fn(),
  };
});

vi.mock('../iam-account-management/api-helpers.js', () => ({
  asApiItem: state.asApiItem,
  createApiError: state.createApiError,
  requireIdempotencyKey: state.requireIdempotencyKey,
}));

vi.mock('../iam-account-management/csrf.js', () => ({
  validateCsrf: state.validateCsrf,
}));

vi.mock('../db.js', () => ({
  jsonResponse: state.jsonResponse,
}));

vi.mock('@sva/server-runtime', () => ({
  getWorkspaceContext: state.getWorkspaceContext,
  createSdkLogger: vi.fn(() => ({ error: state.loggerError })),
}));

vi.mock('@sva/data-repositories/server', () => ({
  loadWasteTenantProvisioningRecord: state.loadWasteTenantProvisioningRecord,
}));

vi.mock('../waste-management/core/operations-support.js', () => ({
  startPluginOperationJobFromFacade: state.startPluginOperationJobFromFacade,
}));

vi.mock('@sva/instance-registry/http-mutation-handlers', () => ({
  createInstanceMutationErrorMapper: state.createInstanceMutationErrorMapper,
  createInstanceRegistryMutationHttpHandlers: state.createInstanceRegistryMutationHttpHandlers,
}));

vi.mock('./http.js', () => ({
  ensurePlatformAccess: state.ensurePlatformAccess,
  requireFreshReauth: state.requireFreshReauth,
}));

vi.mock('./request-parsing.js', () => ({
  parseRegistryRequestBody: state.parseRegistryRequestBody,
}));

vi.mock('./repository.js', () => ({
  withRegistryService: state.withRegistryService,
  withScopedRegistryService: state.withScopedRegistryService,
}));

describe('iam-instance-registry core mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    state.startPluginOperationJobFromFacade.mockResolvedValue(new Response(null, { status: 202 }));
  });

  it('enqueues tenant provisioning after waste assignment and bootstrap', async () => {
    state.loadWasteTenantProvisioningRecord.mockResolvedValue({
      status: 'provisioning',
      desiredGeneration: 2,
    });
    state.handlers.assignModule.mockResolvedValueOnce(
      Response.json({ data: { instanceId: 'inst-waste', assignedModules: ['waste-management'] } })
    );
    state.handlers.bootstrapAdminStructure.mockResolvedValueOnce(
      Response.json({ data: { instanceId: 'inst-bootstrap', assignedModules: ['news', 'waste-management'] } })
    );
    const subject = await import('./core-mutations.js');
    const ctx = { user: { id: 'actor-1' } } as never;

    await subject.assignInstanceModuleMutation(
      new Request('https://example.test/api/v1/instances/inst-waste/modules', {
        method: 'POST',
        body: JSON.stringify({ moduleId: 'waste-management' }),
      }),
      ctx
    );
    await subject.bootstrapInstanceAdminStructureMutation(
      new Request('https://example.test/api/v1/instances/inst-bootstrap/bootstrap', {
        method: 'POST',
      }),
      ctx
    );

    expect(state.startPluginOperationJobFromFacade).toHaveBeenCalledTimes(2);
    expect(state.startPluginOperationJobFromFacade).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        instanceId: 'inst-waste',
        idempotencyKey: 'waste-provisioning:inst-waste:2',
        data: expect.objectContaining({
          jobTypeId: 'waste-management.provision-tenant-database',
          input: { operation: 'provision-tenant-database', desiredGeneration: 2 },
        }),
      })
    );
    expect(state.startPluginOperationJobFromFacade).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ instanceId: 'inst-bootstrap' })
    );
  });

  it('configures mutation handlers and error mapping with auth-runtime adapters', async () => {
    const subject = await import('./core-mutations.js');

    const config = state.createInstanceRegistryMutationHttpHandlers.mock.calls[0]?.[0];
    expect(config).toBeDefined();
    expect(config.getRequestId()).toBe('workspace-request');
    expect(config.getActor({ user: { id: 'actor-1' } })).toEqual({ id: 'actor-1' });
    expect(config.parseRequestBody).toBe(state.parseRegistryRequestBody);
    expect(config.requireIdempotencyKey).toBe(state.requireIdempotencyKey);
    expect(config.ensurePlatformAccess).toBe(state.ensurePlatformAccess);
    expect(config.validateCsrf).toEqual(expect.any(Function));
    config.validateCsrf(new Request('https://studio.example/api'), 'req-csrf');
    expect(state.validateCsrf).toHaveBeenCalledWith(expect.any(Request), 'req-csrf');
    expect(config.requireFreshReauth).toBe(state.requireFreshReauth);
    expect(config.withRegistryService).toBe(state.withRegistryService);
    expect(config.withScopedRegistryService).toBe(state.withScopedRegistryService);
    expect(subject.mapInstanceMutationError).toBe('mapped-error');
    expect(state.createInstanceMutationErrorMapper).toHaveBeenCalledWith(
      expect.objectContaining({
        getRequestId: expect.any(Function),
        createApiError: expect.any(Function),
      })
    );
  });

  it('delegates all mutation wrappers and forwards the requested instance status', async () => {
    const subject = await import('./core-mutations.js');
    const request = new Request('https://example.test/api/v1/instances');
    const ctx = { user: { id: 'actor-1' } } as never;

    await subject.reconcileInstanceKeycloakMutation(request, ctx);
    await subject.executeInstanceKeycloakProvisioningMutation(request, ctx);
    await subject.assignInstanceModuleMutation(request, ctx);
    await subject.bootstrapInstanceAdminStructureMutation(request, ctx);
    await subject.revokeInstanceModuleMutation(request, ctx);
    await subject.seedInstanceIamBaselineMutation(request, ctx);
    await subject.probeTenantIamAccessMutation(request, ctx);
    await subject.mutateInstanceStatus(request, ctx, 'active');
    await subject.mutateInstanceStatus(request, ctx, 'suspended');
    await subject.mutateInstanceStatus(request, ctx, 'archived');

    expect(state.handlers.reconcileInstanceKeycloak).toHaveBeenCalledWith(request, ctx);
    expect(state.handlers.executeInstanceKeycloakProvisioning).toHaveBeenCalledWith(request, ctx);
    expect(state.handlers.assignModule).toHaveBeenCalledWith(request, ctx);
    expect(state.handlers.bootstrapAdminStructure).toHaveBeenCalledWith(request, ctx);
    expect(state.handlers.revokeModule).toHaveBeenCalledWith(request, ctx);
    expect(state.handlers.seedIamBaseline).toHaveBeenCalledWith(request, ctx);
    expect(state.handlers.probeTenantIamAccess).toHaveBeenCalledWith(request, ctx);
    expect(state.handlers.mutateInstanceStatus).toHaveBeenNthCalledWith(1, request, ctx, 'active');
    expect(state.handlers.mutateInstanceStatus).toHaveBeenNthCalledWith(2, request, ctx, 'suspended');
    expect(state.handlers.mutateInstanceStatus).toHaveBeenNthCalledWith(3, request, ctx, 'archived');
  });
});
