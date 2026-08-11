import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveUsersWithPagination: vi.fn(),
  listUsers: vi.fn(),
  countUsers: vi.fn(),
  listUserRoleNames: vi.fn(),
  loadMappedUsersBySubject: vi.fn(),
  loadTechnicalAccountSubjects: vi.fn(),
  mapUnmappedKeycloakUser: vi.fn(),
  mergeMappedUserWithKeycloak: vi.fn(),
  resolveMainserverCredentialStatus: vi.fn(),
}));

vi.mock('./shared-runtime.js', () => ({
  resolveIdentityProviderForInstance: vi.fn(async () => ({
    provider: {
      listUsers: mocks.listUsers,
      countUsers: mocks.countUsers,
      listUserRoleNames: mocks.listUserRoleNames,
    },
  })),
}));

vi.mock('../mainserver-credentials.js', () => ({
  resolveMainserverCredentialStatus: mocks.resolveMainserverCredentialStatus,
}));

vi.mock('@sva/iam-admin', () => ({
  resolveUsersWithPagination: mocks.resolveUsersWithPagination,
}));

vi.mock('./tenant-keycloak-user-query.js', () => ({
  loadMappedUsersBySubject: mocks.loadMappedUsersBySubject,
  loadTechnicalAccountSubjects: mocks.loadTechnicalAccountSubjects,
}));

vi.mock('./tenant-keycloak-user-projection.js', () => ({
  mapUnmappedKeycloakUser: mocks.mapUnmappedKeycloakUser,
  mergeMappedUserWithKeycloak: mocks.mergeMappedUserWithKeycloak,
}));

vi.mock('./shared-observability.js', () => ({
  logger: { warn: vi.fn() },
  trackKeycloakCall: vi.fn((_operation: string, work: () => unknown) => work()),
}));

