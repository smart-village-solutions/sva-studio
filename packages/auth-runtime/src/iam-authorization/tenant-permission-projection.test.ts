import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadTenantPermissionProjectionSubjectsWithClient } from './permission-store.queries.js';

const state = vi.hoisted(() => ({
  query: vi.fn(),
  withInstanceScopedDb: vi.fn(),
}));

vi.mock('./shared.js', () => ({
  withInstanceScopedDb: state.withInstanceScopedDb,
}));

describe('tenant permission projection source', () => {
  it('reads active tenant subjects and groups their effective allowlisted permissions', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          keycloak_subject: 'subject-a',
          role_name: 'system_admin',
          permission_key: 'ssf.configuration.tenant.manage',
        },
        {
          keycloak_subject: 'subject-a',
          role_name: 'system_admin',
          permission_key: 'ssf.configuration.tenant.read',
        },
        {
          keycloak_subject: 'subject-b',
          role_name: 'editor',
          permission_key: 'ssf.configuration.tenant.read',
        },
      ],
    });

    await expect(
      loadTenantPermissionProjectionSubjectsWithClient(
        { query },
        {
          instanceId: 'tenant-a',
          permissionIds: [
            'ssf.configuration.tenant.read',
            'ssf.configuration.tenant.manage',
            'ssf.configuration.tenant.read',
          ],
        }
      )
    ).resolves.toEqual([
      {
        keycloakSubject: 'subject-a',
        roleNames: ['system_admin'],
        permissionIds: [
          'ssf.configuration.tenant.manage',
          'ssf.configuration.tenant.read',
        ],
      },
      {
        keycloakSubject: 'subject-b',
        roleNames: ['editor'],
        permissionIds: ['ssf.configuration.tenant.read'],
      },
    ]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("AND a.status = 'active'"),
      [
        'tenant-a',
        ['ssf.configuration.tenant.manage', 'ssf.configuration.tenant.read'],
      ]
    );
  });

  it('does not query when no permission allowlist is requested', async () => {
    const query = vi.fn();
    await expect(
      loadTenantPermissionProjectionSubjectsWithClient(
        { query },
        { instanceId: 'tenant-a', permissionIds: [] }
      )
    ).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('tenant permission projection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.withInstanceScopedDb.mockImplementation(
      async (
        _instanceId: string,
        work: (client: { query: typeof state.query }) => Promise<unknown>
      ) => work({ query: state.query })
    );
  });

  it('skips the database when no relevant permissions are configured', async () => {
    const { hasActiveTenantPermissionProjectionSubject } =
      await import('./tenant-permission-projection.js');

    await expect(
      hasActiveTenantPermissionProjectionSubject({ instanceId: 'tenant-a', permissionIds: [] })
    ).resolves.toBe(false);
    expect(state.withInstanceScopedDb).not.toHaveBeenCalled();
  });

  it('checks committed IAM state with normalized permission ids', async () => {
    state.query.mockResolvedValueOnce({ rows: [{ present: true }] });
    const { hasActiveTenantPermissionProjectionSubject } =
      await import('./tenant-permission-projection.js');

    await expect(
      hasActiveTenantPermissionProjectionSubject({
        instanceId: 'tenant-a',
        permissionIds: ['ssf.write', 'ssf.read', 'ssf.write'],
      })
    ).resolves.toBe(true);

    expect(state.withInstanceScopedDb).toHaveBeenCalledWith('tenant-a', expect.any(Function));
    expect(state.query).toHaveBeenCalledWith(
      expect.stringContaining('JOIN iam.instance_memberships membership'),
      ['tenant-a', ['ssf.read', 'ssf.write']]
    );
  });

  it.each([{ rows: [] }, { rows: [{ present: false }] }])(
    'reports no active subject for result %#',
    async (result) => {
      state.query.mockResolvedValueOnce(result);
      const { hasActiveTenantPermissionProjectionSubject } =
        await import('./tenant-permission-projection.js');

      await expect(
        hasActiveTenantPermissionProjectionSubject({
          instanceId: 'tenant-a',
          permissionIds: ['ssf.read'],
        })
      ).resolves.toBe(false);
    }
  );
});
