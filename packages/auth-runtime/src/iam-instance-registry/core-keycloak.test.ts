import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  const keycloakHandlers = {
    getInstanceKeycloakStatus: vi.fn(async () => new Response('status')),
    getInstanceKeycloakPreflight: vi.fn(async () => new Response('preflight')),
    planInstanceKeycloakProvisioning: vi.fn(async () => new Response('plan')),
    getInstanceKeycloakProvisioningRun: vi.fn(async () => new Response('run')),
  };
  const auditHandlers = {
    getInstanceAuditRun: vi.fn(async () => new Response('audit-run')),
    getSingleInstanceAuditRun: vi.fn(async () => new Response('single-audit-run')),
  };

  return {
    asApiItem: vi.fn(),
    createApiError: vi.fn(),
    validateCsrf: vi.fn(),
    jsonResponse: vi.fn(),
    getWorkspaceContext: vi.fn(() => ({ requestId: 'workspace-request' })),
    createInstanceRegistryKeycloakHttpHandlers: vi.fn(() => keycloakHandlers),
    createInstanceRegistryAuditHttpHandlers: vi.fn(() => auditHandlers),
    ensurePlatformAccess: vi.fn(),
    requireFreshReauth: vi.fn(),
    executeInstanceKeycloakProvisioningMutation: vi.fn(async () => new Response('execute')),
    mapInstanceMutationError: vi.fn(),
    probeTenantIamAccessMutation: vi.fn(async () => new Response('probe')),
    reconcileInstanceKeycloakMutation: vi.fn(async () => new Response('reconcile')),
    withRegistryService: vi.fn(),
    keycloakHandlers,
    auditHandlers,
  };
});

vi.mock('../iam-account-management/api-helpers.js', () => ({
  asApiItem: state.asApiItem,
  createApiError: state.createApiError,
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

vi.mock('@sva/instance-registry', () => ({
  createInstanceRegistryAuditHttpHandlers: state.createInstanceRegistryAuditHttpHandlers,
  createInstanceRegistryKeycloakHttpHandlers: state.createInstanceRegistryKeycloakHttpHandlers,
}));

vi.mock('./http.js', () => ({
  ensurePlatformAccess: state.ensurePlatformAccess,
  requireFreshReauth: state.requireFreshReauth,
}));

vi.mock('./core-mutations.js', () => ({
  executeInstanceKeycloakProvisioningMutation: state.executeInstanceKeycloakProvisioningMutation,
  mapInstanceMutationError: state.mapInstanceMutationError,
  probeTenantIamAccessMutation: state.probeTenantIamAccessMutation,
  reconcileInstanceKeycloakMutation: state.reconcileInstanceKeycloakMutation,
}));

vi.mock('./repository.js', () => ({
  withRegistryService: state.withRegistryService,
}));

describe('iam-instance-registry core-keycloak handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('configures generated audit and keycloak handlers with auth-runtime adapters', async () => {
    await import('./core-keycloak.js');

    const keycloakConfig = state.createInstanceRegistryKeycloakHttpHandlers.mock.calls[0]?.[0];
    expect(keycloakConfig).toBeDefined();
    expect(keycloakConfig.getRequestId()).toBe('workspace-request');
    expect(keycloakConfig.asApiItem).toBe(state.asApiItem);
    expect(keycloakConfig.ensurePlatformAccess).toBe(state.ensurePlatformAccess);
    expect(keycloakConfig.validateCsrf).toBe(state.validateCsrf);
    expect(keycloakConfig.requireFreshReauth).toBe(state.requireFreshReauth);
    expect(keycloakConfig.withRegistryService).toBe(state.withRegistryService);
    expect(keycloakConfig.mapMutationError).toBe(state.mapInstanceMutationError);

    const auditConfig = state.createInstanceRegistryAuditHttpHandlers.mock.calls[0]?.[0];
    expect(auditConfig).toBeDefined();
    expect(auditConfig.getRequestId()).toBe('workspace-request');
    expect(auditConfig.asApiItem).toBe(state.asApiItem);
    expect(auditConfig.ensurePlatformAccess).toBe(state.ensurePlatformAccess);
    expect(auditConfig.withRegistryService).toBe(state.withRegistryService);
    expect(auditConfig.mapReadError).toBe(state.mapInstanceMutationError);
    expect(auditConfig.getActorId({ user: { id: 'actor-1' } })).toBe('actor-1');
  });

  it('delegates audit and keycloak reads to the generated handlers', async () => {
    const subject = await import('./core-keycloak.js');
    const request = new Request('https://example.test/api/v1/iam/instances/demo/audit');
    const ctx = { user: { id: 'actor-1' } } as never;

    await subject.getInstanceAuditRunInternal(request, ctx);
    await subject.getSingleInstanceAuditRunInternal(request, ctx);
    await subject.getInstanceKeycloakStatusInternal(request, ctx);
    await subject.getInstanceKeycloakPreflightInternal(request, ctx);
    await subject.planInstanceKeycloakProvisioningInternal(request, ctx);
    await subject.getInstanceKeycloakProvisioningRunInternal(request, ctx);

    expect(state.auditHandlers.getInstanceAuditRun).toHaveBeenCalledWith(request, ctx);
    expect(state.auditHandlers.getSingleInstanceAuditRun).toHaveBeenCalledWith(request, ctx);
    expect(state.keycloakHandlers.getInstanceKeycloakStatus).toHaveBeenCalledWith(request, ctx);
    expect(state.keycloakHandlers.getInstanceKeycloakPreflight).toHaveBeenCalledWith(request, ctx);
    expect(state.keycloakHandlers.planInstanceKeycloakProvisioning).toHaveBeenCalledWith(request, ctx);
    expect(state.keycloakHandlers.getInstanceKeycloakProvisioningRun).toHaveBeenCalledWith(request, ctx);
  });
});
