import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  const handlers = {
    listInstances: vi.fn(async () => new Response('list')),
    getInstance: vi.fn(async () => new Response('get')),
    createInstance: vi.fn(async () => new Response('create')),
    updateInstance: vi.fn(async () => new Response('update')),
  };

  return {
    asApiItem: vi.fn(),
    asApiList: vi.fn(),
    createApiError: vi.fn(),
    requireIdempotencyKey: vi.fn(),
    validateCsrf: vi.fn(),
    jsonResponse: vi.fn(),
    buildLogContext: vi.fn(() => ({ request_id: 'req-1', trace_id: 'trace-1' })),
    createSdkLogger: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
    getWorkspaceContext: vi.fn(() => ({ requestId: 'workspace-request' })),
    createInstanceRegistryHttpHandlers: vi.fn(() => handlers),
    handlers,
    ensurePlatformAccess: vi.fn(),
    requireFreshReauth: vi.fn(),
    assignInstanceModuleMutation: vi.fn(async () => new Response('assign')),
    bootstrapInstanceAdminStructureMutation: vi.fn(async () => new Response('bootstrap')),
    mapInstanceMutationError: vi.fn(),
    mutateInstanceStatus: vi.fn(async (_request, _ctx, nextStatus: string) => new Response(nextStatus)),
    revokeInstanceModuleMutation: vi.fn(async () => new Response('revoke')),
    seedInstanceIamBaselineMutation: vi.fn(async () => new Response('seed')),
    parseRegistryRequestBody: vi.fn(),
    withRegistryService: vi.fn(),
  };
});

vi.mock('../iam-account-management/api-helpers.js', () => ({
  asApiItem: state.asApiItem,
  asApiList: state.asApiList,
  createApiError: state.createApiError,
  requireIdempotencyKey: state.requireIdempotencyKey,
}));

vi.mock('../iam-account-management/csrf.js', () => ({
  validateCsrf: state.validateCsrf,
}));

vi.mock('../db.js', () => ({
  jsonResponse: state.jsonResponse,
}));

vi.mock('../log-context.js', () => ({
  buildLogContext: state.buildLogContext,
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: state.createSdkLogger,
  getWorkspaceContext: state.getWorkspaceContext,
}));

vi.mock('@sva/instance-registry/http-instance-handlers', () => ({
  createInstanceRegistryHttpHandlers: state.createInstanceRegistryHttpHandlers,
}));

vi.mock('./http.js', () => ({
  ensurePlatformAccess: state.ensurePlatformAccess,
  requireFreshReauth: state.requireFreshReauth,
}));

vi.mock('./core-mutations.js', () => ({
  assignInstanceModuleMutation: state.assignInstanceModuleMutation,
  bootstrapInstanceAdminStructureMutation: state.bootstrapInstanceAdminStructureMutation,
  mapInstanceMutationError: state.mapInstanceMutationError,
  mutateInstanceStatus: state.mutateInstanceStatus,
  revokeInstanceModuleMutation: state.revokeInstanceModuleMutation,
  seedInstanceIamBaselineMutation: state.seedInstanceIamBaselineMutation,
}));

vi.mock('./request-parsing.js', () => ({
  parseRegistryRequestBody: state.parseRegistryRequestBody,
}));

vi.mock('./repository.js', () => ({
  withRegistryService: state.withRegistryService,
}));

describe('iam-instance-registry core handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('configures the generated instance handlers with auth-runtime adapters and provisioning logging', async () => {
    await import('./core.js');

    const config = state.createInstanceRegistryHttpHandlers.mock.calls[0]?.[0];
    expect(config).toBeDefined();
    expect(config.getRequestId()).toBe('workspace-request');
    expect(config.getActor({ user: { id: 'actor-1' } })).toEqual({ id: 'actor-1' });
    expect(config.parseRequestBody).toBe(state.parseRegistryRequestBody);
    expect(config.requireIdempotencyKey).toBe(state.requireIdempotencyKey);
    expect(config.ensurePlatformAccess).toBe(state.ensurePlatformAccess);
    expect(config.validateCsrf).toBe(state.validateCsrf);
    expect(config.requireFreshReauth).toBe(state.requireFreshReauth);
    expect(config.withRegistryService).toBe(state.withRegistryService);
    expect(config.mapMutationError).toBe(state.mapInstanceMutationError);

    config.onInstanceProvisioningRequested({
      instanceId: 'instance-1',
      primaryHostname: 'tenant.example.test',
      actorId: 'actor-1',
    });

    const logger = state.createSdkLogger.mock.results[0]?.value;
    expect(logger.info).toHaveBeenCalledWith(
      'Instance provisioning requested',
      expect.objectContaining({
        operation: 'instance_create',
        instance_id: 'instance-1',
        primary_hostname: 'tenant.example.test',
        actor_id: 'actor-1',
        request_id: 'req-1',
        trace_id: 'trace-1',
      })
    );
  });

  it('delegates list/get/create/update requests to the generated instance handlers', async () => {
    const subject = await import('./core.js');
    const request = new Request('https://example.test/api/v1/instances');
    const ctx = { user: { id: 'actor-1' } } as never;

    await subject.listInstancesInternal(request, ctx);
    await subject.getInstanceInternal(request, ctx);
    await subject.createInstanceInternal(request, ctx);
    await subject.updateInstanceInternal(request, ctx);

    expect(state.handlers.listInstances).toHaveBeenCalledWith(request, ctx);
    expect(state.handlers.getInstance).toHaveBeenCalledWith(request, ctx);
    expect(state.handlers.createInstance).toHaveBeenCalledWith(request, ctx);
    expect(state.handlers.updateInstance).toHaveBeenCalledWith(request, ctx);
  });

  it('forwards status and module mutations to the dedicated mutation helpers', async () => {
    const subject = await import('./core.js');
    const request = new Request('https://example.test/api/v1/instances');
    const ctx = { user: { id: 'actor-1' } } as never;

    await subject.activateInstanceInternal(request, ctx);
    await subject.suspendInstanceInternal(request, ctx);
    await subject.archiveInstanceInternal(request, ctx);
    await subject.assignInstanceModuleInternal(request, ctx);
    await subject.bootstrapInstanceAdminStructureInternal(request, ctx);
    await subject.revokeInstanceModuleInternal(request, ctx);
    await subject.seedInstanceIamBaselineInternal(request, ctx);

    expect(state.mutateInstanceStatus).toHaveBeenNthCalledWith(1, request, ctx, 'active');
    expect(state.mutateInstanceStatus).toHaveBeenNthCalledWith(2, request, ctx, 'suspended');
    expect(state.mutateInstanceStatus).toHaveBeenNthCalledWith(3, request, ctx, 'archived');
    expect(state.assignInstanceModuleMutation).toHaveBeenCalledWith(request, ctx);
    expect(state.bootstrapInstanceAdminStructureMutation).toHaveBeenCalledWith(request, ctx);
    expect(state.revokeInstanceModuleMutation).toHaveBeenCalledWith(request, ctx);
    expect(state.seedInstanceIamBaselineMutation).toHaveBeenCalledWith(request, ctx);
  });
});
