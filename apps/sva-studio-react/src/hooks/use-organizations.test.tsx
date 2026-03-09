import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('useOrganizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    const { result } = renderHook(() => useOrganizations({ page: 2 }));

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
  });

  it('loads detail and supports organization mutations', async () => {
    listOrganizationsMock
      .mockResolvedValueOnce({
        data: [],
        pagination: { page: 1, pageSize: 25, total: 0 },
      })
      .mockResolvedValue({
        data: [],
        pagination: { page: 1, pageSize: 25, total: 0 },
      });
    getOrganizationMock.mockResolvedValue({
      data: {
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
        memberships: [],
        children: [],
        metadata: {},
      },
    });
    createOrganizationMock.mockResolvedValue({ data: { id: 'org-2' } });
    updateOrganizationMock.mockResolvedValue({ data: { id: 'org-1' } });
    deactivateOrganizationMock.mockResolvedValue({ data: { id: 'org-1' } });
    assignOrganizationMembershipMock.mockResolvedValue({ data: { id: 'org-1' } });
    removeOrganizationMembershipMock.mockResolvedValue({ data: { id: 'org-1' } });

    const { result } = renderHook(() => useOrganizations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.loadOrganization('org-1');
      await result.current.createOrganization({
        organizationKey: 'beta',
        displayName: 'Beta',
        organizationType: 'municipality',
        contentAuthorPolicy: 'org_only',
      });
      await result.current.updateOrganization('org-1', { displayName: 'Alpha 2' });
      await result.current.assignMembership('org-1', { accountId: 'account-1', visibility: 'internal' });
      await result.current.removeMembership('org-1', 'account-1');
      const deactivated = await result.current.deactivateOrganization('org-1');
      expect(deactivated).toBe(true);
    });

    expect(getOrganizationMock).toHaveBeenCalledWith('org-1');
    expect(createOrganizationMock).toHaveBeenCalledTimes(1);
    expect(updateOrganizationMock).toHaveBeenCalledTimes(1);
    expect(assignOrganizationMembershipMock).toHaveBeenCalledTimes(1);
    expect(removeOrganizationMembershipMock).toHaveBeenCalledTimes(1);
    expect(deactivateOrganizationMock).toHaveBeenCalledTimes(1);
    expect(result.current.selectedOrganization).toMatchObject({
      id: 'org-1',
      displayName: 'Alpha',
    });
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
