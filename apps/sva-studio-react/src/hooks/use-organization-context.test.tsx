import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OrganizationContextProvider, useOrganizationContext } from './use-organization-context';

const getMyOrganizationContextMock = vi.fn();
const updateMyOrganizationContextMock = vi.fn();
const asIamErrorMock = vi.fn();

const createDeferred = <T,>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

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
  refreshSession: ReturnType<typeof vi.fn>;
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
  refreshSession: vi.fn(),
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
  const wrapper = ({ children }: PropsWithChildren) => (
    <OrganizationContextProvider>{children}</OrganizationContextProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    authMockValue.isAuthenticated = true;
    authMockValue.user.id = 'admin-1';
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

    const { result } = renderHook(() => useOrganizationContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.context?.activeOrganizationId).toBe('org-1');
    });
  });

  it('clears state without requesting data when the user is not authenticated', async () => {
    authMockValue.isAuthenticated = false;

    const { result } = renderHook(() => useOrganizationContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.context).toBeNull();
    });

    expect(getMyOrganizationContextMock).not.toHaveBeenCalled();
  });

  it('does not request organization context for authenticated root users without instance context', async () => {
    authMockValue.user.instanceId = undefined;

    const { result } = renderHook(() => useOrganizationContext(), { wrapper });

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

  it('switches the organization without coupling the scope change to an auth refresh', async () => {
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

    const { result } = renderHook(() => useOrganizationContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      const switched = await result.current.switchOrganization('org-2');
      expect(switched).toBe(true);
    });

    expect(result.current.context?.activeOrganizationId).toBe('org-2');
    expect(authMockValue.refreshSession).not.toHaveBeenCalled();

    updateMyOrganizationContextMock.mockResolvedValueOnce({
      data: { activeOrganizationId: undefined, organizations: [] },
    });
    await act(async () => {
      const switched = await result.current.switchOrganization(null);
      expect(switched).toBe(true);
    });
    expect(updateMyOrganizationContextMock).toHaveBeenLastCalledWith(null);
    expect(result.current.context?.activeOrganizationId).toBeUndefined();
  });

  it('does not let a context read started before a confirmed switch replace the new organization', async () => {
    const staleRead = createDeferred<{
      data: { activeOrganizationId: string; organizations: [] };
    }>();
    getMyOrganizationContextMock
      .mockResolvedValueOnce({ data: { activeOrganizationId: 'org-1', organizations: [] } })
      .mockReturnValueOnce(staleRead.promise);
    updateMyOrganizationContextMock.mockResolvedValue({
      data: { activeOrganizationId: 'org-2', organizations: [] },
    });

    const { result } = renderHook(() => useOrganizationContext(), { wrapper });
    await waitFor(() => expect(result.current.context?.activeOrganizationId).toBe('org-1'));

    let staleRequest!: Promise<void>;
    act(() => {
      staleRequest = result.current.refetch();
    });
    await waitFor(() => expect(getMyOrganizationContextMock).toHaveBeenCalledTimes(2));

    await act(async () => {
      await expect(result.current.switchOrganization('org-2')).resolves.toBe(true);
    });
    await act(async () => {
      staleRead.resolve({ data: { activeOrganizationId: 'org-1', organizations: [] } });
      await staleRequest;
    });

    expect(result.current.context?.activeOrganizationId).toBe('org-2');
  });

  it('serializes organization switches so their writes cannot overtake one another', async () => {
    const firstWrite = createDeferred<{
      data: { activeOrganizationId: string; organizations: [] };
    }>();
    getMyOrganizationContextMock.mockResolvedValue({
      data: { activeOrganizationId: 'org-1', organizations: [] },
    });
    updateMyOrganizationContextMock
      .mockReturnValueOnce(firstWrite.promise)
      .mockResolvedValueOnce({ data: { activeOrganizationId: 'org-3', organizations: [] } });

    const { result } = renderHook(() => useOrganizationContext(), { wrapper });
    await waitFor(() => expect(result.current.context?.activeOrganizationId).toBe('org-1'));
    const switchOrganization = result.current.switchOrganization;
    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = switchOrganization('org-2');
      second = switchOrganization('org-3');
    });
    await waitFor(() => expect(updateMyOrganizationContextMock).toHaveBeenCalledTimes(1));
    expect(updateMyOrganizationContextMock).toHaveBeenCalledWith('org-2');

    await act(async () => {
      firstWrite.resolve({ data: { activeOrganizationId: 'org-2', organizations: [] } });
      await expect(first).resolves.toBe(true);
      await expect(second).resolves.toBe(true);
    });

    expect(updateMyOrganizationContextMock).toHaveBeenNthCalledWith(2, 'org-3');
    expect(result.current.context?.activeOrganizationId).toBe('org-3');
  });

  it('reads back an ambiguous switch result once and never repeats the write', async () => {
    getMyOrganizationContextMock
      .mockResolvedValueOnce({ data: { activeOrganizationId: 'org-1', organizations: [] } })
      .mockResolvedValueOnce({ data: { activeOrganizationId: 'org-2', organizations: [] } });
    updateMyOrganizationContextMock.mockRejectedValueOnce(new Error('response lost'));

    const { result } = renderHook(() => useOrganizationContext(), { wrapper });
    await waitFor(() => expect(result.current.context?.activeOrganizationId).toBe('org-1'));

    await act(async () => {
      await expect(result.current.switchOrganization('org-2')).resolves.toBe(true);
    });

    expect(updateMyOrganizationContextMock).toHaveBeenCalledTimes(1);
    expect(getMyOrganizationContextMock).toHaveBeenCalledTimes(2);
    expect(result.current.context?.activeOrganizationId).toBe('org-2');
  });

  it('hides the prior user organization and discards its late read after an identity change', async () => {
    const oldRead = createDeferred<{
      data: { activeOrganizationId: string; organizations: [] };
    }>();
    getMyOrganizationContextMock
      .mockReturnValueOnce(oldRead.promise)
      .mockResolvedValueOnce({ data: { activeOrganizationId: 'org-new-user', organizations: [] } });

    const { result, rerender } = renderHook(() => useOrganizationContext(), { wrapper });
    await waitFor(() => expect(getMyOrganizationContextMock).toHaveBeenCalledTimes(1));
    authMockValue.user.id = 'admin-2';
    rerender();

    await waitFor(() => expect(result.current.context?.activeOrganizationId).toBe('org-new-user'));
    await act(async () => {
      oldRead.resolve({ data: { activeOrganizationId: 'org-old-user', organizations: [] } });
      await Promise.resolve();
    });

    expect(result.current.context?.activeOrganizationId).toBe('org-new-user');
  });

  it.each([
    { status: 401, code: 'unauthorized', message: 'Unauthorized' },
    { status: 403, code: 'forbidden', message: 'Forbidden' },
  ])(
    'stores protected response errors without coupling them to an auth refresh (status $status, code $code)',
    async (protectedError) => {
      asIamErrorMock.mockReturnValue(protectedError);
      getMyOrganizationContextMock.mockRejectedValueOnce(new Error('protected-load'));

      const { result } = renderHook(() => useOrganizationContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBe(protectedError);
      });

      updateMyOrganizationContextMock.mockRejectedValueOnce(new Error('protected-switch'));

      await act(async () => {
        const switched = await result.current.switchOrganization('org-2');
        expect(switched).toBe(false);
      });

      expect(authMockValue.refreshSession).not.toHaveBeenCalled();
      expect(result.current.error).toBe(protectedError);
    }
  );
});
