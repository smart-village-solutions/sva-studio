import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
});
