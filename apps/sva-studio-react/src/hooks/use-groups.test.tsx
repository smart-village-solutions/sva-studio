import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useGroups } from './use-groups';

const listGroupsMock = vi.fn();
const createGroupMock = vi.fn();
const updateGroupMock = vi.fn();
const deleteGroupMock = vi.fn();
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
  listGroups: (...args: unknown[]) => listGroupsMock(...args),
  createGroup: (...args: unknown[]) => createGroupMock(...args),
  updateGroup: (...args: unknown[]) => updateGroupMock(...args),
  deleteGroup: (...args: unknown[]) => deleteGroupMock(...args),
  asIamError: (...args: unknown[]) => asIamErrorMock(...args),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => authMockValue,
}));

describe('useGroups', () => {
  beforeEach(() => {
    listGroupsMock.mockReset();
    createGroupMock.mockReset();
    updateGroupMock.mockReset();
    deleteGroupMock.mockReset();
    asIamErrorMock.mockReset();
    authMockValue.invalidatePermissions.mockReset();
  });

  it('loads and mutates groups', async () => {
    asIamErrorMock.mockImplementation((cause: unknown) => cause);
    listGroupsMock.mockResolvedValue({
      data: [
        {
          id: 'group-1',
          groupKey: 'admins',
          displayName: 'Admins',
          description: 'Administrative Gruppe',
          groupType: 'role_bundle',
          isActive: true,
          memberCount: 2,
          roles: [{ roleId: 'role-1', roleKey: 'system_admin', roleName: 'System Admin' }],
        },
      ],
      pagination: {
        page: 1,
        pageSize: 1,
        total: 1,
      },
    });
    createGroupMock.mockResolvedValue({ data: { id: 'group-2' } });
    updateGroupMock.mockResolvedValue({ data: { id: 'group-1' } });
    deleteGroupMock.mockResolvedValue({ data: { id: 'group-1' } });

    const { result } = renderHook(() => useGroups());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.groups).toHaveLength(1);
    });

    await act(async () => {
      await result.current.createGroup({ groupKey: 'team_editors', displayName: 'Team Editors' });
      await result.current.updateGroup('group-1', { displayName: 'Editors' });
      await result.current.deleteGroup('group-1');
    });

    expect(createGroupMock).toHaveBeenCalledTimes(1);
    expect(updateGroupMock).toHaveBeenCalledTimes(1);
    expect(deleteGroupMock).toHaveBeenCalledTimes(1);
    expect(listGroupsMock).toHaveBeenCalledTimes(4);
  });

  it('invalidates permissions when initial fetch returns 403', async () => {
    const forbiddenError = { status: 403, code: 'forbidden', message: 'Forbidden' };
    asIamErrorMock.mockReturnValue(forbiddenError);
    listGroupsMock.mockRejectedValueOnce(new Error('forbidden-list'));

    const { result } = renderHook(() => useGroups());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(forbiddenError);
      expect(result.current.groups).toHaveLength(0);
    });

    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(1);
  });

  it('returns false and stores error when mutation fails without 403', async () => {
    const conflictError = { status: 409, code: 'conflict', message: 'Conflict' };
    asIamErrorMock.mockReturnValue(conflictError);
    listGroupsMock.mockResolvedValueOnce({
      data: [
        {
          id: 'group-1',
          groupKey: 'editors',
          displayName: 'Editors',
          description: undefined,
          groupType: 'role_bundle',
          isActive: true,
          memberCount: 0,
          roles: [],
        },
      ],
      pagination: {
        page: 1,
        pageSize: 1,
        total: 1,
      },
    });
    createGroupMock.mockRejectedValueOnce(new Error('conflict-create'));

    const { result } = renderHook(() => useGroups());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.groups).toHaveLength(1);
    });

    await act(async () => {
      const created = await result.current.createGroup({ groupKey: 'editors', displayName: 'Editors' });
      expect(created).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.mutationError).toBe(conflictError);
    expect(authMockValue.invalidatePermissions).not.toHaveBeenCalled();
  });

  it('invalidates permissions when mutation fails with 403', async () => {
    const forbiddenError = { status: 403, code: 'forbidden', message: 'Forbidden' };
    asIamErrorMock.mockReturnValue(forbiddenError);
    listGroupsMock.mockResolvedValueOnce({
      data: [],
      pagination: {
        page: 1,
        pageSize: 1,
        total: 0,
      },
    });
    deleteGroupMock.mockRejectedValueOnce(new Error('forbidden-delete'));

    const { result } = renderHook(() => useGroups());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      const deleted = await result.current.deleteGroup('group-1');
      expect(deleted).toBe(false);
    });

    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.mutationError).toBe(forbiddenError);
  });
});
