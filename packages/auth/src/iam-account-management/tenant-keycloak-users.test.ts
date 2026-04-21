import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  provider: {
    listUsers: vi.fn(),
    countUsers: vi.fn(),
    listUserRoleNames: vi.fn(),
  },
}));

vi.mock('./shared-runtime.js', () => ({
  resolveIdentityProviderForInstance: vi.fn(async () => ({
    provider: state.provider,
  })),
}));

vi.mock('./shared-observability.js', () => ({
  logger: {
    warn: vi.fn(),
  },
  trackKeycloakCall: vi.fn(async (_operation: string, execute: () => Promise<unknown>) => execute()),
}));

vi.mock('./tenant-keycloak-user-query.js', () => ({
  loadMappedUsersBySubject: vi.fn(async () => new Map()),
}));

import { resolveTenantKeycloakUsersWithPagination } from './tenant-keycloak-users';

describe('tenant Keycloak user listing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.provider.listUsers.mockResolvedValue([
      {
        externalId: 'kc-user-1',
        username: 'alice',
        enabled: true,
      },
    ]);
    state.provider.countUsers.mockResolvedValue(1);
    state.provider.listUserRoleNames.mockResolvedValue([]);
  });

  it('returns an empty page for pending status without querying Keycloak users', async () => {
    await expect(
      resolveTenantKeycloakUsersWithPagination({
        client: {} as never,
        instanceId: 'de-musterhausen',
        page: 1,
        pageSize: 25,
        status: 'pending',
      })
    ).resolves.toEqual({
      users: [],
      total: 0,
      keycloakRoleNamesBySubject: new Map(),
    });

    expect(state.provider.listUsers).not.toHaveBeenCalled();
    expect(state.provider.countUsers).not.toHaveBeenCalled();
    expect(state.provider.listUserRoleNames).not.toHaveBeenCalled();
  });

  it('rethrows non-Keycloak role projection failures', async () => {
    state.provider.listUserRoleNames.mockRejectedValueOnce(new TypeError('projection bug'));

    await expect(
      resolveTenantKeycloakUsersWithPagination({
        client: {} as never,
        instanceId: 'de-musterhausen',
        page: 1,
        pageSize: 25,
      })
    ).rejects.toThrow('projection bug');
  });
});
