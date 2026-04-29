import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useInstances } from './use-instances';

const browserLoggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const listInstancesMock = vi.fn();
const getInstanceMock = vi.fn();
const getInstanceKeycloakStatusMock = vi.fn();
const getInstanceKeycloakPreflightMock = vi.fn();
const getInstanceKeycloakProvisioningRunMock = vi.fn();
const planInstanceKeycloakProvisioningMock = vi.fn();
const executeInstanceKeycloakProvisioningMock = vi.fn();
const probeTenantIamAccessMock = vi.fn();
const assignInstanceModuleMock = vi.fn();
const revokeInstanceModuleMock = vi.fn();
const seedInstanceIamBaselineMock = vi.fn();
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
  getInstanceKeycloakPreflight: (...args: unknown[]) => getInstanceKeycloakPreflightMock(...args),
  getInstanceKeycloakProvisioningRun: (...args: unknown[]) => getInstanceKeycloakProvisioningRunMock(...args),
  planInstanceKeycloakProvisioning: (...args: unknown[]) => planInstanceKeycloakProvisioningMock(...args),
  executeInstanceKeycloakProvisioning: (...args: unknown[]) => executeInstanceKeycloakProvisioningMock(...args),
  probeTenantIamAccess: (...args: unknown[]) => probeTenantIamAccessMock(...args),
  assignInstanceModule: (...args: unknown[]) => assignInstanceModuleMock(...args),
  revokeInstanceModule: (...args: unknown[]) => revokeInstanceModuleMock(...args),
  seedInstanceIamBaseline: (...args: unknown[]) => seedInstanceIamBaselineMock(...args),
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

