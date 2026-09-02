import { describe, expect, it, vi } from 'vitest';

import { loadTenantPermissionProjectionSubjectsWithClient } from './permission-store.queries.js';

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
