import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  createPostgresStore: vi.fn(),
  createProjection: vi.fn(),
  readRevision: vi.fn(),
  readAccess: vi.fn(),
  resolveRuntimePool: vi.fn(),
  resolveRootPool: vi.fn(),
  withTenantLock: vi.fn(),
}));

vi.mock('@sva/plugin-ssf/runtime', () => ({
  createPostgresSsfAuthorizationProjectionStore: state.createPostgresStore,
  createSsfAuthorizationProjection: state.createProjection,
  readReadySsfAuthorizationRevision: state.readRevision,
  resolveSsfDatabasePool: state.resolveRuntimePool,
  resolveSsfRootDatabasePool: state.resolveRootPool,
  SSF_TENANT_PERMISSION_IDS: [
    'ssf.configuration.tenant.read',
    'ssf.configuration.tenant.manage',
  ],
}));

vi.mock('../plugin-tenant-lifecycle/access.js', () => ({
  readConfiguredPluginTenantAccess: state.readAccess,
}));

import { withSsfAccountCreate } from './ssf-account-create.js';

describe('withSsfAccountCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.readAccess.mockResolvedValue({ allowed: true, reason: 'ready' });
    state.resolveRootPool.mockReturnValue({ kind: 'root-pool' });
    state.resolveRuntimePool.mockReturnValue({ kind: 'runtime-pool' });
    state.readRevision.mockResolvedValue('revision-a');
    state.withTenantLock.mockImplementation(async (_instanceId, operation) => operation());
    state.createPostgresStore.mockReturnValue({ withTenantLock: state.withTenantLock });
    state.createProjection.mockImplementation(({ subjects }) => ({
      subjects: subjects.map((subject: { roleNames: string[]; permissionIds: string[] }) => ({
        roles: subject.roleNames,
        permissions: subject.permissionIds,
      })),
    }));
  });

  it.each(['inactive', 'not_managed'] as const)(
    'keeps %s tenants outside the SSF-specific create path',
    async (reason) => {
      state.readAccess.mockResolvedValue({ allowed: false, reason });
      const execute = vi.fn(async ({ readClaims }) => readClaims({
        client: { query: vi.fn() },
        keycloakSubject: 'new-account',
        roleIds: [],
        roleNames: [],
      }));

      await expect(withSsfAccountCreate({ instanceId: 'tenant-a', execute })).resolves.toEqual({
        attributes: {},
      });
      expect(state.resolveRootPool).not.toHaveBeenCalled();
      expect(state.createPostgresStore).not.toHaveBeenCalled();
    }
  );

  it('rejects an SSF tenant whose configured access is not ready', async () => {
    state.readAccess.mockResolvedValue({ allowed: false, reason: 'missing_permissions' });

    await expect(
      withSsfAccountCreate({ instanceId: 'tenant-a', execute: vi.fn() })
    ).rejects.toThrow('conflict:SSF-Mandant ist noch nicht bereit.');
  });

  it.each([
    ['root', undefined, { kind: 'runtime-pool' }],
    ['runtime', { kind: 'root-pool' }, undefined],
  ] as const)('rejects a missing %s database pool', async (_name, rootPool, runtimePool) => {
    state.resolveRootPool.mockReturnValue(rootPool);
    state.resolveRuntimePool.mockReturnValue(runtimePool);

    await expect(
      withSsfAccountCreate({ instanceId: 'tenant-a', execute: vi.fn() })
    ).rejects.toThrow('conflict:SSF-Mandant ist noch nicht bereit.');
  });

  it('rejects a tenant without the current confirmed authorization revision', async () => {
    state.readRevision.mockResolvedValue(null);

    await expect(
      withSsfAccountCreate({ instanceId: 'tenant-a', execute: vi.fn() })
    ).rejects.toThrow('conflict:SSF-Mandant ist noch nicht bereit.');
  });

  it('derives canonical SSF claims under the tenant lock', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { permission_key: 'ssf.configuration.tenant.manage' },
          { permission_key: 'unrelated.permission' },
        ],
      }),
    };
    const execute = vi.fn(async ({ readClaims }) =>
      readClaims({
        client,
        keycloakSubject: 'new-account',
        roleIds: ['role-1'],
        roleNames: ['editor'],
      })
    );

    await expect(withSsfAccountCreate({ instanceId: 'tenant-a', execute })).resolves.toEqual({
      attributes: {
        studio_tenant_id: ['tenant-a'],
        ssf_roles: ['editor'],
        ssf_permissions: ['ssf.configuration.tenant.manage'],
        ssf_authorization_revision: ['revision-a'],
      },
    });
    expect(state.withTenantLock).toHaveBeenCalledWith('tenant-a', expect.any(Function));
    expect(state.readRevision).toHaveBeenCalledWith({ kind: 'runtime-pool' }, 'tenant-a');
    expect(state.createProjection).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      subjects: [
        {
          subject: 'new-account',
          roleNames: ['editor'],
          permissionIds: ['ssf.configuration.tenant.manage'],
        },
      ],
    });
  });

  it('maps tenant lock contention to a visible create conflict', async () => {
    state.withTenantLock.mockRejectedValue(
      new Error('ssf_authorization_projection_lock_unavailable')
    );

    await expect(
      withSsfAccountCreate({ instanceId: 'tenant-a', execute: vi.fn() })
    ).rejects.toThrow('conflict:SSF-Mandant wird gerade aktualisiert.');
  });
});
