import { describe, expect, it, vi } from 'vitest';

import { runRoleCatalogReconciliation, type RoleCatalogReconciliationDeps } from './reconcile-core.js';

const createIdentityProvider = () => ({
  listRoles: vi.fn(async () => []),
  getRoleByName: vi.fn(async () => null),
});

const createRealmRole = (input: {
  readonly description: string;
  readonly displayName: string;
  readonly externalName: string;
  readonly roleKey: string;
  readonly roleLevel?: number;
}) => ({
  externalName: input.externalName,
  description: input.description,
  clientRole: false,
  attributes: {
    managed_by: ['studio'],
    instance_id: ['tenant-a'],
    role_key: [input.roleKey],
    display_name: [input.displayName],
    ...(input.roleLevel === undefined ? {} : { role_level: [String(input.roleLevel)] }),
  },
});

const createDatabaseRole = (
  overrides: Partial<{
    readonly description: string;
    readonly display_name: string;
    readonly external_role_name: string;
    readonly id: string;
    readonly is_system_role: boolean;
    readonly last_error_code: string | null;
    readonly last_synced_at: string | null;
    readonly managed_by: string;
    readonly role_key: string;
    readonly role_level: number;
    readonly role_name: string;
    readonly sync_state: string;
  }>
) => ({
  id: 'role-1',
  role_key: 'system_admin',
  role_name: 'system_admin',
  display_name: 'System Admin',
  external_role_name: 'system_admin',
  description: 'Canonical description',
  is_system_role: false,
  role_level: 0,
  managed_by: 'studio',
  sync_state: 'failed',
  last_synced_at: null,
  last_error_code: 'OLD_ERROR',
  ...overrides,
});

const createScopedDbWithRoles = (rows: readonly unknown[]) =>
  vi.fn(async (_instanceId, work) =>
    work({
      query: vi.fn(async (sql: string) => (sql.includes('SELECT\n  id,') ? { rows } : { rows: [] })),
    } as never)
  );

const expectRoleSyncMarkedSynced = (deps: RoleCatalogReconciliationDeps, roleId: string) => {
  expect(deps.setRoleSyncState).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      instanceId: 'tenant-a',
      roleId,
      syncState: 'synced',
      errorCode: null,
      syncedAt: true,
    })
  );
};

