import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useRoles } from './use-roles';

const listRolesMock = vi.fn();
const createRoleMock = vi.fn();
const updateRoleMock = vi.fn();
const deleteRoleMock = vi.fn();
const reconcileRolesMock = vi.fn();
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
  listRoles: (...args: unknown[]) => listRolesMock(...args),
  createRole: (...args: unknown[]) => createRoleMock(...args),
  updateRole: (...args: unknown[]) => updateRoleMock(...args),
  deleteRole: (...args: unknown[]) => deleteRoleMock(...args),
  reconcileRoles: (...args: unknown[]) => reconcileRolesMock(...args),
  asIamError: (...args: unknown[]) => asIamErrorMock(...args),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => authMockValue,
}));

describe('useRoles', () => {
  beforeEach(() => {
    listRolesMock.mockReset();
    createRoleMock.mockReset();
    updateRoleMock.mockReset();
    deleteRoleMock.mockReset();
    reconcileRolesMock.mockReset();
    asIamErrorMock.mockReset();
    authMockValue.invalidatePermissions.mockReset();
  });

  it('loads and mutates roles', async () => {
    asIamErrorMock.mockImplementation((cause: unknown) => cause);
    listRolesMock.mockResolvedValue({
      data: [
        {
          id: 'role-1',
          roleKey: 'editor',
          roleName: 'editor',
          externalRoleName: 'editor',
          managedBy: 'studio',
          isSystemRole: false,
          roleLevel: 10,
          memberCount: 1,
          syncState: 'synced',
          permissions: [],
        },
      ],
      pagination: {
        page: 1,
        pageSize: 1,
        total: 1,
      },
    });

    createRoleMock.mockResolvedValue({
      data: {
        id: 'role-2',
        roleKey: 'custom',
        roleName: 'Custom',
        externalRoleName: 'custom',
        managedBy: 'studio',
        isSystemRole: false,
        roleLevel: 20,
        memberCount: 0,
        syncState: 'synced',
        permissions: [],
      },
    });
    updateRoleMock.mockResolvedValue({
      data: {
        id: 'role-1',
        roleKey: 'editor',
        roleName: 'Editor',
        externalRoleName: 'editor',
        managedBy: 'studio',
        isSystemRole: false,
        roleLevel: 10,
        memberCount: 1,
        syncState: 'synced',
        permissions: [],
      },
    });
    deleteRoleMock.mockResolvedValue({ data: { id: 'role-1' } });
    reconcileRolesMock.mockResolvedValue({
      data: {
        checkedCount: 1,
        correctedCount: 1,
        failedCount: 0,
        requiresManualActionCount: 0,
        roles: [],
      },
    });

    const { result } = renderHook(() => useRoles());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.roles).toHaveLength(1);
    });

    await act(async () => {
      await result.current.createRole({ roleName: 'custom' });
      await result.current.updateRole('role-1', { description: 'updated' });
      await result.current.deleteRole('role-1');
      await result.current.retryRoleSync('role-1');
      await result.current.reconcile();
    });

    expect(createRoleMock).toHaveBeenCalledTimes(1);
    expect(updateRoleMock).toHaveBeenCalledTimes(2);
    expect(deleteRoleMock).toHaveBeenCalledTimes(1);
    expect(reconcileRolesMock).toHaveBeenCalledTimes(1);
    expect(result.current.reconcileReport?.correctedCount).toBe(1);
  });

  it('invalidates permissions when initial fetch returns 403', async () => {
    const forbiddenError = { status: 403, code: 'forbidden', message: 'Forbidden' };
    asIamErrorMock.mockReturnValue(forbiddenError);
    listRolesMock.mockRejectedValueOnce(new Error('forbidden-list'));

    const { result } = renderHook(() => useRoles());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(forbiddenError);
      expect(result.current.roles).toHaveLength(0);
    });

    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(1);
  });

  it('returns false and stores error when mutation fails without 403', async () => {
    const conflictError = { status: 409, code: 'conflict', message: 'Conflict' };
    asIamErrorMock.mockReturnValue(conflictError);
    listRolesMock.mockResolvedValueOnce({
      data: [
        {
          id: 'role-a',
          roleKey: 'editor',
          roleName: 'editor',
          externalRoleName: 'editor',
          managedBy: 'studio',
          isSystemRole: false,
          roleLevel: 10,
          memberCount: 1,
          syncState: 'synced',
          permissions: [],
        },
      ],
      pagination: {
        page: 1,
        pageSize: 1,
        total: 1,
      },
    });
    createRoleMock.mockRejectedValueOnce(new Error('conflict-create'));

    const { result } = renderHook(() => useRoles());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.roles).toHaveLength(1);
    });

    await act(async () => {
      const created = await result.current.createRole({ roleName: 'editor' });
      expect(created).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.mutationError).toBe(conflictError);
    expect(authMockValue.invalidatePermissions).not.toHaveBeenCalled();
  });

  it('invalidates permissions when mutation fails with 403', async () => {
    const forbiddenError = { status: 403, code: 'forbidden', message: 'Forbidden' };
    asIamErrorMock.mockReturnValue(forbiddenError);
    listRolesMock.mockResolvedValueOnce({
      data: [
        {
          id: 'role-b',
          roleKey: 'reviewer',
          roleName: 'reviewer',
          externalRoleName: 'reviewer',
          managedBy: 'studio',
          isSystemRole: false,
          roleLevel: 20,
          memberCount: 0,
          syncState: 'synced',
          permissions: [],
        },
      ],
      pagination: {
        page: 1,
        pageSize: 1,
        total: 1,
      },
    });
    deleteRoleMock.mockRejectedValueOnce(new Error('forbidden-delete'));

    const { result } = renderHook(() => useRoles());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      const deleted = await result.current.deleteRole('role-b');
      expect(deleted).toBe(false);
    });

    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.mutationError).toBe(forbiddenError);
  });

  it('can clear a stored mutation error explicitly', async () => {
    const conflictError = { status: 409, code: 'conflict', message: 'Conflict' };
    asIamErrorMock.mockReturnValue(conflictError);
    listRolesMock.mockResolvedValueOnce({
      data: [],
      pagination: {
        page: 1,
        pageSize: 1,
        total: 0,
      },
    });
    createRoleMock.mockRejectedValueOnce(new Error('conflict-create'));

    const { result } = renderHook(() => useRoles());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.createRole({ roleName: 'editor' });
    });

    expect(result.current.mutationError).toBe(conflictError);

    act(() => {
      result.current.clearMutationError();
    });

    expect(result.current.mutationError).toBeNull();
  });
});
