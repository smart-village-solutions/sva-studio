import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  resolveIdentityProvider: vi.fn(),
  trackKeycloakCall: vi.fn(async (_operation: string, work: () => Promise<unknown>) => work()),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('./shared-runtime.js', () => ({
  resolveIdentityProvider: state.resolveIdentityProvider,
}));

vi.mock('./shared-observability.js', () => ({
  logger: state.logger,
  trackKeycloakCall: state.trackKeycloakCall,
}));

describe('platform iam helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when the platform identity provider is not configured', async () => {
    const { listAllPlatformUsers, listPlatformUsers } = await import('./platform-iam.js');
    state.resolveIdentityProvider.mockReturnValue(null);

    await expect(listAllPlatformUsers()).rejects.toThrow('platform_identity_provider_not_configured');
    await expect(
      listPlatformUsers({
        page: 1,
        pageSize: 10,
      })
    ).rejects.toThrow('platform_identity_provider_not_configured');
  });

  it('projects only instance_registry_admin as relevant platform role', async () => {
    const { PLATFORM_ROLE_LEVEL_BY_NAME } = await import('./platform-iam-roles.js');
    const { listPlatformRoles, runPlatformRoleReconcile } = await import('./platform-iam.js');

    state.resolveIdentityProvider.mockReturnValue({
      realm: 'platform',
      provider: {
        listRoles: vi.fn(async () => [
          {
            id: '1',
            externalName: 'offline_access',
            attributes: {},
          },
          {
            id: '2',
            externalName: 'custom-studio',
            description: 'Studio role',
            attributes: {
              managed_by: ['studio'],
              display_name: [' Studio Role '],
              role_key: ['studio_role'],
              role_level: ['55'],
            },
          },
          {
            id: '3',
            externalName: 'external-role',
            description: 'External role',
            attributes: {},
          },
          {
            id: '4',
            externalName: 'instance_registry_admin',
            attributes: {},
          },
          {
            id: '5',
            externalName: 'system_admin',
            attributes: {},
          },
        ]),
      },
    });

    const roles = await listPlatformRoles();
    expect(PLATFORM_ROLE_LEVEL_BY_NAME.instance_registry_admin).toBe(90);
    expect(PLATFORM_ROLE_LEVEL_BY_NAME.system_admin).toBeUndefined();
    expect(roles).toEqual([
      expect.objectContaining({
        externalRoleName: 'instance_registry_admin',
        managedBy: 'external',
        isSystemRole: true,
        editability: 'read_only',
        roleLevel: 90,
        diagnostics: [{ code: 'system_role', objectId: 'instance_registry_admin', objectType: 'role' }],
      }),
    ]);
    expect(roles[0]).toMatchObject({
      managedBy: 'external',
      isSystemRole: true,
      editability: 'read_only',
      roleLevel: 90,
      diagnostics: [{ code: 'system_role', objectId: 'instance_registry_admin', objectType: 'role' }],
    });

    const reconcile = await runPlatformRoleReconcile();
    expect(reconcile.checkedCount).toBe(1);
    expect(reconcile.roles).toEqual(
      roles.map((role) => ({
        externalRoleName: role.externalRoleName,
        action: 'noop',
        status: 'synced',
      }))
    );
    expect(state.logger.info).toHaveBeenCalledWith(
      'reconcile_platform_roles_completed',
      expect.objectContaining({
        operation: 'reconcile_platform_roles',
        scope_kind: 'platform',
        checked_count: 1,
      })
    );
  });

  it('lists platform users with paging, count fallback, role filtering, degraded role projection and pending shortcut', async () => {
    const { listAllPlatformUsers, listPlatformUsers } = await import('./platform-iam.js');

    const listUsersAll = vi
      .fn()
      .mockResolvedValueOnce([
        { externalId: 'u1', username: 'alice', firstName: 'Alice', lastName: 'Able', email: 'alice@example.test', enabled: true },
        { externalId: 'u2', username: 'bert', email: 'bert@example.test', enabled: false },
      ])
      .mockResolvedValueOnce([]);
    state.resolveIdentityProvider.mockReturnValueOnce({
      realm: 'platform',
      provider: {
        listUsers: listUsersAll,
        listUserRoleNames: vi.fn(),
        countUsers: vi.fn(),
      },
    });

    const all = await listAllPlatformUsers({ search: 'alice' });
    expect(all.realm).toBe('platform');
    expect(all.users).toHaveLength(2);

    const listUsers = vi
      .fn()
      .mockResolvedValueOnce([
        { externalId: 'u3', username: 'carol', firstName: 'Carol', lastName: 'Clark', email: 'carol@example.test', enabled: true },
      ])
      .mockResolvedValueOnce([
        { externalId: 'u1', username: 'alice', firstName: 'Alice', lastName: 'Able', email: 'alice@example.test', enabled: true },
        { externalId: 'u2', username: 'bert', email: 'bert@example.test', enabled: false },
        { externalId: 'u3', username: 'carol', firstName: 'Carol', lastName: 'Clark', email: 'carol@example.test', enabled: true },
      ]);
    const listUserRoleNames = vi
      .fn()
      .mockResolvedValueOnce(['system_admin'])
      .mockRejectedValueOnce(new Error('role lookup failed'))
      .mockResolvedValueOnce(['instance_registry_admin'])
      .mockResolvedValueOnce(['system_admin'])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(['instance_registry_admin']);
    const countUsers = vi.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(3);

    state.resolveIdentityProvider.mockReturnValue({
      realm: 'platform',
      provider: {
        listUsers,
        listUserRoleNames,
        countUsers,
      },
    });

    const paged = await listPlatformUsers({
      page: 1,
      pageSize: 2,
      status: 'active',
      requestId: 'req-1',
      traceId: 'trace-1',
    });
    expect(paged.total).toBe(10);
    expect(paged.users).toHaveLength(1);
    expect(paged.users[0]).toMatchObject({
      keycloakSubject: 'u3',
      displayName: 'Carol Clark',
      status: 'active',
      roles: [],
    });
    const filtered = await listPlatformUsers({
      page: 1,
      pageSize: 10,
      role: 'instance_registry_admin',
      search: 'ali',
    });
    expect(filtered.total).toBe(0);
    expect(filtered.users).toEqual([]);

    const pending = await listPlatformUsers({
      page: 1,
      pageSize: 10,
      status: 'pending',
    });
    expect(pending).toEqual({ users: [], total: 0 });
  });

  it('falls back to the current page size when countUsers is unavailable and keeps unknown display names stable', async () => {
    const { listPlatformUsers } = await import('./platform-iam.js');

    state.resolveIdentityProvider.mockReturnValue({
      realm: 'platform',
      provider: {
        listUsers: vi.fn(async () => [
          { externalId: 'u9', enabled: true },
          { externalId: 'u8', username: 'zeta', enabled: false },
        ]),
        listUserRoleNames: vi.fn(async (externalId: string) =>
          externalId === 'u9' ? ['custom-role'] : ['instance_registry_admin']
        ),
      },
    });

    const result = await listPlatformUsers({
      page: 1,
      pageSize: 10,
    });

    expect(result.total).toBe(2);
    expect(result.users[0]).toMatchObject({
      keycloakSubject: 'u9',
      displayName: 'u9',
      status: 'active',
      roles: [],
    });
    expect(result.users[1]).toMatchObject({
      keycloakSubject: 'u8',
      displayName: 'zeta',
      status: 'inactive',
      roles: [{ roleKey: 'instance_registry_admin', roleLevel: 90 }],
    });
  });

  it('covers role-filter searches with and without search terms, including inactive status filtering', async () => {
    const { listPlatformUsers } = await import('./platform-iam.js');

    state.resolveIdentityProvider.mockReturnValue({
      realm: 'platform',
      provider: {
        listUsers: vi.fn(async () => [
          { externalId: 'u1', username: 'anna', email: 'anna@example.test', enabled: true },
          { externalId: 'u2', username: 'bruno', email: 'bruno@example.test', enabled: false },
        ]),
        listUserRoleNames: vi
          .fn()
          .mockResolvedValueOnce(['custom-role'])
          .mockResolvedValueOnce(['custom-role'])
          .mockResolvedValueOnce(['custom-role'])
          .mockResolvedValueOnce(['custom-role']),
      },
    });

    const byRoleWithoutSearch = await listPlatformUsers({
      page: 1,
      pageSize: 10,
      role: 'custom-role',
    });
    expect(byRoleWithoutSearch).toEqual({ users: [], total: 0 });

    const byRoleWithSearchMiss = await listPlatformUsers({
      page: 1,
      pageSize: 10,
      role: 'custom-role',
      search: 'zzz',
    });
    expect(byRoleWithSearchMiss).toEqual({ users: [], total: 0 });

    const inactiveOnly = await listPlatformUsers({
      page: 1,
      pageSize: 10,
      role: 'custom-role',
      status: 'inactive',
    });
    expect(inactiveOnly).toEqual({ users: [], total: 0 });
  });
});