describe('tenant keycloak users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveMainserverCredentialStatus.mockReturnValue('unknown');
    mocks.loadTechnicalAccountSubjects.mockResolvedValue(new Set());
  });

  it('maps unmapped keycloak users without leaking the tenant instance id into the projection', async () => {
    const { resolveTenantKeycloakUsersWithPagination } = await import('./tenant-keycloak-users.js');
    const keycloakUser = {
      externalId: 'keycloak-subject-1',
      email: 'user@example.org',
      firstName: 'Ada',
      lastName: 'Lovelace',
      enabled: true,
    };
    const projectedUser = {
      id: 'keycloak-subject-1',
      keycloakSubject: 'keycloak-subject-1',
      email: 'user@example.org',
    };
    mocks.listUsers.mockResolvedValueOnce([keycloakUser]);
    mocks.countUsers.mockResolvedValueOnce(1);
    mocks.listUserRoleNames.mockResolvedValueOnce(['tenant_admin']);
    mocks.loadMappedUsersBySubject.mockResolvedValueOnce(new Map());
    mocks.mapUnmappedKeycloakUser.mockReturnValueOnce(projectedUser);

    const result = await resolveTenantKeycloakUsersWithPagination({
      client: {} as never,
      instanceId: 'instance-1',
      page: 1,
      pageSize: 25,
    });

    expect(result.users).toEqual([projectedUser]);
    expect(mocks.mapUnmappedKeycloakUser).toHaveBeenCalledWith(
      keycloakUser,
      ['tenant_admin'],
      'unknown'
    );
  });

  it('uses the local query path for role-filtered listings instead of scanning all keycloak users', async () => {
    const { resolveTenantKeycloakUsersWithPagination } = await import('./tenant-keycloak-users.js');
    const localUser = {
      id: 'user-1',
      keycloakSubject: 'keycloak-subject-1',
      displayName: 'Ada Lovelace',
      email: 'user@example.org',
      status: 'active',
      roles: [
        {
          roleId: 'role-1',
          roleKey: 'tenant_admin',
          roleName: 'Tenant Admin',
          roleLevel: 90,
        },
      ],
      mappingStatus: 'mapped',
      editability: 'editable',
    };
    mocks.resolveUsersWithPagination.mockResolvedValueOnce({
      total: 1,
      users: [localUser],
    });

    const result = await resolveTenantKeycloakUsersWithPagination({
      client: {} as never,
      instanceId: 'instance-1',
      page: 1,
      pageSize: 25,
      role: 'tenant_admin',
    });

    expect(result.users).toEqual([localUser]);
    expect(result.total).toBe(1);
    expect(mocks.resolveUsersWithPagination).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        instanceId: 'instance-1',
        page: 1,
        pageSize: 25,
        role: 'tenant_admin',
      })
    );
    expect(mocks.listUsers).not.toHaveBeenCalled();
    expect(mocks.listUserRoleNames).not.toHaveBeenCalled();
    expect(result.keycloakRoleNamesBySubject.get('keycloak-subject-1')).toBeNull();
  });

  it('filters mapped technical accounts before pagination and total calculation', async () => {
    const { resolveTenantKeycloakUsersWithPagination } = await import('./tenant-keycloak-users.js');
    const users = [
      { externalId: 'human-1' },
      { externalId: 'technical-1' },
      { externalId: 'human-2' },
    ];
    mocks.countUsers.mockResolvedValueOnce(3);
    mocks.listUsers.mockResolvedValueOnce(users);
    mocks.loadTechnicalAccountSubjects.mockResolvedValueOnce(new Set(['technical-1']));
    mocks.loadMappedUsersBySubject.mockResolvedValueOnce(
      new Map([
        ['human-1', { isTechnicalAccount: false }],
        ['human-2', { isTechnicalAccount: false }],
      ])
    );
    mocks.listUserRoleNames.mockResolvedValue([]);
    mocks.mergeMappedUserWithKeycloak.mockImplementation((mapped) => mapped);

    const result = await resolveTenantKeycloakUsersWithPagination({
      client: {} as never,
      instanceId: 'instance-1',
      page: 1,
      pageSize: 2,
    });

    expect(result.total).toBe(2);
    expect(result.users).toEqual([{ isTechnicalAccount: false }, { isTechnicalAccount: false }]);
    expect(mocks.listUsers).toHaveBeenCalledWith({ first: 0, max: 100 });
    expect(mocks.loadMappedUsersBySubject).toHaveBeenCalledWith(expect.anything(), {
      instanceId: 'instance-1',
      subjects: ['human-1', 'human-2'],
    });
    expect(mocks.listUserRoleNames).toHaveBeenCalledTimes(2);
  });

  it('scans Keycloak windows for an exact total but projects only the requested visible page', async () => {
    const { resolveTenantKeycloakUsersWithPagination } = await import('./tenant-keycloak-users.js');
    const firstWindow = Array.from({ length: 100 }, (_, index) => ({
      externalId: `user-${index}`,
    }));
    mocks.countUsers.mockResolvedValueOnce(101);
    mocks.listUsers
      .mockResolvedValueOnce(firstWindow)
      .mockResolvedValueOnce([{ externalId: 'user-100' }]);
    mocks.loadTechnicalAccountSubjects.mockResolvedValueOnce(
      new Set(['user-0', 'user-50', 'user-100'])
    );
    mocks.loadMappedUsersBySubject.mockResolvedValueOnce(
      new Map([
        ['user-3', { id: 'mapped-3' }],
        ['user-4', { id: 'mapped-4' }],
      ])
    );
    mocks.listUserRoleNames.mockResolvedValue([]);
    mocks.mergeMappedUserWithKeycloak.mockImplementation((mapped) => mapped);

    const result = await resolveTenantKeycloakUsersWithPagination({
      client: {} as never,
      instanceId: 'instance-1',
      page: 2,
      pageSize: 2,
    });

    expect(result.total).toBe(98);
    expect(result.users).toEqual([{ id: 'mapped-3' }, { id: 'mapped-4' }]);
    expect(mocks.listUsers).toHaveBeenNthCalledWith(1, { first: 0, max: 100 });
    expect(mocks.listUsers).toHaveBeenNthCalledWith(2, { first: 100, max: 100 });
    expect(mocks.loadMappedUsersBySubject).toHaveBeenCalledWith(expect.anything(), {
      instanceId: 'instance-1',
      subjects: ['user-3', 'user-4'],
    });
  });

  it('keeps native Keycloak pagination when technical accounts are explicitly included', async () => {
    const { resolveTenantKeycloakUsersWithPagination } = await import('./tenant-keycloak-users.js');
    mocks.countUsers.mockResolvedValueOnce(11);
    mocks.listUsers.mockResolvedValueOnce([{ externalId: 'technical-1' }]);
    mocks.loadMappedUsersBySubject.mockResolvedValueOnce(
      new Map([['technical-1', { isTechnicalAccount: true }]])
    );
    mocks.listUserRoleNames.mockResolvedValueOnce([]);
    mocks.mergeMappedUserWithKeycloak.mockImplementation((mapped) => mapped);

    const result = await resolveTenantKeycloakUsersWithPagination({
      client: {} as never,
      instanceId: 'instance-1',
      page: 3,
      pageSize: 5,
      includeTechnicalAccounts: true,
    });

    expect(result.total).toBe(11);
    expect(result.users).toEqual([{ isTechnicalAccount: true }]);
    expect(mocks.listUsers).toHaveBeenCalledWith({ first: 10, max: 5 });
  });
});
