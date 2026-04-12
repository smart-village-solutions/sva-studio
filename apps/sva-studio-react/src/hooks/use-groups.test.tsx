import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useGroups } from './use-groups';

const listGroupsMock = vi.fn();
const getGroupMock = vi.fn();
const createGroupMock = vi.fn();
const updateGroupMock = vi.fn();
const deleteGroupMock = vi.fn();
const assignGroupRoleMock = vi.fn();
const removeGroupRoleMock = vi.fn();
const assignGroupMembershipMock = vi.fn();
const removeGroupMembershipMock = vi.fn();
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
  getGroup: (...args: unknown[]) => getGroupMock(...args),
  createGroup: (...args: unknown[]) => createGroupMock(...args),
  updateGroup: (...args: unknown[]) => updateGroupMock(...args),
  deleteGroup: (...args: unknown[]) => deleteGroupMock(...args),
  assignGroupRole: (...args: unknown[]) => assignGroupRoleMock(...args),
  removeGroupRole: (...args: unknown[]) => removeGroupRoleMock(...args),
  assignGroupMembership: (...args: unknown[]) => assignGroupMembershipMock(...args),
  removeGroupMembership: (...args: unknown[]) => removeGroupMembershipMock(...args),
  asIamError: (...args: unknown[]) => asIamErrorMock(...args),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => authMockValue,
}));

describe('useGroups', () => {
  beforeEach(() => {
    listGroupsMock.mockReset();
    getGroupMock.mockReset();
    createGroupMock.mockReset();
    updateGroupMock.mockReset();
    deleteGroupMock.mockReset();
    assignGroupRoleMock.mockReset();
    removeGroupRoleMock.mockReset();
    assignGroupMembershipMock.mockReset();
    removeGroupMembershipMock.mockReset();
    asIamErrorMock.mockReset();
    authMockValue.invalidatePermissions.mockReset();
  });

  it('loads groups, group details and all mutations', async () => {
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
          roleCount: 1,
        },
      ],
      pagination: {
        page: 1,
        pageSize: 1,
        total: 1,
      },
    });
    getGroupMock.mockResolvedValue({
      data: {
        id: 'group-1',
        groupKey: 'admins',
        displayName: 'Admins',
        description: 'Administrative Gruppe',
        groupType: 'role_bundle',
        isActive: true,
        memberCount: 2,
        roleCount: 1,
        assignedRoleIds: ['role-1'],
        memberships: [],
      },
    });
    createGroupMock.mockResolvedValue({ data: { id: 'group-2' } });
    updateGroupMock.mockResolvedValue({ data: { id: 'group-1' } });
    deleteGroupMock.mockResolvedValue({ data: { id: 'group-1' } });
    assignGroupRoleMock.mockResolvedValue({ data: { id: 'group-1' } });
    removeGroupRoleMock.mockResolvedValue({ data: { id: 'group-1' } });
    assignGroupMembershipMock.mockResolvedValue({ data: { id: 'group-1' } });
    removeGroupMembershipMock.mockResolvedValue({ data: { id: 'group-1' } });

    const { result } = renderHook(() => useGroups());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.groups).toHaveLength(1);
    });

    await act(async () => {
      await expect(result.current.loadGroupDetail('group-1')).resolves.toMatchObject({
        id: 'group-1',
        assignedRoleIds: ['role-1'],
      });
      await expect(result.current.createGroup({ groupKey: 'team_editors', displayName: 'Team Editors' })).resolves.toBe(
        'group-2'
      );
      await result.current.updateGroup('group-1', { displayName: 'Editors' });
      await result.current.assignRole('group-1', 'role-2');
      await result.current.removeRole('group-1', 'role-1');
      await result.current.assignMembership('group-1', { keycloakSubject: 'user-123' });
      await result.current.removeMembership('group-1', 'user-123');
      await result.current.deleteGroup('group-1');
    });

    expect(getGroupMock).toHaveBeenCalledWith('group-1');
    expect(createGroupMock).toHaveBeenCalledTimes(1);
    expect(updateGroupMock).toHaveBeenCalledTimes(1);
    expect(assignGroupRoleMock).toHaveBeenCalledWith('group-1', { roleId: 'role-2' });
    expect(removeGroupRoleMock).toHaveBeenCalledWith('group-1', 'role-1');
    expect(assignGroupMembershipMock).toHaveBeenCalledWith('group-1', { keycloakSubject: 'user-123' });
    expect(removeGroupMembershipMock).toHaveBeenCalledWith('group-1', 'user-123');
    expect(deleteGroupMock).toHaveBeenCalledTimes(1);
    expect(listGroupsMock).toHaveBeenCalledTimes(8);
  });

  it('normalizes legacy group detail payloads with roles and members', async () => {
    asIamErrorMock.mockImplementation((cause: unknown) => cause);
    listGroupsMock.mockResolvedValueOnce({
      data: [],
      pagination: {
        page: 1,
        pageSize: 1,
        total: 0,
      },
    });
    getGroupMock.mockResolvedValueOnce({
      data: {
        id: 'group-1',
        groupKey: 'admins',
        displayName: 'Admins',
        description: 'Administrative Gruppe',
        instanceId: 'de-musterhausen',
        groupType: 'role_bundle',
        isActive: true,
        memberCount: 1,
        roleCount: 1,
        roles: [{ roleId: 'role-legacy' }],
        members: [
          {
            accountId: 'account-1',
            groupId: 'group-1',
            displayName: 'Ada Admin',
            validFrom: '2026-04-01T00:00:00.000Z',
            validTo: '2026-05-01T00:00:00.000Z',
          },
        ],
      },
    });

    const { result } = renderHook(() => useGroups());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await expect(result.current.loadGroupDetail('group-1')).resolves.toMatchObject({
        assignedRoleIds: ['role-legacy'],
        memberships: [
          expect.objectContaining({
            instanceId: 'de-musterhausen',
            accountId: 'account-1',
            keycloakSubject: '',
            validFrom: '2026-04-01T00:00:00.000Z',
            validUntil: '2026-05-01T00:00:00.000Z',
            assignedAt: '2026-04-01T00:00:00.000Z',
          }),
        ],
      });
    });
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

  it('stores page error and invalidates permissions when detail fetch returns 403', async () => {
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
    getGroupMock.mockRejectedValueOnce(new Error('forbidden-detail'));

    const { result } = renderHook(() => useGroups());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await expect(result.current.loadGroupDetail('group-1')).resolves.toBeNull();
    });

    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe(forbiddenError);
  });

  it('returns false and stores mutation error when create fails without 403', async () => {
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
          roleCount: 0,
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
      expect(created).toBeNull();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.mutationError).toBe(conflictError);
    expect(authMockValue.invalidatePermissions).not.toHaveBeenCalled();
  });

  it('invalidates permissions when membership removal fails with 403', async () => {
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
    removeGroupMembershipMock.mockRejectedValueOnce(new Error('forbidden-delete-membership'));

    const { result } = renderHook(() => useGroups());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      const removed = await result.current.removeMembership('group-1', 'user-123');
      expect(removed).toBe(false);
    });

    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.mutationError).toBe(forbiddenError);
  });
});
