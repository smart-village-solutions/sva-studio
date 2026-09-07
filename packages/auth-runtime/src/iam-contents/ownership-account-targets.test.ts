import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  countUsers: vi.fn(),
  listUsers: vi.fn(),
  loadMappedUsersBySubject: vi.fn(),
  resolveIdentityProviderForInstance: vi.fn(),
}));

vi.mock('../iam-account-management/shared-runtime.js', () => ({
  resolveIdentityProviderForInstance: (...args: unknown[]) =>
    state.resolveIdentityProviderForInstance(...args),
}));

vi.mock('../iam-account-management/shared-observability.js', () => ({
  trackKeycloakCall: vi.fn((_operation: string, work: () => unknown) => work()),
}));

vi.mock('@sva/iam-admin', () => ({
  loadMappedUsersBySubject: (...args: unknown[]) => state.loadMappedUsersBySubject(...args),
}));

const { loadContentOwnershipAccountTargets } = await import('./ownership-account-targets.js');

const mappedUser = (overrides: Record<string, unknown> = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  keycloakSubject: 'subject-target',
  displayName: 'Ada Lovelace',
  status: 'active',
  isTechnicalAccount: false,
  mappingStatus: 'mapped',
  editability: 'editable',
  roles: [],
  mainserverUserApplicationSecretSet: false,
  mainserverCredentialStatus: 'unknown',
  ...overrides,
});

describe('content ownership account targets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.resolveIdentityProviderForInstance.mockResolvedValue({
      provider: {
        countUsers: state.countUsers,
        listUsers: state.listUsers,
      },
    });
  });

  it('searches the tenant Keycloak and returns only active local human accounts', async () => {
    state.countUsers.mockResolvedValueOnce(5);
    state.listUsers.mockResolvedValueOnce([
      { externalId: 'subject-target', firstName: 'Ada', lastName: 'Lovelace' },
      { externalId: 'subject-unmapped', firstName: 'Unmapped' },
      { externalId: 'subject-inactive', firstName: 'Inactive' },
      { externalId: 'subject-technical', firstName: 'Technical' },
      { externalId: 'subject-current', firstName: 'Current' },
    ]);
    state.loadMappedUsersBySubject.mockResolvedValueOnce(
      new Map([
        ['subject-target', mappedUser()],
        ['subject-inactive', mappedUser({ id: 'account-inactive', status: 'inactive' })],
        ['subject-technical', mappedUser({ id: 'account-technical', isTechnicalAccount: true })],
        ['subject-current', mappedUser({ id: 'account-current' })],
      ])
    );

    await expect(
      loadContentOwnershipAccountTargets({
        client: {} as never,
        instanceId: 'instance-1',
        page: 1,
        pageSize: 10,
        search: 'ada@example.org',
        excludeAccountId: 'account-current',
      })
    ).resolves.toEqual({ users: [mappedUser()], total: 1 });

    expect(state.countUsers).toHaveBeenCalledWith({
      search: 'ada@example.org',
      enabled: true,
    });
    expect(state.listUsers).toHaveBeenCalledWith({
      search: 'ada@example.org',
      enabled: true,
      first: 0,
      max: 100,
    });
    expect(state.loadMappedUsersBySubject).toHaveBeenCalledWith(expect.anything(), {
      instanceId: 'instance-1',
      subjects: [
        'subject-target',
        'subject-unmapped',
        'subject-inactive',
        'subject-technical',
        'subject-current',
      ],
      activeLifecycleOnly: true,
      includeTechnicalAccounts: false,
    });
  });

  it('scans beyond unmapped Keycloak results before paginating eligible accounts', async () => {
    const firstWindow = Array.from({ length: 100 }, (_, index) => ({
      externalId: `unmapped-${index}`,
    }));
    state.countUsers.mockResolvedValueOnce(101);
    state.listUsers
      .mockResolvedValueOnce(firstWindow)
      .mockResolvedValueOnce([{ externalId: 'subject-target' }]);
    state.loadMappedUsersBySubject
      .mockResolvedValueOnce(new Map())
      .mockResolvedValueOnce(new Map([['subject-target', mappedUser()]]));

    await expect(
      loadContentOwnershipAccountTargets({
        client: {} as never,
        instanceId: 'instance-1',
        page: 1,
        pageSize: 10,
        search: 'Ada',
      })
    ).resolves.toEqual({ users: [mappedUser()], total: 1 });

    expect(state.listUsers).toHaveBeenNthCalledWith(2, {
      search: 'Ada',
      enabled: true,
      first: 100,
      max: 100,
    });
  });

  it('paginates after intersecting Keycloak results with local accounts', async () => {
    const keycloakUsers = Array.from({ length: 12 }, (_, index) => ({
      externalId: `subject-${index}`,
    }));
    const mappedAccounts = new Map(
      keycloakUsers.map((user, index) => [
        user.externalId,
        mappedUser({ id: `account-${index}`, keycloakSubject: user.externalId }),
      ])
    );
    state.countUsers.mockResolvedValueOnce(12);
    state.listUsers.mockResolvedValueOnce(keycloakUsers);
    state.loadMappedUsersBySubject.mockResolvedValueOnce(mappedAccounts);

    const result = await loadContentOwnershipAccountTargets({
      client: {} as never,
      instanceId: 'instance-1',
      page: 2,
      pageSize: 5,
      search: 'Ada',
    });

    expect(result.total).toBe(12);
    expect(result.users.map((user) => user.id)).toEqual([
      'account-5',
      'account-6',
      'account-7',
      'account-8',
      'account-9',
    ]);
  });

  it('fails when the tenant Keycloak provider is unavailable', async () => {
    state.resolveIdentityProviderForInstance.mockResolvedValueOnce(null);

    await expect(
      loadContentOwnershipAccountTargets({
        client: {} as never,
        instanceId: 'instance-1',
        page: 1,
        pageSize: 10,
        search: 'Ada',
      })
    ).rejects.toThrow('tenant_admin_client_not_configured');
  });

  it('fails closed when Keycloak keeps returning full unmapped windows', async () => {
    state.listUsers.mockResolvedValue(
      Array.from({ length: 100 }, (_, index) => ({ externalId: `unmapped-${index}` }))
    );
    state.loadMappedUsersBySubject.mockResolvedValue(new Map());

    await expect(
      loadContentOwnershipAccountTargets({
        client: {} as never,
        instanceId: 'instance-1',
        page: 1,
        pageSize: 10,
        search: 'Ada',
      })
    ).rejects.toThrow('content_ownership_account_search_limit_exceeded');

    expect(state.listUsers).toHaveBeenCalledTimes(10);
  });
});
