import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useUser } from './use-user';

const getUserMock = vi.fn();
const updateUserMock = vi.fn();
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
  getUser: (...args: unknown[]) => getUserMock(...args),
  updateUser: (...args: unknown[]) => updateUserMock(...args),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => authMockValue,
}));

describe('useUser', () => {
  it('loads and updates a user', async () => {
    getUserMock.mockResolvedValue({
      data: {
        id: 'user-1',
        keycloakSubject: 'subject-1',
        displayName: 'User One',
        status: 'active',
        roles: [],
      },
    });

    updateUserMock.mockResolvedValue({
      data: {
        id: 'user-1',
        keycloakSubject: 'subject-1',
        displayName: 'User One Updated',
        status: 'active',
        roles: [],
      },
    });

    const { result } = renderHook(() => useUser('user-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.user?.displayName).toBe('User One');
    });

    await act(async () => {
      const saved = await result.current.save({ displayName: 'User One Updated' });
      expect(saved?.displayName).toBe('User One Updated');
    });

    expect(updateUserMock).toHaveBeenCalledWith('user-1', { displayName: 'User One Updated' });
  });
});
