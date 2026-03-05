import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUsers } from './use-users';

const listUsersMock = vi.fn();
const createUserMock = vi.fn();
const updateUserMock = vi.fn();
const deactivateUserMock = vi.fn();
const bulkDeactivateUsersMock = vi.fn();
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
  asIamError: (cause: unknown) => {
    if (cause instanceof Error && 'status' in cause && 'code' in cause) {
      return cause;
    }
    return {
      status: 500,
      code: 'internal_error',
      message: cause instanceof Error ? cause.message : String(cause),
    };
  },
  listUsers: (...args: unknown[]) => listUsersMock(...args),
  createUser: (...args: unknown[]) => createUserMock(...args),
  updateUser: (...args: unknown[]) => updateUserMock(...args),
  deactivateUser: (...args: unknown[]) => deactivateUserMock(...args),
  bulkDeactivateUsers: (...args: unknown[]) => bulkDeactivateUsersMock(...args),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => authMockValue,
}));

describe('useUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads users and supports create/deactivate operations', async () => {
    listUsersMock.mockResolvedValue({
      data: [
        {
          id: 'user-1',
          keycloakSubject: 'subject-1',
          displayName: 'First User',
          email: 'first@example.com',
          status: 'active',
          roles: [],
        },
      ],
      pagination: {
        page: 1,
        pageSize: 25,
        total: 1,
      },
    });

    createUserMock.mockResolvedValue({ data: { id: 'user-2', displayName: 'Second User' } });
    deactivateUserMock.mockResolvedValue({ data: { id: 'user-1' } });
    bulkDeactivateUsersMock.mockResolvedValue({ data: { deactivatedUserIds: ['user-1'], count: 1 } });

    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.users).toHaveLength(1);
    });

    await act(async () => {
      await result.current.createUser({ email: 'second@example.com' });
      await result.current.deactivateUser('user-1');
      await result.current.bulkDeactivate(['user-1']);
    });

    expect(createUserMock).toHaveBeenCalledTimes(1);
    expect(deactivateUserMock).toHaveBeenCalledTimes(1);
    expect(bulkDeactivateUsersMock).toHaveBeenCalledTimes(1);
  });

  it('invalidates permissions on 403 during initial load', async () => {
    listUsersMock.mockRejectedValue({
      status: 403,
      code: 'forbidden',
      message: 'forbidden',
    });

    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error?.status).toBe(403);
    expect(result.current.users).toHaveLength(0);
    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(1);
  });

  it('resets pagination when search/status/role changes and clamps page to minimum 1', async () => {
    listUsersMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 25, total: 0 },
    });

    const { result } = renderHook(() => useUsers({ page: 3 }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setPage(0);
    });
    expect(result.current.page).toBe(1);

    act(() => {
      result.current.setPage(4);
    });
    expect(result.current.page).toBe(4);

    act(() => {
      result.current.setSearch('alice');
    });
    expect(result.current.page).toBe(1);
    expect(result.current.filters.search).toBe('alice');

    act(() => {
      result.current.setStatus('inactive');
      result.current.setRole('editor');
    });

    expect(result.current.filters.status).toBe('inactive');
    expect(result.current.filters.role).toBe('editor');
    expect(result.current.page).toBe(1);
  });

  it('returns null and sets error when update fails with forbidden', async () => {
    listUsersMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 25, total: 0 },
    });
    updateUserMock.mockRejectedValue({
      status: 403,
      code: 'forbidden',
      message: 'forbidden',
    });

    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let response: unknown;
    await act(async () => {
      response = await result.current.updateUser('user-1', { firstName: 'Ada' });
    });

    expect(response).toBeNull();
    expect(result.current.error?.status).toBe(403);
    expect(authMockValue.invalidatePermissions).toHaveBeenCalled();
  });
});
