import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useInstances } from './use-instances';

const listInstancesMock = vi.fn();
const getInstanceMock = vi.fn();
const createInstanceMock = vi.fn();
const activateInstanceMock = vi.fn();
const suspendInstanceMock = vi.fn();
const archiveInstanceMock = vi.fn();
const authMockValue = {
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
  asIamError: (cause: unknown) => {
    if (cause && typeof cause === 'object' && 'status' in cause && 'code' in cause && 'message' in cause) {
      return cause;
    }
    return {
      status: 500,
      code: 'internal_error',
      message: cause instanceof Error ? cause.message : String(cause),
    };
  },
  listInstances: (...args: unknown[]) => listInstancesMock(...args),
  getInstance: (...args: unknown[]) => getInstanceMock(...args),
  createInstance: (...args: unknown[]) => createInstanceMock(...args),
  activateInstance: (...args: unknown[]) => activateInstanceMock(...args),
  suspendInstance: (...args: unknown[]) => suspendInstanceMock(...args),
  archiveInstance: (...args: unknown[]) => archiveInstanceMock(...args),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => authMockValue,
}));

describe('useInstances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    listInstancesMock.mockResolvedValue({
      data: [
        {
          instanceId: 'demo',
          displayName: 'Demo',
          status: 'active',
          parentDomain: 'studio.example.org',
          primaryHostname: 'demo.studio.example.org',
        },
      ],
    });
    getInstanceMock.mockResolvedValue({
      data: {
        instanceId: 'demo',
        displayName: 'Demo',
        status: 'active',
        parentDomain: 'studio.example.org',
        primaryHostname: 'demo.studio.example.org',
        hostnames: [],
        provisioningRuns: [],
        auditEvents: [],
      },
    });
    createInstanceMock.mockResolvedValue({
      data: {
        instanceId: 'demo',
        displayName: 'Demo',
        status: 'requested',
        parentDomain: 'studio.example.org',
        primaryHostname: 'demo.studio.example.org',
      },
    });
    activateInstanceMock.mockResolvedValue({ data: { instanceId: 'demo', status: 'active' } });
    suspendInstanceMock.mockResolvedValue({ data: { instanceId: 'demo', status: 'suspended' } });
    archiveInstanceMock.mockResolvedValue({ data: { instanceId: 'demo', status: 'archived' } });
  });

  it('loads instances, debounces filters, and manages selection state', async () => {
    const { result } = renderHook(() => useInstances());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.instances).toHaveLength(1);
    });

    act(() => {
      result.current.setSearch(' demo ');
      result.current.setStatus('active');
    });

    await waitFor(() => {
      expect(listInstancesMock).toHaveBeenLastCalledWith({
        search: 'demo',
        status: 'active',
      });
    }, { timeout: 1_000 });

    await act(async () => {
      await result.current.loadInstance('demo');
    });

    expect(result.current.selectedInstance?.instanceId).toBe('demo');

    act(() => {
      result.current.clearSelectedInstance();
    });

    expect(result.current.selectedInstance).toBeNull();
  });

  it('runs mutations, refetches, and reloads instance details', async () => {
    const { result } = renderHook(() => useInstances());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.createInstance({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'studio.example.org',
      });
      await result.current.activateInstance('demo');
      await result.current.suspendInstance('demo');
      await result.current.archiveInstance('demo');
    });

    expect(createInstanceMock).toHaveBeenCalledTimes(1);
    expect(activateInstanceMock).toHaveBeenCalledTimes(1);
    expect(suspendInstanceMock).toHaveBeenCalledTimes(1);
    expect(archiveInstanceMock).toHaveBeenCalledTimes(1);
    expect(getInstanceMock).toHaveBeenCalled();
  });

  it('invalidates permissions on forbidden load and mutation failures', async () => {
    listInstancesMock.mockRejectedValueOnce({
      status: 403,
      code: 'forbidden',
      message: 'forbidden',
    });
    getInstanceMock.mockRejectedValueOnce({
      status: 403,
      code: 'forbidden',
      message: 'forbidden',
    });
    createInstanceMock.mockRejectedValueOnce({
      status: 403,
      code: 'forbidden',
      message: 'forbidden',
    });

    const { result } = renderHook(() => useInstances());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error?.status).toBe(403);
    expect(result.current.instances).toEqual([]);

    await act(async () => {
      await result.current.loadInstance('demo');
    });
    expect(result.current.mutationError?.status).toBe(403);

    await act(async () => {
      const created = await result.current.createInstance({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'studio.example.org',
      });
      expect(created).toBeNull();
    });

    act(() => {
      result.current.clearMutationError();
    });

    expect(result.current.mutationError).toBeNull();
    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(3);
  });
});
