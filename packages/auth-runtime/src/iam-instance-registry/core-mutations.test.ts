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
}));

describe('iam-instance-registry core mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
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
    expect(config.validateCsrf).toBe(state.validateCsrf);
    expect(config.requireFreshReauth).toBe(state.requireFreshReauth);
    expect(config.withRegistryService).toBe(state.withRegistryService);
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
