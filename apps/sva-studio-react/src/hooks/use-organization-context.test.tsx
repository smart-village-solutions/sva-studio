import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOrganizationContext } from './use-organization-context';

const getMyOrganizationContextMock = vi.fn();
const updateMyOrganizationContextMock = vi.fn();
const asIamErrorMock = vi.fn();

type AuthMockValue = {
  user: {
    id: string;
    instanceId?: string;
    name: string;
    roles: string[];
  };
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  refetch: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
  invalidatePermissions: ReturnType<typeof vi.fn>;
};

const authMockValue: AuthMockValue = {
  user: {
    id: 'admin-1',
    instanceId: 'instance-1',
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
  asIamError: (...args: unknown[]) => asIamErrorMock(...args),
  getMyOrganizationContext: (...args: unknown[]) => getMyOrganizationContextMock(...args),
  updateMyOrganizationContext: (...args: unknown[]) => updateMyOrganizationContextMock(...args),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => authMockValue,
}));

describe('useOrganizationContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMockValue.isAuthenticated = true;
    authMockValue.user.instanceId = 'instance-1';
  });

  it('loads the active organization context for authenticated users', async () => {
    getMyOrganizationContextMock.mockResolvedValue({
      data: {
        activeOrganizationId: 'org-1',
        organizations: [
          {
            organizationId: 'org-1',
            organizationKey: 'alpha',
            displayName: 'Alpha',
            organizationType: 'county',
            isActive: true,
            isDefaultContext: true,
          },
        ],
      },
    });

    const { result } = renderHook(() => useOrganizationContext());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.context?.activeOrganizationId).toBe('org-1');
    });
  });

  it('clears state without requesting data when the user is not authenticated', async () => {
    authMockValue.isAuthenticated = false;

    const { result } = renderHook(() => useOrganizationContext());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.context).toBeNull();
    });

    expect(getMyOrganizationContextMock).not.toHaveBeenCalled();
  });

  it('does not request organization context for authenticated root users without instance context', async () => {
    authMockValue.user.instanceId = undefined;

    const { result } = renderHook(() => useOrganizationContext());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.context).toBeNull();
      expect(result.current.error).toBeNull();
    });

    await act(async () => {
      const switched = await result.current.switchOrganization('org-2');
      expect(switched).toBe(false);
    });

    expect(getMyOrganizationContextMock).not.toHaveBeenCalled();
    expect(updateMyOrganizationContextMock).not.toHaveBeenCalled();
  });

  it('switches the organization and invalidates permissions on success', async () => {
    getMyOrganizationContextMock.mockResolvedValue({
      data: {
        activeOrganizationId: 'org-1',
        organizations: [],
      },
    });
    updateMyOrganizationContextMock.mockResolvedValue({
      data: {
        activeOrganizationId: 'org-2',
        organizations: [],
      },
    });

    const { result } = renderHook(() => useOrganizationContext());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      const switched = await result.current.switchOrganization('org-2');
      expect(switched).toBe(true);
    });

    expect(result.current.context?.activeOrganizationId).toBe('org-2');
    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(1);
  });

  it('stores the resolved error and invalidates permissions on forbidden responses', async () => {
    const forbiddenError = { status: 403, code: 'forbidden', message: 'Forbidden' };
    asIamErrorMock.mockReturnValue(forbiddenError);
    getMyOrganizationContextMock.mockRejectedValueOnce(new Error('forbidden-load'));

    const { result } = renderHook(() => useOrganizationContext());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(forbiddenError);
    });

    updateMyOrganizationContextMock.mockRejectedValueOnce(new Error('forbidden-switch'));

    await act(async () => {
      const switched = await result.current.switchOrganization('org-2');
      expect(switched).toBe(false);
    });

    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBe(forbiddenError);
  });
});
