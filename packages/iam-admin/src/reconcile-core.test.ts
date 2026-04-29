import { describe, expect, it, vi } from 'vitest';

import { runRoleCatalogReconciliation, type RoleCatalogReconciliationDeps } from './reconcile-core.js';

const createIdentityProvider = () => ({
  listRoles: vi.fn(async () => []),
  getRoleByName: vi.fn(async () => null),
});

const createDeps = (overrides: Partial<RoleCatalogReconciliationDeps> = {}): RoleCatalogReconciliationDeps => ({
  resolveIdentityProviderForInstance: vi.fn(async () => ({ provider: createIdentityProvider() as never })),
  withInstanceScopedDb: vi.fn(async (_instanceId, work) =>
    work({
      query: vi.fn(async () => ({ rows: [] })),
    } as never)
  ),
  setRoleSyncState: vi.fn(async () => undefined),
  emitRoleAuditEvent: vi.fn(async () => undefined),
  trackKeycloakCall: vi.fn(async (_operation, execute) => execute()),
  setRoleDriftBacklog: vi.fn(),
  ...overrides,
});

describe('runRoleCatalogReconciliation', () => {
  it('resolves the tenant-local identity provider for the target instance', async () => {
    const deps = createDeps();

    const report = await runRoleCatalogReconciliation({
      deps,
      instanceId: 'tenant-a',
      requestId: 'req-1',
    });

    expect(deps.resolveIdentityProviderForInstance).toHaveBeenCalledWith('tenant-a');
    expect(report).toMatchObject({
      outcome: 'success',
      checkedCount: 0,
      failedCount: 0,
      requiresManualActionCount: 0,
    });
  });

  it('fails closed when the tenant-local identity provider cannot be resolved', async () => {
    const deps = createDeps({
      resolveIdentityProviderForInstance: vi.fn(async () => null),
    });

    await expect(
      runRoleCatalogReconciliation({
        deps,
        instanceId: 'tenant-a',
      })
    ).rejects.toThrow('identity_provider_unavailable');
    expect(deps.withInstanceScopedDb).not.toHaveBeenCalled();
  });
});
