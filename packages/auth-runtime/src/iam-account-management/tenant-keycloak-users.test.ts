import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
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
});