vi.mock('@sva/monitoring-client/logging', () => ({
  createBrowserLogger: () => browserLoggerMock,
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
        keycloakProvisioningRuns: [],
        auditEvents: [],
      },
    });
    getInstanceKeycloakStatusMock.mockResolvedValue({
      data: {
        realmExists: true,
      },
    });
    getInstanceKeycloakPreflightMock.mockResolvedValue({
      data: {
        overallStatus: 'ready',
        checks: [],
      },
    });
    getInstanceKeycloakProvisioningRunMock.mockResolvedValue({
      data: null,
    });
    planInstanceKeycloakProvisioningMock.mockResolvedValue({
      data: {
        overallStatus: 'ready',
        steps: [],
      },
    });
    executeInstanceKeycloakProvisioningMock.mockResolvedValue({
      data: null,
    });
    probeTenantIamAccessMock.mockResolvedValue({
      data: {
        configuration: { status: 'ready', summary: 'ok', source: 'registry' },
        access: { status: 'blocked', summary: 'forbidden', source: 'access_probe', requestId: 'req-probe-1' },
        reconcile: { status: 'unknown', summary: 'unknown', source: 'role_reconcile' },
        overall: { status: 'blocked', summary: 'blocked', source: 'access_probe', requestId: 'req-probe-1' },
      },
    });
    assignInstanceModuleMock.mockResolvedValue({
      data: {
        instanceId: 'demo',
        displayName: 'Demo',
        status: 'active',
        parentDomain: 'studio.example.org',
        primaryHostname: 'demo.studio.example.org',
        hostnames: [],
        provisioningRuns: [],
        keycloakProvisioningRuns: [],
        auditEvents: [],
        assignedModules: ['news'],
      },
    });
    revokeInstanceModuleMock.mockResolvedValue({
      data: {
        instanceId: 'demo',
        displayName: 'Demo',
        status: 'active',
        parentDomain: 'studio.example.org',
        primaryHostname: 'demo.studio.example.org',
        hostnames: [],
        provisioningRuns: [],
        keycloakProvisioningRuns: [],
        auditEvents: [],
        assignedModules: [],
      },
    });
    seedInstanceIamBaselineMock.mockResolvedValue({
      data: {
        instanceId: 'demo',
        displayName: 'Demo',
        status: 'active',
        parentDomain: 'studio.example.org',
        primaryHostname: 'demo.studio.example.org',
        hostnames: [],
        provisioningRuns: [],
        keycloakProvisioningRuns: [],
        auditEvents: [],
        assignedModules: ['news'],
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
        keycloakProvisioningRuns: [],
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
    expect(browserLoggerMock.debug).toHaveBeenCalledWith(
      'instance_detail_load_started',
      expect.objectContaining({
        instance_id: 'demo',
      })
    );

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
        realmMode: 'new',
        authRealm: 'demo',
        authClientId: 'sva-studio',
      });
      await result.current.updateInstance('demo', {
        displayName: 'Demo updated',
        parentDomain: 'studio.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
      });
      await result.current.probeTenantIamAccess('demo');
      await result.current.reconcileKeycloak('demo', { rotateClientSecret: true });
      await result.current.activateInstance('demo');
      await result.current.suspendInstance('demo');
      await result.current.archiveInstance('demo');
    });

    expect(createInstanceMock).toHaveBeenCalledTimes(1);
    expect(updateInstanceMock).toHaveBeenCalledTimes(1);
    expect(probeTenantIamAccessMock).toHaveBeenCalledTimes(1);
    expect(reconcileInstanceKeycloakMock).toHaveBeenCalledTimes(1);
    expect(activateInstanceMock).toHaveBeenCalledTimes(1);
    expect(suspendInstanceMock).toHaveBeenCalledTimes(1);
    expect(archiveInstanceMock).toHaveBeenCalledTimes(1);
    expect(getInstanceMock).toHaveBeenCalled();
    expect(browserLoggerMock.info).toHaveBeenCalledWith(
      'instance_mutation_succeeded',
      expect.objectContaining({
        operation: 'archive_instance',
        instance_id: 'demo',
      })
    );
  });

  it('merges tenant IAM status from explicit access probes into the selected instance', async () => {
    const { result } = renderHook(() => useInstances());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.loadInstance('demo');
    });

    await act(async () => {
      const status = await result.current.probeTenantIamAccess('demo');
      expect(status).toEqual(
        expect.objectContaining({
          access: expect.objectContaining({
            status: 'blocked',
            requestId: 'req-probe-1',
          }),
        })
      );
    });

    expect(result.current.selectedInstance?.tenantIamStatus).toEqual(
      expect.objectContaining({
        access: expect.objectContaining({
          status: 'blocked',
          requestId: 'req-probe-1',
        }),
      })
    );
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
        realmMode: 'new',
        authRealm: 'demo',
        authClientId: 'sva-studio',
      });
      expect(created).toBeNull();
    });

    await act(async () => {
      const updated = await result.current.updateInstance('demo', {
        displayName: 'Demo updated',
        parentDomain: 'studio.example.org',
        realmMode: 'existing',
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

  it('invalidates permissions when loading keycloak status during detail fetch returns forbidden', async () => {
    getInstanceKeycloakStatusMock.mockRejectedValueOnce({
      status: 403,
      code: 'forbidden',
      message: 'forbidden',
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
    expect(result.current.mutationError).toEqual(expect.objectContaining({ status: 403, code: 'forbidden' }));
    expect(authMockValue.invalidatePermissions).toHaveBeenCalled();
  });

  it('surfaces normalized non-keycloak detail warnings after the instance detail itself loads successfully', async () => {
    getInstanceKeycloakStatusMock.mockRejectedValueOnce({
      status: 500,
      code: 'internal_error',
      message: 'kaputt',
    });

    const { result } = renderHook(() => useInstances());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.loadInstance('demo');
    });

    expect(result.current.selectedInstance?.instanceId).toBe('demo');
    expect(result.current.mutationError).toEqual(expect.objectContaining({ status: 502, code: 'keycloak_unavailable' }));
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

  it('normalizes unexpected preflight and plan failures to keycloak_unavailable', async () => {
    getInstanceKeycloakPreflightMock.mockRejectedValueOnce({
      status: 500,
      code: 'internal_error',
      message: 'Authentifizierungsfehler.',
    });
    planInstanceKeycloakProvisioningMock.mockRejectedValueOnce({
      status: 500,
      code: 'internal_error',
      message: 'kaputt',
    });

    const { result } = renderHook(() => useInstances());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      const preflight = await result.current.refreshKeycloakPreflight('demo');
      expect(preflight).toBeNull();
    });

    expect(result.current.mutationError).toEqual(
      expect.objectContaining({ status: 502, code: 'keycloak_unavailable' })
    );

    await act(async () => {
      const plan = await result.current.planKeycloakProvisioning('demo');
      expect(plan).toBeNull();
    });

    expect(result.current.mutationError).toEqual(
      expect.objectContaining({ status: 502, code: 'keycloak_unavailable' })
    );
  });

  it('stores provisioning runs returned by execute and load operations', async () => {
    const { result } = renderHook(() => useInstances());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.loadInstance('demo');
    });

    reconcileInstanceKeycloakMock.mockResolvedValueOnce({
      data: {
        realmExists: true,
        clientExists: true,
        runtimeSecretSource: 'tenant',
      },
    });

    const queuedRun = {
      id: 'run-2',
      intent: 'provision',
      mode: 'existing',
      overallStatus: 'planned',
      driftSummary: 'queued',
      requestId: 'req-2',
      steps: [],
    };
    const finishedRun = {
      ...queuedRun,
      overallStatus: 'succeeded',
      driftSummary: 'done',
    };

    executeInstanceKeycloakProvisioningMock.mockResolvedValueOnce({
      data: queuedRun,
    });
    getInstanceKeycloakProvisioningRunMock.mockResolvedValueOnce({
      data: finishedRun,
    });

    await act(async () => {
      const queued = await result.current.executeKeycloakProvisioning('demo', { intent: 'provision' });
      expect(queued).toEqual(queuedRun);
    });

    await act(async () => {
      const loaded = await result.current.loadKeycloakProvisioningRun('demo', 'run-2');
      expect(loaded).toEqual(finishedRun);
    });

    expect(result.current.selectedInstance?.latestKeycloakProvisioningRun).toEqual(finishedRun);
    expect(result.current.selectedInstance?.keycloakProvisioningRuns?.[0]).toEqual(finishedRun);

    await act(async () => {
      const reconciled = await result.current.reconcileKeycloak('demo', { rotateClientSecret: true });
      expect(reconciled).toEqual(
        expect.objectContaining({
          clientExists: true,
          runtimeSecretSource: 'tenant',
        })
      );
    });
  });

  it('keeps selected instance unchanged when provisioning updates target a different instance', async () => {
    const { result } = renderHook(() => useInstances());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.loadInstance('demo');
    });

    executeInstanceKeycloakProvisioningMock.mockResolvedValueOnce({
      data: {
        id: 'run-3',
        intent: 'provision',
        mode: 'existing',
        overallStatus: 'planned',
        driftSummary: 'queued',
        requestId: 'req-3',
        steps: [],
      },
    });

    await act(async () => {
      await result.current.executeKeycloakProvisioning('other', { intent: 'provision' });
      await result.current.loadKeycloakProvisioningRun('other', 'run-3');
    });

    expect(result.current.selectedInstance?.instanceId).toBe('demo');
  });

  it('assigns and revokes modules and seeds the IAM baseline through instance mutations', async () => {
    const { result } = renderHook(() => useInstances());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.loadInstance('demo');
    });

    await act(async () => {
      const assigned = await result.current.assignModule('demo', 'news');
      expect(assigned).toEqual(expect.objectContaining({ assignedModules: ['news'] }));
    });
    expect(assignInstanceModuleMock).toHaveBeenCalledWith('demo', 'news');

    await act(async () => {
      const seeded = await result.current.seedIamBaseline('demo');
      expect(seeded).toEqual(expect.objectContaining({ assignedModules: ['news'] }));
    });
    expect(seedInstanceIamBaselineMock).toHaveBeenCalledWith('demo');

    await act(async () => {
      const revoked = await result.current.revokeModule('demo', 'news');
      expect(revoked).toEqual(expect.objectContaining({ assignedModules: [] }));
    });
    expect(revokeInstanceModuleMock).toHaveBeenCalledWith('demo', 'news');
  });
});
