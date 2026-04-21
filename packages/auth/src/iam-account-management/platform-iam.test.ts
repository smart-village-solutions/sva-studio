import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
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
  rolesByUser: new Map<string, readonly string[]>([['kc-platform-1', ['system_admin']]]),
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
  resolveIdentityProvider: () => ({
    provider: {
      listUsers: async ({ first = 0, max = 100 }: { first?: number; max?: number } = {}) =>
        state.users.slice(first, first + max),
      listUserRoleNames: async (externalId: string) => state.rolesByUser.get(externalId) ?? [],
      listRoles: async () => state.roles,
    },
    realm: 'sva-studio',
    source: 'global',
    clientId: 'platform-admin',
    adminRealm: 'sva-studio',
    executionMode: 'platform_admin',
  }),
}));

vi.mock('./shared-observability.js', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
  },
  trackKeycloakCall: vi.fn(async (_operation: string, execute: () => Promise<unknown>) => execute()),
}));

import { listPlatformRoles, listPlatformUsers, runPlatformKeycloakUserSync } from './platform-iam';

describe('platform IAM projection', () => {
  beforeEach(() => {
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
    state.rolesByUser = new Map<string, readonly string[]>([['kc-platform-1', ['system_admin']]]);
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
});
