import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useOrganizations } from './use-organizations';

const listOrganizationsMock = vi.fn();
const getOrganizationMock = vi.fn();
const createOrganizationMock = vi.fn();
const updateOrganizationMock = vi.fn();
const deactivateOrganizationMock = vi.fn();
const assignOrganizationMembershipMock = vi.fn();
const removeOrganizationMembershipMock = vi.fn();
const asIamErrorMock = vi.fn();
const authMockValue = {
  user: {
    id: 'admin-1',
    name: 'Admin',
    roles: ['system_admin'],
  },
  isAuthenticated: true,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  logout: vi.fn(),
  invalidatePermissions: vi.fn(),
};

vi.mock('../lib/iam-api', () => ({
  IamHttpError: class IamHttpError extends Error {
    status: number;
    code: string;

    constructor(input: { status: number; code: string; message: string }) {
      super(input.message);
      this.status = input.status;
      this.code = input.code;
    }
  },
  asIamError: (...args: unknown[]) => asIamErrorMock(...args),
  listOrganizations: (...args: unknown[]) => listOrganizationsMock(...args),
  getOrganization: (...args: unknown[]) => getOrganizationMock(...args),
  createOrganization: (...args: unknown[]) => createOrganizationMock(...args),
  updateOrganization: (...args: unknown[]) => updateOrganizationMock(...args),
  deactivateOrganization: (...args: unknown[]) => deactivateOrganizationMock(...args),
  assignOrganizationMembership: (...args: unknown[]) => assignOrganizationMembershipMock(...args),
  removeOrganizationMembership: (...args: unknown[]) => removeOrganizationMembershipMock(...args),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => authMockValue,
}));

const createOrganizationListItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'org-1',
  organizationKey: 'alpha',
  displayName: 'Alpha',
  parentOrganizationId: undefined,
  parentDisplayName: undefined,
  organizationType: 'county',
  contentAuthorPolicy: 'org_only',
  isActive: true,
  depth: 0,
  hierarchyPath: [],
  childCount: 0,
  membershipCount: 0,
  ...overrides,
});

const createOrganizationDetail = (overrides: Record<string, unknown> = {}) => ({
  ...createOrganizationListItem(),
  memberships: [],
  children: [],
  metadata: {},
  ...overrides,
});

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
};

