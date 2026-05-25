import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveUsersWithPagination: vi.fn(),
  listUsers: vi.fn(),
  countUsers: vi.fn(),
  listUserRoleNames: vi.fn(),
  loadMappedUsersBySubject: vi.fn(),
  mapUnmappedKeycloakUser: vi.fn(),
  mergeMappedUserWithKeycloak: vi.fn(),
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

vi.mock('@sva/iam-admin', () => ({
  resolveUsersWithPagination: mocks.resolveUsersWithPagination,
}));

vi.mock('./tenant-keycloak-user-query.js', () => ({
  loadMappedUsersBySubject: mocks.loadMappedUsersBySubject,
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
    expect(mocks.mapUnmappedKeycloakUser).toHaveBeenCalledWith(keycloakUser, ['tenant_admin']);
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
  });
});
