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

  it('ignores platform-only tenant realm roles during reconciliation', async () => {
    const deps = createDeps({
      resolveIdentityProviderForInstance: vi.fn(async () => ({
        provider: {
          listRoles: vi.fn(async () => [
            {
              externalName: 'instance_registry_admin',
              description: 'Bootstrap role for Studio tenant administration',
              clientRole: false,
              attributes: {},
            },
          ]),
          getRoleByName: vi.fn(async (name: string) =>
            name === 'instance_registry_admin'
              ? {
                  externalName: 'instance_registry_admin',
                  description: 'Bootstrap role for Studio tenant administration',
                  clientRole: false,
                  attributes: {},
                }
              : null
          ),
        } as never,
      })),
    });

    const report = await runRoleCatalogReconciliation({
      deps,
      instanceId: 'tenant-a',
      requestId: 'req-1',
    });

    expect(report).toMatchObject({
      outcome: 'success',
      checkedCount: 0,
      failedCount: 0,
      manualReviewCount: 0,
      requiresManualActionCount: 0,
      roles: [],
    });
    expect(deps.setRoleDriftBacklog).toHaveBeenCalledWith('tenant-a', 0);
  });

  it('ignores realm roles that are outside the tenant role catalog', async () => {
    const deps = createDeps({
      resolveIdentityProviderForInstance: vi.fn(async () => ({
        provider: {
          listRoles: vi.fn(async () => [
            {
              externalName: 'realm_account_admin',
              description: 'can manage users of own realm',
              clientRole: false,
              attributes: {},
            },
            {
              externalName: 'instance_registry_admin',
              description: 'Bootstrap role for Studio tenant administration',
              clientRole: false,
              attributes: {},
            },
          ]),
          getRoleByName: vi.fn(async (name: string) =>
            name === 'realm_account_admin'
              ? {
                  externalName: 'realm_account_admin',
                  description: 'can manage users of own realm',
                  clientRole: false,
                  attributes: {},
                }
              : name === 'instance_registry_admin'
                ? {
                    externalName: 'instance_registry_admin',
                    description: 'Bootstrap role for Studio tenant administration',
                    clientRole: false,
                    attributes: {},
                  }
                : null
          ),
        } as never,
      })),
    });

    const report = await runRoleCatalogReconciliation({
      deps,
      instanceId: 'tenant-a',
      requestId: 'req-1',
    });

    expect(report).toMatchObject({
      outcome: 'success',
      checkedCount: 0,
      failedCount: 0,
      manualReviewCount: 0,
      requiresManualActionCount: 0,
      roles: [],
    });
    expect(deps.setRoleDriftBacklog).toHaveBeenCalledWith('tenant-a', 0);
  });

  it('does not import the same role key twice when multiple identity roles point to one canonical role', async () => {
    const insertAttempts: string[] = [];
    const deps = createDeps({
      resolveIdentityProviderForInstance: vi.fn(async () => ({
        provider: {
          listRoles: vi.fn(async () => [
            {
              externalName: 'mainserver_editor',
              description: 'Canonical editor role',
              clientRole: false,
              attributes: {
                managed_by: ['studio'],
                instance_id: ['tenant-a'],
                role_key: ['mainserver_editor'],
                display_name: ['Editor'],
                role_level: ['0'],
              },
            },
            {
              externalName: 'Editor',
              description: 'Alias editor role',
              clientRole: false,
              attributes: {
                managed_by: ['studio'],
                instance_id: ['tenant-a'],
                role_key: ['mainserver_editor'],
                display_name: ['Editor'],
                role_level: ['0'],
              },
            },
          ]),
          getRoleByName: vi.fn(async () => null),
        } as never,
      })),
      withInstanceScopedDb: vi.fn(async (_instanceId, work) =>
        work({
          query: vi.fn(async (sql: string) => {
            if (sql.includes('SELECT\n  id,')) {
              return { rows: [] };
            }
            if (sql.includes('INSERT INTO iam.roles')) {
              insertAttempts.push('insert');
              if (insertAttempts.length > 1) {
                throw new Error('duplicate key value violates unique constraint "uq_roles_instance_role_key"');
              }
              return { rows: [{ id: 'role-import-1' }] };
            }
            return { rows: [] };
          }),
        } as never)
      ),
    });

    const report = await runRoleCatalogReconciliation({
      deps,
      instanceId: 'tenant-a',
      requestId: 'req-1',
    });

    expect(report).toMatchObject({
      outcome: 'success',
      correctedCount: 1,
      failedCount: 0,
      manualReviewCount: 0,
    });
    expect(insertAttempts).toHaveLength(1);
  });
});