describe('useOrganizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads organizations and updates filters with page clamping', async () => {
    listOrganizationsMock.mockResolvedValue({
      data: [
        {
          id: 'org-1',
          organizationKey: 'alpha',
          displayName: 'Alpha',
          parentOrganizationId: undefined,
          parentDisplayName: undefined,
          organizationType: 'county',
          contentAuthorPolicy: 'org_only',
          isActive: true,
          depth: 0,
          hierarchyPath: [],
          childCount: 0,
          membershipCount: 0,
        },
      ],
      pagination: { page: 1, pageSize: 25, total: 1 },
    });

    const { result, unmount } = renderHook(() => useOrganizations({ page: 2 }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.organizations).toHaveLength(1);
    });

    act(() => {
      result.current.setSearch('alpha');
      result.current.setOrganizationType('municipality');
      result.current.setStatus('inactive');
      result.current.setPage(0);
    });

    expect(result.current.filters.search).toBe('alpha');
    expect(result.current.filters.organizationType).toBe('municipality');
    expect(result.current.filters.status).toBe('inactive');
    expect(result.current.page).toBe(1);

    unmount();
  });

  it('loads organization details', async () => {
    listOrganizationsMock
      .mockResolvedValueOnce({
        data: [],
        pagination: { page: 1, pageSize: 25, total: 0 },
      });
    getOrganizationMock.mockResolvedValue({ data: createOrganizationDetail() });

    const { result } = renderHook(() => useOrganizations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await expect(result.current.loadOrganization('org-1')).resolves.toMatchObject({
        id: 'org-1',
        displayName: 'Alpha',
      });
    });

    expect(getOrganizationMock).toHaveBeenCalledWith('org-1');
    expect(result.current.selectedOrganization).toMatchObject({
      id: 'org-1',
      displayName: 'Alpha',
    });
  });

  it('keeps the newest list response when older requests resolve later', async () => {
    const initialRequest = createDeferred<{ data: ReturnType<typeof createOrganizationListItem>[]; pagination: { page: number; pageSize: number; total: number } }>();
    const searchRequest = createDeferred<{ data: ReturnType<typeof createOrganizationListItem>[]; pagination: { page: number; pageSize: number; total: number } }>();

    listOrganizationsMock.mockImplementation(({ search }: { search?: string }) => {
      if (search === 'beta') {
        return searchRequest.promise;
      }
      return initialRequest.promise;
    });

    const { result } = renderHook(() => useOrganizations());

    await waitFor(() => {
      expect(listOrganizationsMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.setSearch('beta');
    });

    await act(async () => {
      await new Promise((resolve) => {
        globalThis.window.setTimeout(resolve, 350);
      });
    });

    await waitFor(() => {
      expect(listOrganizationsMock).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      searchRequest.resolve({
        data: [createOrganizationListItem({ id: 'org-2', organizationKey: 'beta', displayName: 'Beta' })],
        pagination: { page: 1, pageSize: 25, total: 1 },
      });
      await searchRequest.promise;
    });

    await waitFor(() => {
      expect(result.current.organizations).toMatchObject([{ id: 'org-2', displayName: 'Beta' }]);
    });

    await act(async () => {
      initialRequest.resolve({
        data: [createOrganizationListItem()],
        pagination: { page: 1, pageSize: 25, total: 1 },
      });
      await initialRequest.promise;
    });

    expect(result.current.organizations).toMatchObject([{ id: 'org-2', displayName: 'Beta' }]);
  });

  it('keeps the newest detail response when older detail requests resolve later', async () => {
    listOrganizationsMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 25, total: 0 },
    });

    const firstDetail = createDeferred<{ data: ReturnType<typeof createOrganizationDetail> }>();
    const secondDetail = createDeferred<{ data: ReturnType<typeof createOrganizationDetail> }>();

    getOrganizationMock.mockImplementation((organizationId: string) => {
      if (organizationId === 'org-2') {
        return secondDetail.promise;
      }
      return firstDetail.promise;
    });

    const { result } = renderHook(() => useOrganizations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let firstPromise: Promise<unknown>;
    let secondPromise: Promise<unknown>;

    await act(async () => {
      firstPromise = result.current.loadOrganization('org-1');
      secondPromise = result.current.loadOrganization('org-2');
    });

    await act(async () => {
      secondDetail.resolve({ data: createOrganizationDetail({ id: 'org-2', organizationKey: 'beta', displayName: 'Beta' }) });
      await secondPromise;
    });

    await waitFor(() => {
      expect(result.current.selectedOrganization).toMatchObject({ id: 'org-2', displayName: 'Beta' });
    });

    await act(async () => {
      firstDetail.resolve({ data: createOrganizationDetail() });
      await firstPromise;
    });

    expect(result.current.selectedOrganization).toMatchObject({ id: 'org-2', displayName: 'Beta' });
  });

  it('refreshes selected organization details after a successful update', async () => {
    listOrganizationsMock
      .mockResolvedValueOnce({
        data: [createOrganizationListItem()],
        pagination: { page: 1, pageSize: 25, total: 1 },
      })
      .mockResolvedValueOnce({
        data: [createOrganizationListItem({ displayName: 'Alpha 2' })],
        pagination: { page: 1, pageSize: 25, total: 1 },
      });
    getOrganizationMock
      .mockResolvedValueOnce({ data: createOrganizationDetail() })
      .mockResolvedValueOnce({ data: createOrganizationDetail({ displayName: 'Alpha 2' }) });
    updateOrganizationMock.mockResolvedValue({ data: { id: 'org-1' } });

    const { result } = renderHook(() => useOrganizations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.organizations).toMatchObject([{ id: 'org-1', displayName: 'Alpha' }]);
    });

    await act(async () => {
      await result.current.loadOrganization('org-1');
      await expect(result.current.updateOrganization('org-1', { displayName: 'Alpha 2' })).resolves.toMatchObject({
        id: 'org-1',
      });
    });

    expect(updateOrganizationMock).toHaveBeenCalledWith('org-1', { displayName: 'Alpha 2' });
    expect(result.current.organizations).toMatchObject([{ id: 'org-1', displayName: 'Alpha 2' }]);
    expect(result.current.selectedOrganization).toMatchObject({
      id: 'org-1',
      displayName: 'Alpha 2',
    });
  });

  it('clears the selected organization after deactivation', async () => {
    listOrganizationsMock
      .mockResolvedValueOnce({
        data: [createOrganizationListItem()],
        pagination: { page: 1, pageSize: 25, total: 1 },
      })
      .mockResolvedValueOnce({
        data: [],
        pagination: { page: 1, pageSize: 25, total: 0 },
      });
    getOrganizationMock.mockResolvedValueOnce({ data: createOrganizationDetail() });
    deactivateOrganizationMock.mockResolvedValue({ data: { id: 'org-1' } });

    const { result } = renderHook(() => useOrganizations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.loadOrganization('org-1');
      await expect(result.current.deactivateOrganization('org-1')).resolves.toBe(true);
    });

    expect(result.current.organizations).toEqual([]);
    expect(result.current.selectedOrganization).toBeNull();
  });

  it('returns created organizations and reloads the list', async () => {
    listOrganizationsMock
      .mockResolvedValueOnce({
        data: [],
        pagination: { page: 1, pageSize: 25, total: 0 },
      })
      .mockResolvedValueOnce({
        data: [
          createOrganizationListItem({
            id: 'org-2',
            organizationKey: 'beta',
            displayName: 'Beta',
            organizationType: 'municipality',
          }),
        ],
        pagination: { page: 1, pageSize: 25, total: 1 },
      });
    createOrganizationMock.mockResolvedValue({
      data: createOrganizationDetail({ id: 'org-2', organizationKey: 'beta', displayName: 'Beta', organizationType: 'municipality' }),
    });

    const { result } = renderHook(() => useOrganizations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await expect(
        result.current.createOrganization({
          organizationKey: 'beta',
          displayName: 'Beta',
          organizationType: 'municipality',
          contentAuthorPolicy: 'org_only',
        })
      ).resolves.toMatchObject({
        id: 'org-2',
        displayName: 'Beta',
      });
    });

    expect(result.current.organizations).toMatchObject([{ id: 'org-2', displayName: 'Beta' }]);
  });

  it('preserves the current list when the post-create refetch fails', async () => {
    const transientError = { status: 503, code: 'database_unavailable', message: 'db down' };
    asIamErrorMock.mockReturnValue(transientError);
    listOrganizationsMock
      .mockResolvedValueOnce({
        data: [
          {
            id: 'org-1',
            organizationKey: 'alpha',
            displayName: 'Alpha',
            parentOrganizationId: undefined,
            parentDisplayName: undefined,
            organizationType: 'county',
            contentAuthorPolicy: 'org_only',
            isActive: true,
            depth: 0,
            hierarchyPath: [],
            childCount: 0,
            membershipCount: 0,
          },
        ],
        pagination: { page: 1, pageSize: 25, total: 1 },
      })
      .mockRejectedValueOnce(new Error('refetch-failed'));
    createOrganizationMock.mockResolvedValue({
      data: {
        id: 'org-2',
        organizationKey: 'beta',
        displayName: 'Beta',
      },
    });

    const { result } = renderHook(() => useOrganizations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.organizations).toHaveLength(1);
    });

    await act(async () => {
      const created = await result.current.createOrganization({
        organizationKey: 'beta',
        displayName: 'Beta',
        organizationType: 'municipality',
        contentAuthorPolicy: 'org_only',
      });
      expect(created).toMatchObject({ id: 'org-2' });
    });

    expect(result.current.error).toBeNull();
    expect(result.current.organizations).toMatchObject([
      {
        id: 'org-1',
        displayName: 'Alpha',
      },
    ]);
  });

  it('invalidates permissions on 403 for list and mutation errors', async () => {
    const forbiddenError = { status: 403, code: 'forbidden', message: 'Forbidden' };
    asIamErrorMock.mockReturnValue(forbiddenError);
    listOrganizationsMock.mockRejectedValueOnce(new Error('forbidden-list'));

    const { result } = renderHook(() => useOrganizations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(forbiddenError);
    });

    listOrganizationsMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 25, total: 0 },
    });
    updateOrganizationMock.mockRejectedValueOnce(new Error('forbidden-update'));

    await act(async () => {
      await result.current.refetch();
      const updated = await result.current.updateOrganization('org-1', { displayName: 'blocked' });
      expect(updated).toBeNull();
    });

    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(2);
    expect(result.current.mutationError).toBe(forbiddenError);
  });

  it('handles detail errors and clears transient organization state helpers', async () => {
    const forbiddenError = { status: 403, code: 'forbidden', message: 'Forbidden' };
    asIamErrorMock.mockReturnValue(forbiddenError);
    listOrganizationsMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 25, total: 0 },
    });
    getOrganizationMock.mockRejectedValueOnce(new Error('forbidden-detail'));
    deactivateOrganizationMock.mockResolvedValue({ data: { id: 'org-1' } });

    const { result } = renderHook(() => useOrganizations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      const detail = await result.current.loadOrganization('org-1');
      expect(detail).toBeNull();
    });

    expect(result.current.mutationError).toBe(forbiddenError);

    act(() => {
      result.current.clearMutationError();
      result.current.clearSelectedOrganization();
    });

    expect(result.current.mutationError).toBeNull();
    expect(result.current.selectedOrganization).toBeNull();
    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(1);
  });
});
