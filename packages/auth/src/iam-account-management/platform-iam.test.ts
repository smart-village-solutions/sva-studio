import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  providerEnabled: true,
  users: [
    {
      externalId: 'kc-platform-1',
      username: 'platform-admin',
      email: 'platform@example.org',
      firstName: 'Platform',
      lastName: 'Admin',
      enabled: true,
    },
  ],
  rolesByUser: new Map<string, readonly string[] | Error>([['kc-platform-1', ['system_admin']]]),
  roles: [
    {
      id: 'role-system-admin',
      externalName: 'system_admin',
      description: 'System admin',
    },
    {
      id: 'role-default',
      externalName: 'default-roles-sva-studio',
    },
  ],
}));

vi.mock('./shared-runtime.js', () => ({
  resolveIdentityProvider: () =>
    state.providerEnabled
      ? {
          provider: {
            listUsers: async ({ first = 0, max = 100 }: { first?: number; max?: number } = {}) =>
              state.users.slice(first, first + max),
            listUserRoleNames: async (externalId: string) => {
              const roles = state.rolesByUser.get(externalId);
              if (roles instanceof Error) {
                throw roles;
              }
              return roles ?? [];
            },
            listRoles: async () => state.roles,
          },
          realm: 'sva-studio',
          source: 'global',
          clientId: 'platform-admin',
          adminRealm: 'sva-studio',
          executionMode: 'platform_admin',
        }
      : null,
}));

vi.mock('./shared-observability.js', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
  },
  trackKeycloakCall: vi.fn(async (_operation: string, execute: () => Promise<unknown>) => execute()),
}));

import {
  listPlatformRoles,
  listPlatformUsers,
  runPlatformKeycloakUserSync,
  runPlatformRoleReconcile,
} from './platform-iam';

describe('platform IAM projection', () => {
  beforeEach(() => {
    state.providerEnabled = true;
    state.users = [
      {
        externalId: 'kc-platform-1',
        username: 'platform-admin',
        email: 'platform@example.org',
        firstName: 'Platform',
        lastName: 'Admin',
        enabled: true,
      },
    ];
    state.rolesByUser = new Map<string, readonly string[] | Error>([['kc-platform-1', ['system_admin']]]);
    state.roles = [
      {
        id: 'role-system-admin',
        externalName: 'system_admin',
        description: 'System admin',
      },
      {
        id: 'role-default',
        externalName: 'default-roles-sva-studio',
      },
    ];
  });

  it('lists platform users without an instance id', async () => {
    const result = await listPlatformUsers({ page: 1, pageSize: 25 });

    expect(result.total).toBe(1);
    expect(result.users[0]).toEqual(
      expect.objectContaining({
        id: 'platform:kc-platform-1',
        keycloakSubject: 'kc-platform-1',
        displayName: 'Platform Admin',
        email: 'platform@example.org',
        status: 'active',
        roles: [expect.objectContaining({ roleKey: 'system_admin', roleLevel: 100 })],
      })
    );
  });

  it('filters built-in roles from platform role lists', async () => {
    const roles = await listPlatformRoles();

    expect(roles).toHaveLength(1);
    expect(roles[0]).toEqual(
      expect.objectContaining({
        id: 'role-system-admin',
        roleKey: 'system_admin',
        roleName: 'system_admin',
        isSystemRole: true,
        roleLevel: 100,
      })
    );
  });

  it('reports platform sync diagnostics without tenant persistence', async () => {
    const report = await runPlatformKeycloakUserSync({ requestId: 'req-platform-sync' });

    expect(report).toEqual(
      expect.objectContaining({
        outcome: 'success',
        checkedCount: 1,
        correctedCount: 0,
        totalKeycloakUsers: 1,
        diagnostics: expect.objectContaining({
          authRealm: 'sva-studio',
          providerSource: 'platform',
          executionMode: 'platform_admin',
        }),
      })
    );
  });

  it('applies platform user filters and tolerates degraded role projection', async () => {
    state.users = [
      {
        externalId: 'kc-platform-1',
        username: 'platform-admin',
        email: 'platform@example.org',
        firstName: 'Platform',
        lastName: 'Admin',
        enabled: true,
      },
      {
        externalId: 'kc-platform-2',
        username: 'registry-admin',
        email: 'registry@example.org',
        enabled: false,
      },
      {
        externalId: 'kc-platform-3',
        enabled: true,
      },
    ];
    state.rolesByUser = new Map<string, readonly string[] | Error>([
      ['kc-platform-1', ['system_admin']],
      ['kc-platform-2', ['instance_registry_admin']],
      ['kc-platform-3', new Error('roles unavailable')],
    ]);

    await expect(
      listPlatformUsers({ page: 1, pageSize: 25, status: 'inactive', role: 'instance_registry_admin', search: 'registry' })
    ).resolves.toMatchObject({
      total: 1,
      users: [expect.objectContaining({ displayName: 'registry-admin', status: 'inactive' })],
    });
    await expect(
      listPlatformUsers({ page: 1, pageSize: 25, role: 'missing_role' })
    ).resolves.toMatchObject({ total: 0 });
    await expect(
      listPlatformUsers({ page: 1, pageSize: 25, search: 'kc-platform-3' })
    ).resolves.toMatchObject({
      total: 1,
      users: [expect.objectContaining({ displayName: 'kc-platform-3', roles: [] })],
    });
  });

  it('maps platform role attributes and reconcile summaries', async () => {
    state.roles = [
      {
        externalName: 'custom_admin',
        description: 'Custom admin',
        attributes: {
          managed_by: ['studio'],
          role_key: ['custom.admin'],
          display_name: ['Custom Admin'],
          role_level: ['77'],
        },
      },
      {
        externalName: 'external_role',
        attributes: {
          role_level: ['not-a-number'],
        },
      },
      {
        externalName: 'offline_access',
      },
      {
        externalName: 'uma_authorization',
      },
    ];

    const roles = await listPlatformRoles();

    expect(roles).toEqual([
      expect.objectContaining({
        id: 'platform:custom_admin',
        roleKey: 'custom.admin',
        roleName: 'Custom Admin',
        managedBy: 'studio',
        roleLevel: 77,
      }),
      expect.objectContaining({
        id: 'platform:external_role',
        roleKey: 'external_role',
        managedBy: 'external',
        roleLevel: 0,
      }),
    ]);
    await expect(runPlatformRoleReconcile()).resolves.toMatchObject({
      outcome: 'success',
      checkedCount: 2,
      roles: [
        { externalRoleName: 'custom_admin', action: 'noop', status: 'synced' },
        { externalRoleName: 'external_role', action: 'noop', status: 'synced' },
      ],
    });
  });

  it('fails when the platform identity provider is not configured', async () => {
    state.providerEnabled = false;

    await expect(listPlatformUsers({ page: 1, pageSize: 25 })).rejects.toThrow(
      'platform_identity_provider_not_configured'
    );
    await expect(listPlatformRoles()).rejects.toThrow('platform_identity_provider_not_configured');
    await expect(runPlatformKeycloakUserSync({})).rejects.toThrow('platform_identity_provider_not_configured');
  });
});
