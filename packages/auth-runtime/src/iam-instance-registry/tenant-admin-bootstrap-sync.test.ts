import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  resolveIdentityProviderForInstance: vi.fn(),
  withInstanceScopedDb: vi.fn(),
  jitProvisionAccountWithClient: vi.fn(),
  resolveRolesByExternalNames: vi.fn(),
  assignRoles: vi.fn(),
  notifyPermissionInvalidation: vi.fn(),
  client: {
    query: vi.fn(),
  },
}));

vi.mock('../iam-account-management/shared-runtime.js', () => ({
  resolveIdentityProviderForInstance: state.resolveIdentityProviderForInstance,
  withInstanceScopedDb: state.withInstanceScopedDb,
}));

vi.mock('../jit-provisioning.js', () => ({
  jitProvisionAccountWithClient: state.jitProvisionAccountWithClient,
}));

vi.mock('../iam-account-management/shared.js', () => ({
  assignRoles: state.assignRoles,
  notifyPermissionInvalidation: state.notifyPermissionInvalidation,
  resolveRolesByExternalNames: state.resolveRolesByExternalNames,
}));

describe('tenant admin bootstrap sync', () => {
  beforeEach(() => {
    state.resolveIdentityProviderForInstance.mockReset();
    state.withInstanceScopedDb.mockReset();
    state.jitProvisionAccountWithClient.mockReset();
    state.resolveRolesByExternalNames.mockReset();
    state.assignRoles.mockReset();
    state.notifyPermissionInvalidation.mockReset();
    state.client.query.mockReset();

    state.withInstanceScopedDb.mockImplementation(async (_instanceId, work) => work(state.client));
    state.resolveIdentityProviderForInstance.mockResolvedValue({
      provider: {
        listUsers: vi.fn(async (query?: { username?: string; email?: string }) => {
          if (query?.username === 'tenant.admin') {
            return [{ externalId: 'kc-user-1', username: 'tenant.admin' }];
          }
          return [];
        }),
      },
    });
    state.jitProvisionAccountWithClient.mockResolvedValue({
      accountId: 'account-1',
      created: false,
    });
    state.resolveRolesByExternalNames.mockResolvedValue([
      { id: 'role-system-admin', role_key: 'system_admin' },
    ]);
    state.client.query.mockResolvedValue({
      rows: [{ role_id: 'role-existing' }],
    });
    state.assignRoles.mockResolvedValue(undefined);
    state.notifyPermissionInvalidation.mockResolvedValue(undefined);
  });

  it('skips the sync when no bootstrap username is configured', async () => {
    const { syncTenantAdminBootstrapAccount } = await import('./tenant-admin-bootstrap-sync.js');

    await expect(
      syncTenantAdminBootstrapAccount({
        instanceId: 'tenant-a',
        tenantAdminBootstrap: {
          username: '   ',
          email: 'tenant.admin@example.test',
        },
      })
    ).resolves.toBeUndefined();

    expect(state.resolveIdentityProviderForInstance).not.toHaveBeenCalled();
    expect(state.withInstanceScopedDb).not.toHaveBeenCalled();
  });

  it('jit provisions the bootstrap user locally and ensures a direct system_admin assignment', async () => {
    const { syncTenantAdminBootstrapAccount } = await import('./tenant-admin-bootstrap-sync.js');

    await expect(
      syncTenantAdminBootstrapAccount({
        instanceId: 'tenant-a',
        tenantAdminBootstrap: {
          username: 'tenant.admin',
          email: 'tenant.admin@example.test',
        },
        requestId: 'req-1',
        actorId: 'actor-1',
      })
    ).resolves.toBeUndefined();

    expect(state.resolveIdentityProviderForInstance).toHaveBeenCalledWith('tenant-a', {
      executionMode: 'tenant_admin',
    });
    expect(state.jitProvisionAccountWithClient).toHaveBeenCalledWith(state.client, {
      instanceId: 'tenant-a',
      keycloakSubject: 'kc-user-1',
      requestId: 'req-1',
      emitAuditLog: false,
    });
    expect(state.resolveRolesByExternalNames).toHaveBeenCalledWith(state.client, {
      instanceId: 'tenant-a',
      externalRoleNames: ['system_admin'],
    });
    expect(state.assignRoles).toHaveBeenCalledWith(state.client, {
      instanceId: 'tenant-a',
      accountId: 'account-1',
      existingRoleIds: ['role-existing'],
      roleIds: ['role-existing', 'role-system-admin'],
    });
    expect(state.notifyPermissionInvalidation).toHaveBeenCalledWith(state.client, {
      instanceId: 'tenant-a',
      keycloakSubject: 'kc-user-1',
      trigger: 'tenant_admin_bootstrap_sync',
    });
  });

  it('falls back to email lookup when the configured username is not found', async () => {
    const listUsers = vi.fn(async (query?: { username?: string; email?: string }) => {
      if (query?.username === 'tenant.admin') {
        return [];
      }
      if (query?.email === 'tenant.admin@example.test') {
        return [{ externalId: 'kc-user-2', email: 'tenant.admin@example.test' }];
      }
      return [];
    });
    state.resolveIdentityProviderForInstance.mockResolvedValueOnce({
      provider: {
        listUsers,
      },
    });

    const { syncTenantAdminBootstrapAccount } = await import('./tenant-admin-bootstrap-sync.js');

    await expect(
      syncTenantAdminBootstrapAccount({
        instanceId: 'tenant-a',
        tenantAdminBootstrap: {
          username: 'tenant.admin',
          email: 'tenant.admin@example.test',
        },
      })
    ).resolves.toBeUndefined();

    expect(listUsers).toHaveBeenNthCalledWith(1, {
      username: 'tenant.admin',
      max: 1,
    });
    expect(listUsers).toHaveBeenNthCalledWith(2, {
      email: 'tenant.admin@example.test',
      max: 1,
    });
    expect(state.notifyPermissionInvalidation).toHaveBeenCalledWith(state.client, {
      instanceId: 'tenant-a',
      keycloakSubject: 'kc-user-2',
      trigger: 'tenant_admin_bootstrap_sync',
    });
  });

  it('keeps the sync idempotent when system_admin is already assigned directly', async () => {
    state.client.query.mockResolvedValue({
      rows: [
        { role_id: 'role-existing' },
        { role_id: 'role-system-admin' },
      ],
    });

    const { syncTenantAdminBootstrapAccount } = await import('./tenant-admin-bootstrap-sync.js');

    await expect(
      syncTenantAdminBootstrapAccount({
        instanceId: 'tenant-a',
        tenantAdminBootstrap: {
          username: 'tenant.admin',
        },
      })
    ).resolves.toBeUndefined();

    expect(state.assignRoles).toHaveBeenCalledWith(state.client, {
      instanceId: 'tenant-a',
      accountId: 'account-1',
      existingRoleIds: ['role-existing', 'role-system-admin'],
      roleIds: ['role-existing', 'role-system-admin'],
    });
  });
});
