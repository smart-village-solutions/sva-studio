import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useRoles } from './use-roles';

const listRolesMock = vi.fn();
const createRoleMock = vi.fn();
const updateRoleMock = vi.fn();
const deleteRoleMock = vi.fn();
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
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => authMockValue,
}));

describe('useRoles', () => {
  it('loads and mutates roles', async () => {
    listRolesMock.mockResolvedValue({
      data: [
        {
          id: 'role-1',
          roleName: 'editor',
          isSystemRole: false,
          roleLevel: 10,
          memberCount: 1,
          permissions: [],
        },
      ],
      pagination: {
        page: 1,
        pageSize: 1,
        total: 1,
      },
    });

    createRoleMock.mockResolvedValue({ data: { id: 'role-2', roleName: 'custom' } });
    updateRoleMock.mockResolvedValue({ data: { id: 'role-1' } });
    deleteRoleMock.mockResolvedValue({ data: { id: 'role-1' } });

    const { result } = renderHook(() => useRoles());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.roles).toHaveLength(1);
    });

    await act(async () => {
      await result.current.createRole({ roleName: 'custom' });
      await result.current.updateRole('role-1', { description: 'updated' });
      await result.current.deleteRole('role-1');
    });

    expect(createRoleMock).toHaveBeenCalledTimes(1);
    expect(updateRoleMock).toHaveBeenCalledTimes(1);
    expect(deleteRoleMock).toHaveBeenCalledTimes(1);
  });
});
