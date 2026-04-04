import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useInstances } from './use-instances';

const listInstancesMock = vi.fn();
const getInstanceMock = vi.fn();
const getInstanceKeycloakStatusMock = vi.fn();
const createInstanceMock = vi.fn();
const updateInstanceMock = vi.fn();
const reconcileInstanceKeycloakMock = vi.fn();
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
  getInstanceKeycloakStatus: (...args: unknown[]) => getInstanceKeycloakStatusMock(...args),
  createInstance: (...args: unknown[]) => createInstanceMock(...args),
  updateInstance: (...args: unknown[]) => updateInstanceMock(...args),
  reconcileInstanceKeycloak: (...args: unknown[]) => reconcileInstanceKeycloakMock(...args),
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
    getInstanceKeycloakStatusMock.mockResolvedValue({
      data: {
        realmExists: true,
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
    updateInstanceMock.mockResolvedValue({
      data: {
        instanceId: 'demo',
        displayName: 'Demo updated',
        status: 'active',
        parentDomain: 'studio.example.org',
        primaryHostname: 'demo.studio.example.org',
        hostnames: [],
        provisioningRuns: [],
        auditEvents: [],
      },
    });
    reconcileInstanceKeycloakMock.mockResolvedValue({
      data: {
        realmExists: true,
        clientExists: true,
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
    expect(result.current.selectedInstance?.keycloakStatus).toEqual({ realmExists: true });

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
        authRealm: 'demo',
        authClientId: 'sva-studio',
      });
      await result.current.updateInstance('demo', {
        displayName: 'Demo updated',
        parentDomain: 'studio.example.org',
        authRealm: 'demo',
        authClientId: 'sva-studio',
      });
      await result.current.reconcileKeycloak('demo', { rotateClientSecret: true });
      await result.current.activateInstance('demo');
      await result.current.suspendInstance('demo');
      await result.current.archiveInstance('demo');
    });

    expect(createInstanceMock).toHaveBeenCalledTimes(1);
    expect(updateInstanceMock).toHaveBeenCalledTimes(1);
    expect(reconcileInstanceKeycloakMock).toHaveBeenCalledTimes(1);
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
    updateInstanceMock.mockRejectedValueOnce({
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
        authRealm: 'demo',
        authClientId: 'sva-studio',
      });
      expect(created).toBeNull();
    });

    await act(async () => {
      const updated = await result.current.updateInstance('demo', {
        displayName: 'Demo updated',
        parentDomain: 'studio.example.org',
        authRealm: 'demo',
        authClientId: 'sva-studio',
      });
      expect(updated).toBeNull();
    });

    act(() => {
      result.current.clearMutationError();
    });

    expect(result.current.mutationError).toBeNull();
    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(4);
  });

  it('keeps instance details loaded when keycloak status refresh during load fails', async () => {
    getInstanceKeycloakStatusMock.mockRejectedValueOnce({
      status: 502,
      code: 'keycloak_unavailable',
      message: 'Keycloak unavailable',
    });

    const { result } = renderHook(() => useInstances());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.loadInstance('demo');
    });

    expect(result.current.selectedInstance?.instanceId).toBe('demo');
    expect(result.current.selectedInstance?.keycloakStatus).toBeUndefined();
    expect(result.current.mutationError).toEqual(
      expect.objectContaining({
        status: 502,
        code: 'keycloak_unavailable',
      })
    );
  });

  it('refreshes keycloak status in-place and handles forbidden refreshes', async () => {
    const { result } = renderHook(() => useInstances());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.loadInstance('demo');
    });

    getInstanceKeycloakStatusMock
      .mockResolvedValueOnce({
        data: {
          realmExists: true,
          clientExists: true,
          runtimeSecretSource: 'tenant',
        },
      })
      .mockRejectedValueOnce({
        status: 403,
        code: 'forbidden',
        message: 'forbidden',
      });

    await act(async () => {
      const refreshed = await result.current.refreshKeycloakStatus('demo');
      expect(refreshed).toEqual(
        expect.objectContaining({
          clientExists: true,
          runtimeSecretSource: 'tenant',
        })
      );
    });

    expect(result.current.selectedInstance?.keycloakStatus).toEqual(
      expect.objectContaining({
        realmExists: true,
        clientExists: true,
        runtimeSecretSource: 'tenant',
      })
    );

    await act(async () => {
      const refreshed = await result.current.refreshKeycloakStatus('demo');
      expect(refreshed).toBeNull();
    });

    expect(result.current.mutationError).toEqual(expect.objectContaining({ status: 403, code: 'forbidden' }));
    expect(authMockValue.invalidatePermissions).toHaveBeenCalled();
  });
});
