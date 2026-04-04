import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useRolePermissions } from './use-role-permissions';

const browserLoggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
const authMockValue = {
  invalidatePermissions: vi.fn(),
};

const listPermissionsMock = vi.fn();
const useIamAdminListMock = vi.fn();

vi.mock('../lib/iam-api', () => ({
  listPermissions: (...args: Parameters<typeof listPermissionsMock>) => listPermissionsMock(...args),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => authMockValue,
}));

vi.mock('./use-iam-admin-list', () => ({
  useIamAdminList: (...args: Parameters<typeof useIamAdminListMock>) => useIamAdminListMock(...args),
}));

vi.mock('@sva/sdk/logging', () => ({
  createBrowserLogger: () => browserLoggerMock,
}));

describe('useRolePermissions', () => {
  beforeEach(() => {
    authMockValue.invalidatePermissions.mockReset();
    listPermissionsMock.mockReset();
    useIamAdminListMock.mockReset();
    browserLoggerMock.debug.mockReset();
    browserLoggerMock.info.mockReset();
    browserLoggerMock.warn.mockReset();
    browserLoggerMock.error.mockReset();
  });

  it('maps the admin list hook result into the role permissions contract', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    const error = { code: 'database_unavailable' };
    const items = [
      {
        id: 'perm-1',
        instanceId: 'de-musterhausen',
        permissionKey: 'content.read',
        description: 'Read content',
      },
    ];

    useIamAdminListMock.mockReturnValue({
      items,
      isLoading: true,
      error,
      refetch,
    });

    const { result } = renderHook(() => useRolePermissions());

    expect(useIamAdminListMock).toHaveBeenCalledWith(expect.any(Function), authMockValue.invalidatePermissions);
    expect(result.current).toEqual({
      permissions: items,
      isLoading: true,
      error,
      refetch: expect.any(Function),
    });

    await result.current.refetch();
    expect(browserLoggerMock.debug).toHaveBeenCalledWith(
      'role_permissions_refetch_started',
      expect.objectContaining({ operation: 'refetch_role_permissions' })
    );
    expect(browserLoggerMock.debug).toHaveBeenCalledWith(
      'role_permissions_refetch_succeeded',
      expect.objectContaining({ operation: 'refetch_role_permissions' })
    );
  });
});
