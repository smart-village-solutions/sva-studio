import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  createExecuteKeycloakProvisioningHandler: vi.fn((deps) => ({ kind: 'execute', deps })),
  createGetKeycloakPreflightHandler: vi.fn((deps) => ({ kind: 'preflight', deps })),
  createGetKeycloakProvisioningRunHandler: vi.fn(),
  createGetKeycloakStatusHandler: vi.fn((deps) => ({ kind: 'status', deps })),
  createPlanKeycloakProvisioningHandler: vi.fn((deps) => ({ kind: 'plan', deps })),
  createReconcileKeycloakHandler: vi.fn((deps) => ({ kind: 'reconcile', deps })),
  createRuntimeResolver: vi.fn(),
  decryptAuthClientSecretTarget: vi.fn((_deps, instanceId, ciphertext) =>
    ciphertext ? `${instanceId}:${ciphertext}:auth` : undefined
  ),
  decryptTenantAdminClientSecretTarget: vi.fn((_deps, instanceId, ciphertext) =>
    ciphertext ? `${instanceId}:${ciphertext}:tenant` : undefined
  ),
  loadInstanceWithSecretTarget: vi.fn((deps, instanceId) => ({ deps, instanceId })),
  loadRepositoryAuthClientSecretTarget: vi.fn(async (_deps, repository, instanceId) => ({
    repository,
    instanceId,
    type: 'auth',
  })),
  loadRepositoryTenantAdminClientSecretTarget: vi.fn(async (_deps, repository, instanceId) => ({
    repository,
    instanceId,
    type: 'tenant',
  })),
  withAuthInstanceRegistryDeps: vi.fn((deps) => ({ ...deps, enriched: true })),
}));

vi.mock('@sva/instance-registry/service-keycloak', () => ({
  createExecuteKeycloakProvisioningHandler: state.createExecuteKeycloakProvisioningHandler,
  createGetKeycloakPreflightHandler: state.createGetKeycloakPreflightHandler,
  createGetKeycloakProvisioningRunHandler: state.createGetKeycloakProvisioningRunHandler,
  createGetKeycloakStatusHandler: state.createGetKeycloakStatusHandler,
  createPlanKeycloakProvisioningHandler: state.createPlanKeycloakProvisioningHandler,
  createReconcileKeycloakHandler: state.createReconcileKeycloakHandler,
  createRuntimeResolver: state.createRuntimeResolver,
  decryptAuthClientSecret: state.decryptAuthClientSecretTarget,
  decryptTenantAdminClientSecret: state.decryptTenantAdminClientSecretTarget,
  loadInstanceWithSecret: state.loadInstanceWithSecretTarget,
  loadRepositoryAuthClientSecret: state.loadRepositoryAuthClientSecretTarget,
  loadRepositoryTenantAdminClientSecret: state.loadRepositoryTenantAdminClientSecretTarget,
}));

vi.mock('./instance-registry-deps.js', () => ({
  withAuthInstanceRegistryDeps: state.withAuthInstanceRegistryDeps,
}));

describe('iam-instance-registry service-keycloak bindings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('decrypts inline and repository secrets through enriched auth registry deps', async () => {
    const subject = await import('./service-keycloak.js');
    const repository = { name: 'repo' } as never;

    expect(subject.decryptAuthClientSecret('instance-1', 'cipher')).toBe('instance-1:cipher:auth');
    expect(subject.decryptTenantAdminClientSecret('instance-1', 'cipher')).toBe('instance-1:cipher:tenant');
    await expect(subject.loadRepositoryAuthClientSecret(repository, 'instance-1')).resolves.toEqual({
      repository,
      instanceId: 'instance-1',
      type: 'auth',
    });
    await expect(subject.loadRepositoryTenantAdminClientSecret(repository, 'instance-1')).resolves.toEqual({
      repository,
      instanceId: 'instance-1',
      type: 'tenant',
    });

    expect(state.withAuthInstanceRegistryDeps).toHaveBeenCalledWith({});
    expect(state.decryptAuthClientSecretTarget).toHaveBeenCalledWith(
      expect.objectContaining({ enriched: true }),
      'instance-1',
      'cipher'
    );
    expect(state.loadRepositoryAuthClientSecretTarget).toHaveBeenCalledWith(
      expect.objectContaining({ enriched: true }),
      repository,
      'instance-1'
    );
  });

  it('enriches injected service deps before binding target handlers and loaders', async () => {
    const subject = await import('./service-keycloak.js');
    const deps = { invalidateHost: vi.fn() };

    expect(subject.loadInstanceWithSecret(deps as never, 'instance-1')).toEqual({
      deps: { ...deps, enriched: true },
      instanceId: 'instance-1',
    });
    expect(subject.createGetKeycloakStatusHandler(deps as never)).toEqual({
      kind: 'status',
      deps: { ...deps, enriched: true },
    });
    expect(subject.createGetKeycloakPreflightHandler(deps as never)).toEqual({
      kind: 'preflight',
      deps: { ...deps, enriched: true },
    });
    expect(subject.createPlanKeycloakProvisioningHandler(deps as never)).toEqual({
      kind: 'plan',
      deps: { ...deps, enriched: true },
    });
    expect(subject.createExecuteKeycloakProvisioningHandler(deps as never)).toEqual({
      kind: 'execute',
      deps: { ...deps, enriched: true },
    });
    expect(subject.createReconcileKeycloakHandler(deps as never)).toEqual({
      kind: 'reconcile',
      deps: { ...deps, enriched: true },
    });
  });
});