const createSystemAdminProviderResolver = (input: {
  readonly description: string;
  readonly displayName: string;
  readonly updateRole: ReturnType<typeof vi.fn>;
}) =>
  vi.fn(async () => ({
    provider: {
      listRoles: vi.fn(async () => [
        createRealmRole({
          externalName: 'system_admin',
          description: input.description,
          roleKey: 'system_admin',
          displayName: input.displayName,
        }),
      ]),
      getRoleByName: vi.fn(async () => null),
      updateRole: input.updateRole,
    } as never,
  }));

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

  it('ignores root-only database roles during tenant reconciliation', async () => {
    const createRole = vi.fn(async () => undefined);
    const updateRole = vi.fn(async () => undefined);
    const deps = createDeps({
      resolveIdentityProviderForInstance: vi.fn(async () => ({
        provider: {
          listRoles: vi.fn(async () => []),
          getRoleByName: vi.fn(async () => null),
          createRole,
          updateRole,
        } as never,
      })),
      withInstanceScopedDb: createScopedDbWithRoles([
        createDatabaseRole({
          id: 'role-root-only',
          role_key: 'instance_registry_admin',
          role_name: 'instance_registry_admin',
          display_name: 'Instance Registry Administrator',
          external_role_name: 'instance_registry_admin',
          description: '[legacy-root-role-in-tenant]',
          role_level: 100,
          sync_state: 'pending',
          last_error_code: null,
        }),
      ]),
    });

    const report = await runRoleCatalogReconciliation({
      deps,
      instanceId: 'tenant-a',
      requestId: 'req-1',
    });

    expect(report).toMatchObject({
      outcome: 'success',
      checkedCount: 0,
      correctedCount: 0,
      failedCount: 0,
      manualReviewCount: 0,
      requiresManualActionCount: 0,
      roles: [],
    });
    expect(createRole).not.toHaveBeenCalled();
    expect(updateRole).not.toHaveBeenCalled();
    expect(deps.setRoleDriftBacklog).toHaveBeenCalledWith('tenant-a', 0);
  });

  it('reports non-technical managed Keycloak roles as manual drift instead of importing them', async () => {
    const insertAttempts: string[] = [];
    const deps = createDeps({
      resolveIdentityProviderForInstance: vi.fn(async () => ({
        provider: {
          listRoles: vi.fn(async () => [
            createRealmRole({
              externalName: 'mainserver_editor',
              description: 'Canonical editor role',
              roleKey: 'mainserver_editor',
              displayName: 'Editor',
              roleLevel: 0,
            }),
            createRealmRole({
              externalName: 'Editor',
              description: 'Alias editor role',
              roleKey: 'mainserver_editor',
              displayName: 'Editor',
              roleLevel: 0,
            }),
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
      outcome: 'failed',
      correctedCount: 0,
      failedCount: 0,
      manualReviewCount: 2,
    });
    expect(insertAttempts).toHaveLength(0);
    expect(report.roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalRoleName: 'mainserver_editor',
          action: 'report',
          status: 'requires_manual_action',
        }),
      ])
    );
  });

	  it('updates mismatched managed roles and persists synced reconcile state', async () => {
	    const updateRole = vi.fn(async () => undefined);
	    const deps = createDeps({
	      resolveIdentityProviderForInstance: createSystemAdminProviderResolver({
	        description: 'Outdated description',
	        displayName: 'Old display name',
	        updateRole,
	      }),
      withInstanceScopedDb: createScopedDbWithRoles([
        createDatabaseRole({
          id: 'role-1',
          last_error_code: 'PREVIOUS_ERROR',
        }),
      ]),
    });

    const report = await runRoleCatalogReconciliation({
      deps,
      instanceId: 'tenant-a',
      requestId: 'req-1',
      traceId: 'trace-1',
    });

    expect(updateRole).toHaveBeenCalledWith('system_admin', {
      description: 'Canonical description',
      attributes: {
        managedBy: 'studio',
        instanceId: 'tenant-a',
        roleKey: 'system_admin',
        displayName: 'System Admin',
      },
    });
    expectRoleSyncMarkedSynced(deps, 'role-1');
    expect(report).toMatchObject({
      outcome: 'success',
      correctedCount: 1,
      failedCount: 0,
      roles: [
        {
          roleId: 'role-1',
          roleKey: 'system_admin',
          externalRoleName: 'system_admin',
          action: 'update',
          status: 'corrected',
        },
      ],
    });
  });

	  it('accepts canonical identity roles for legacy external-name aliases without forcing an idp update', async () => {
	    const updateRole = vi.fn(async () => undefined);
	    const deps = createDeps({
	      resolveIdentityProviderForInstance: createSystemAdminProviderResolver({
	        description: 'Canonical description',
	        displayName: 'System Admin',
	        updateRole,
	      }),
      withInstanceScopedDb: createScopedDbWithRoles([
        createDatabaseRole({
          id: 'role-legacy-alias',
          external_role_name: 'System Admin',
        }),
      ]),
    });

    const report = await runRoleCatalogReconciliation({
      deps,
      instanceId: 'tenant-a',
      requestId: 'req-alias',
    });

    expect(updateRole).not.toHaveBeenCalled();
    expectRoleSyncMarkedSynced(deps, 'role-legacy-alias');
    expect(report).toMatchObject({
      outcome: 'success',
      correctedCount: 1,
      failedCount: 0,
      roles: [
        {
          roleId: 'role-legacy-alias',
          roleKey: 'system_admin',
          externalRoleName: 'System Admin',
          action: 'noop',
          status: 'corrected',
        },
      ],
    });
  });

  it('reports partial failures when a technical role is repaired and a legacy Keycloak role needs manual review', async () => {
    const createRole = vi.fn(async () => undefined);
    const deps = createDeps({
      resolveIdentityProviderForInstance: vi.fn(async () => ({
        provider: {
          listRoles: vi.fn(async () => [
            createRealmRole({
              externalName: 'legacy_editor',
              description: 'Legacy editor role',
              roleKey: 'legacy_editor',
              displayName: 'Legacy editor',
            }),
          ]),
          getRoleByName: vi.fn(async () => null),
          createRole,
          updateRole: vi.fn(async () => undefined),
        } as never,
      })),
      withInstanceScopedDb: createScopedDbWithRoles([
        createDatabaseRole({
          id: 'role-system-admin',
        }),
      ]),
    });

    const report = await runRoleCatalogReconciliation({
      deps,
      instanceId: 'tenant-a',
      requestId: 'req-partial',
    });

    expect(report).toMatchObject({
      outcome: 'partial_failure',
      correctedCount: 1,
      failedCount: 0,
      requiresManualActionCount: 1,
    });
    expect(report.roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ roleKey: 'system_admin', status: 'corrected' }),
        expect.objectContaining({
          roleKey: 'legacy_editor',
          externalRoleName: 'legacy_editor',
          status: 'requires_manual_action',
          errorCode: 'REQUIRES_MANUAL_ACTION',
        }),
      ])
    );
  });
});
