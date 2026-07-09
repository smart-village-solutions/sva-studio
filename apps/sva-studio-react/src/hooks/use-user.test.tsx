import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUser } from './use-user';

const getUserMock = vi.fn();
const updateUserMock = vi.fn();
const sendPasswordSetupEmailMock = vi.fn();
const reprovisionMainserverUserMock = vi.fn();
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
  reprovisionMainserverUser: (...args: unknown[]) => reprovisionMainserverUserMock(...args),
  sendPasswordSetupEmail: (...args: unknown[]) => sendPasswordSetupEmailMock(...args),
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
    sendPasswordSetupEmailMock.mockReset();
    reprovisionMainserverUserMock.mockReset();
    asIamErrorMock.mockReset();
    authMockValue.invalidatePermissions.mockReset();
  });

  it.each([
    { status: 401, code: 'unauthorized', message: 'Unauthorized' },
    { status: 403, code: 'forbidden', message: 'Forbidden' },
  ])('invalidates permissions when loading user returns a protected error (status $status, code $code)', async (protectedError) => {
    asIamErrorMock.mockReturnValue(protectedError);
    getUserMock.mockRejectedValueOnce(new Error('no-access'));

    const { result } = renderHook(() => useUser(`user-${protectedError.status}`));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.error).toBe(protectedError);
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
        mainserverUserApplicationSecretSet: false,
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

    expect(result.current.error).toBeNull();
    expect(result.current.mutationError).toBe(validationError);
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
        mainserverUserApplicationSecretSet: false,
      },
    });

    updateUserMock.mockResolvedValue({
      data: {
        id: 'user-1',
        keycloakSubject: 'subject-1',
        displayName: 'User One Updated',
        status: 'active',
        roles: [],
        mainserverUserApplicationSecretSet: false,
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

  it.each([
    { status: 401, code: 'unauthorized', message: 'Unauthorized' },
    { status: 403, code: 'forbidden', message: 'Forbidden' },
  ])('invalidates permissions when save returns a protected error (status $status, code $code)', async (protectedError) => {
    asIamErrorMock.mockReturnValue(protectedError);
    getUserMock.mockResolvedValueOnce({
      data: {
        id: 'user-3',
        keycloakSubject: 'subject-3',
        displayName: 'User Three',
        status: 'active',
        roles: [],
        mainserverUserApplicationSecretSet: false,
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
    expect(result.current.error).toBeNull();
    expect(result.current.mutationError).toBe(protectedError);
  });

  it('resends the password setup email successfully', async () => {
    asIamErrorMock.mockImplementation((cause: unknown) => cause);
    getUserMock.mockResolvedValueOnce({
      data: {
        id: 'user-4',
        keycloakSubject: 'subject-4',
        displayName: 'User Four',
        status: 'active',
        roles: [],
        mainserverUserApplicationSecretSet: false,
      },
    });
    sendPasswordSetupEmailMock.mockResolvedValueOnce({
      data: {
        status: 'sent',
      },
    });

    const { result } = renderHook(() => useUser('user-4'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      const sent = await result.current.resendPasswordSetupEmail?.();
      expect(sent).toBe(true);
    });

    expect(sendPasswordSetupEmailMock).toHaveBeenCalledWith('user-4');
    expect(result.current.error).toBeNull();
    expect(authMockValue.invalidatePermissions).not.toHaveBeenCalled();
  });

  it('reprovisions mainserver data successfully and refetches the user', async () => {
    asIamErrorMock.mockImplementation((cause: unknown) => cause);
    getUserMock
      .mockResolvedValueOnce({
        data: {
          id: 'user-44',
          keycloakSubject: 'subject-44',
          displayName: 'User Forty Four',
          status: 'active',
          roles: [],
          mainserverUserApplicationSecretSet: false,
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: 'user-44',
          keycloakSubject: 'subject-44',
          displayName: 'User Forty Four',
          status: 'active',
          roles: [],
          mainserverUserApplicationId: 'mainserver-app-44',
          mainserverUserApplicationSecretSet: true,
        },
      });
    reprovisionMainserverUserMock.mockResolvedValueOnce({
      data: {
        status: 'updated',
      },
    });

    const { result } = renderHook(() => useUser('user-44'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.user?.mainserverUserApplicationSecretSet).toBe(false);
    });

    await act(async () => {
      const updated = await result.current.reprovisionMainserverData?.();
      expect(updated).toBe(true);
    });

    expect(reprovisionMainserverUserMock).toHaveBeenCalledWith('user-44');
    expect(getUserMock).toHaveBeenCalledTimes(2);
    expect(result.current.user?.mainserverUserApplicationId).toBe('mainserver-app-44');
    expect(result.current.user?.mainserverUserApplicationSecretSet).toBe(true);
  });

  it.each([
    { status: 401, code: 'unauthorized', message: 'Unauthorized' },
    { status: 403, code: 'forbidden', message: 'Forbidden' },
  ])(
    'invalidates permissions when resending the password setup email returns a protected error (status $status, code $code)',
    async (protectedError) => {
      asIamErrorMock.mockReturnValue(protectedError);
      getUserMock.mockResolvedValueOnce({
        data: {
          id: 'user-5',
          keycloakSubject: 'subject-5',
          displayName: 'User Five',
          status: 'active',
          roles: [],
          mainserverUserApplicationSecretSet: false,
        },
      });
      sendPasswordSetupEmailMock.mockRejectedValueOnce(new Error('forbidden-resend'));

      const { result } = renderHook(() => useUser('user-5'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        const sent = await result.current.resendPasswordSetupEmail?.();
        expect(sent).toBe(false);
      });

      expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(1);
      expect(result.current.error).toBeNull();
      expect(result.current.mutationError).toBe(protectedError);
    }
  );

  it('preserves mutation errors across successful refetches', async () => {
    const validationError = { status: 400, code: 'invalid', message: 'Invalid payload' };
    asIamErrorMock.mockReturnValue(validationError);
    getUserMock
      .mockResolvedValueOnce({
        data: {
          id: 'user-6',
          keycloakSubject: 'subject-6',
          displayName: 'User Six',
          status: 'active',
          roles: [],
          mainserverUserApplicationSecretSet: false,
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: 'user-6',
          keycloakSubject: 'subject-6',
          displayName: 'User Six Reloaded',
          status: 'active',
          roles: [],
          mainserverUserApplicationSecretSet: false,
        },
      });
    updateUserMock.mockRejectedValueOnce(new Error('validation-error'));

    const { result } = renderHook(() => useUser('user-6'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.user?.displayName).toBe('User Six');
    });

    await act(async () => {
      const saved = await result.current.save({ displayName: '' });
      expect(saved).toBeNull();
    });

    expect(result.current.mutationError).toBe(validationError);

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.user?.displayName).toBe('User Six Reloaded');
    expect(result.current.mutationError).toBe(validationError);
  });

  it('clears mutation errors when the hook is reused for another user', async () => {
    const validationError = { status: 400, code: 'invalid', message: 'Invalid payload' };
    asIamErrorMock.mockReturnValue(validationError);
    getUserMock
      .mockResolvedValueOnce({
        data: {
          id: 'user-7',
          keycloakSubject: 'subject-7',
          displayName: 'User Seven',
          status: 'active',
          roles: [],
          mainserverUserApplicationSecretSet: false,
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: 'user-8',
          keycloakSubject: 'subject-8',
          displayName: 'User Eight',
          status: 'active',
          roles: [],
          mainserverUserApplicationSecretSet: false,
        },
      });
    updateUserMock.mockRejectedValueOnce(new Error('validation-error'));

    const { result, rerender } = renderHook(({ userId }) => useUser(userId), {
      initialProps: { userId: 'user-7' },
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.user?.displayName).toBe('User Seven');
    });

    await act(async () => {
      const saved = await result.current.save({ displayName: '' });
      expect(saved).toBeNull();
    });

    expect(result.current.mutationError).toBe(validationError);

    rerender({ userId: 'user-8' });

    expect(result.current.mutationError).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.user?.displayName).toBe('User Eight');
    });
  });
});
