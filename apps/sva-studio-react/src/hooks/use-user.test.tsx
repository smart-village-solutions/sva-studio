import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUser } from './use-user';

const getUserMock = vi.fn();
const updateUserMock = vi.fn();
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
  getUser: (...args: unknown[]) => getUserMock(...args),
  updateUser: (...args: unknown[]) => updateUserMock(...args),
  asIamError: (...args: unknown[]) => asIamErrorMock(...args),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => authMockValue,
}));

describe('useUser', () => {
  beforeEach(() => {
    getUserMock.mockReset();
    updateUserMock.mockReset();
    asIamErrorMock.mockReset();
    authMockValue.invalidatePermissions.mockReset();
  });

  it('invalidates permissions when loading user returns 403', async () => {
    const forbiddenError = { status: 403, code: 'forbidden', message: 'Forbidden' };
    asIamErrorMock.mockReturnValue(forbiddenError);
    getUserMock.mockRejectedValueOnce(new Error('no-access'));

    const { result } = renderHook(() => useUser('user-403'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.error).toBe(forbiddenError);
    });

    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(1);
  });

  it('returns null from save and stores non-403 error without invalidating permissions', async () => {
    const validationError = { status: 400, code: 'invalid', message: 'Invalid payload' };
    asIamErrorMock.mockReturnValue(validationError);
    getUserMock.mockResolvedValueOnce({
      data: {
        id: 'user-2',
        keycloakSubject: 'subject-2',
        displayName: 'User Two',
        status: 'active',
        roles: [],
      },
    });
    updateUserMock.mockRejectedValueOnce(new Error('validation-error'));

    const { result } = renderHook(() => useUser('user-2'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.user?.displayName).toBe('User Two');
    });

    await act(async () => {
      const saved = await result.current.save({ displayName: '' });
      expect(saved).toBeNull();
    });

    expect(result.current.error).toBe(validationError);
    expect(authMockValue.invalidatePermissions).not.toHaveBeenCalled();
  });

  it('loads and updates a user', async () => {
    asIamErrorMock.mockImplementation((cause: unknown) => cause);
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

  it('invalidates permissions when save returns 403', async () => {
    const forbiddenError = { status: 403, code: 'forbidden', message: 'Forbidden' };
    asIamErrorMock.mockReturnValue(forbiddenError);
    getUserMock.mockResolvedValueOnce({
      data: {
        id: 'user-3',
        keycloakSubject: 'subject-3',
        displayName: 'User Three',
        status: 'active',
        roles: [],
      },
    });
    updateUserMock.mockRejectedValueOnce(new Error('forbidden-save'));

    const { result } = renderHook(() => useUser('user-3'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      const saved = await result.current.save({ displayName: 'Changed' });
      expect(saved).toBeNull();
    });

    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe(forbiddenError);
  });
});
