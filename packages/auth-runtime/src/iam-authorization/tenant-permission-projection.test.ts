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
        permissionIds: ['ssf.configuration.tenant.manage', 'ssf.configuration.tenant.read'],
      },
      {
        keycloakSubject: 'subject-b',
        roleNames: ['editor'],
        permissionIds: ['ssf.configuration.tenant.read'],
      },
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("AND a.status = 'active'"), [
      'tenant-a',
      ['ssf.configuration.tenant.manage', 'ssf.configuration.tenant.read'],
    ]);
  });

  it('keeps a roleless active member even when the permission allowlist is empty', async () => {
    const query = vi
      .fn()
      .mockResolvedValue({
        rows: [{ keycloak_subject: 'regular-user', role_name: null, permission_key: null }],
      });
    await expect(
      loadTenantPermissionProjectionSubjectsWithClient(
        { query },
        { instanceId: 'tenant-a', permissionIds: [] }
      )
    ).resolves.toEqual([{ keycloakSubject: 'regular-user', roleNames: [], permissionIds: [] }]);
    const sql = query.mock.calls[0][0];
    expect(sql).toContain('JOIN iam.instance_memberships membership');
    expect(sql).toContain('membership.instance_id = a.instance_id');
    expect(sql).toContain('source.instance_id = a.instance_id');
    expect(sql).toContain("WHERE a.instance_id = $1\n  AND a.status = 'active'");
    expect(sql).toContain('AND a.is_blocked = false');
    expect(sql).toContain('AND a.soft_deleted_at IS NULL');
    expect(sql).toContain("AND a.deletion_lifecycle_state = 'active'");
    expect(sql).toContain('permission_module.effective_active = false THEN NULL');
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

  it('checks active membership without demanding optional permissions', async () => {
    state.query.mockResolvedValueOnce({ rows: [{ present: true }] });
    const { hasActiveTenantProjectionSubject } = await import('./tenant-permission-projection.js');
    await expect(hasActiveTenantProjectionSubject({ instanceId: 'tenant-a' })).resolves.toBe(true);
    expect(state.query).toHaveBeenCalledWith(
      expect.stringContaining('JOIN iam.instance_memberships membership'),
      ['tenant-a']
    );
    expect(state.query.mock.calls[0][0]).toContain("AND a.status = 'active'");
    expect(state.query.mock.calls[0][0]).not.toContain('role_permissions');
  });

  it.each([{ rows: [] }, { rows: [{ present: false }] }])(
    'reports no active subject for result %#',
    async (result) => {
      state.query.mockResolvedValueOnce(result);
      const { hasActiveTenantProjectionSubject } =
        await import('./tenant-permission-projection.js');

      await expect(
        hasActiveTenantProjectionSubject({
          instanceId: 'tenant-a',
        })
      ).resolves.toBe(false);
    }
  );
});
