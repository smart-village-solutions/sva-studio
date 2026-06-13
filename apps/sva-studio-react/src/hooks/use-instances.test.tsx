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
const bootstrapInstanceAdminStructureMock = vi.fn();
const revokeInstanceModuleMock = vi.fn();
const seedInstanceIamBaselineMock = vi.fn();
const createInstanceMock = vi.fn();
const updateInstanceMock = vi.fn();
const reconcileInstanceKeycloakMock = vi.fn();
const activateInstanceMock = vi.fn();
const suspendInstanceMock = vi.fn();
const archiveInstanceMock = vi.fn();
const getInstanceAuditRunMock = vi.fn();
const getSingleInstanceAuditRunMock = vi.fn();
const authMockValue = {
  invalidatePermissions: vi.fn(),
};

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
};

const renderUseInstancesHook = () => renderHook(() => useInstances());

const waitForInstancesLoaded = async (
  result: ReturnType<typeof renderUseInstancesHook>['result']
) => {
  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });
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
  getInstanceAuditRun: (...args: unknown[]) => getInstanceAuditRunMock(...args),
  getSingleInstanceAuditRun: (...args: unknown[]) => getSingleInstanceAuditRunMock(...args),
  planInstanceKeycloakProvisioning: (...args: unknown[]) => planInstanceKeycloakProvisioningMock(...args),
  executeInstanceKeycloakProvisioning: (...args: unknown[]) => executeInstanceKeycloakProvisioningMock(...args),
  probeTenantIamAccess: (...args: unknown[]) => probeTenantIamAccessMock(...args),
  assignInstanceModule: (...args: unknown[]) => assignInstanceModuleMock(...args),
  bootstrapInstanceAdminStructure: (...args: unknown[]) => bootstrapInstanceAdminStructureMock(...args),
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
    getInstanceAuditRunMock.mockResolvedValue({
      data: {
        generatedAt: '2026-06-10T10:00:00.000Z',
        overallStatus: 'pass',
        summary: {
          totalInstances: 1,
          passedInstances: 1,
          warnedInstances: 0,
          failedInstances: 0,
          skippedInstances: 0,
        },
        checks: [],
        instances: [],
      },
    });
    getSingleInstanceAuditRunMock.mockResolvedValue({
      data: {
        generatedAt: '2026-06-10T10:00:00.000Z',
        overallStatus: 'pass',
        summary: {
          totalInstances: 1,
          passedInstances: 1,
          warnedInstances: 0,
          failedInstances: 0,
          skippedInstances: 0,
        },
        checks: [],
        instances: [
          {
            instanceId: 'demo',
            displayName: 'Demo',
            primaryHostname: 'demo.studio.example.org',
            status: 'active',
            overallStatus: 'pass',
            checks: [],
          },
        ],
      },
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
    bootstrapInstanceAdminStructureMock.mockResolvedValue({
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
    const { result } = renderUseInstancesHook();

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
    const { result } = renderUseInstancesHook();
    await waitForInstancesLoaded(result);

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
      await result.current.bootstrapAdminStructure('demo', ['news']);
      await result.current.activateInstance('demo');
      await result.current.suspendInstance('demo');
      await result.current.archiveInstance('demo');
    });

    expect(createInstanceMock).toHaveBeenCalledTimes(1);
    expect(updateInstanceMock).toHaveBeenCalledTimes(1);
    expect(probeTenantIamAccessMock).toHaveBeenCalledTimes(1);
    expect(reconcileInstanceKeycloakMock).toHaveBeenCalledTimes(1);
    expect(bootstrapInstanceAdminStructureMock).toHaveBeenCalledTimes(1);
    expect(activateInstanceMock).toHaveBeenCalledTimes(1);
    expect(suspendInstanceMock).toHaveBeenCalledTimes(1);
    expect(archiveInstanceMock).toHaveBeenCalledTimes(1);
    expect(getInstanceMock).toHaveBeenCalled();
    expect(getSingleInstanceAuditRunMock).toHaveBeenCalled();
    expect(browserLoggerMock.info).toHaveBeenCalledWith(
      'instance_mutation_succeeded',
      expect.objectContaining({
        operation: 'archive_instance',
        instance_id: 'demo',
      })
    );
  });

  it('merges tenant IAM status from explicit access probes into the selected instance', async () => {
    const { result } = renderUseInstancesHook();
    await waitForInstancesLoaded(result);

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

    const { result } = renderUseInstancesHook();
    await waitForInstancesLoaded(result);

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

    const { result } = renderUseInstancesHook();
    await waitForInstancesLoaded(result);

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

    const { result } = renderUseInstancesHook();
    await waitForInstancesLoaded(result);

    await act(async () => {
      await result.current.loadInstance('demo');
    });

    expect(result.current.selectedInstance?.instanceId).toBe('demo');
    expect(result.current.selectedInstance?.keycloakStatus).toBeUndefined();
    expect(result.current.mutationError).toEqual(expect.objectContaining({ status: 403, code: 'forbidden' }));
    expect(authMockValue.invalidatePermissions).toHaveBeenCalled();
  });

  it('invalidates permissions only once when detail and keycloak status both return forbidden', async () => {
    const invalidateDeferred = createDeferred<void>();
    authMockValue.invalidatePermissions.mockImplementationOnce(() => invalidateDeferred.promise);
    getInstanceMock.mockRejectedValueOnce({
      status: 403,
      code: 'forbidden',
      message: 'forbidden',
    });
    getInstanceKeycloakStatusMock.mockRejectedValueOnce({
      status: 403,
      code: 'forbidden',
      message: 'forbidden',
    });

    const { result } = renderUseInstancesHook();
    await waitForInstancesLoaded(result);

    const loadPromise = result.current.loadInstance('demo');

    await waitFor(() => {
      expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(1);
    });

    invalidateDeferred.resolve();

    await act(async () => {
      await loadPromise;
    });

    expect(result.current.mutationError).toEqual(expect.objectContaining({ status: 403, code: 'forbidden' }));
    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(1);
    expect(browserLoggerMock.info).toHaveBeenCalledTimes(1);
    expect(browserLoggerMock.info).toHaveBeenCalledWith(
      'permission_invalidated_after_403',
      expect.objectContaining({
        instance_id: 'demo',
      })
    );
  });

  it('surfaces normalized non-keycloak detail warnings after the instance detail itself loads successfully', async () => {
    getInstanceKeycloakStatusMock.mockRejectedValueOnce({
      status: 500,
      code: 'internal_error',
      message: 'kaputt',
    });

    const { result } = renderUseInstancesHook();
    await waitForInstancesLoaded(result);

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
    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(1);

    await act(async () => {
      const seeded = await result.current.seedIamBaseline('demo');
      expect(seeded).toEqual(expect.objectContaining({ assignedModules: ['news'] }));
    });
    expect(seedInstanceIamBaselineMock).toHaveBeenCalledWith('demo');
    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(2);

    await act(async () => {
      const revoked = await result.current.revokeModule('demo', 'news');
      expect(revoked).toEqual(expect.objectContaining({ assignedModules: [] }));
    });
    expect(revokeInstanceModuleMock).toHaveBeenCalledWith('demo', 'news');
    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(3);
  });

  it('keeps the current selected instance until the post-mutation reload finishes', async () => {
    const reloadedDetail = createDeferred<{
      data: {
        instanceId: string;
        displayName: string;
        status: string;
        parentDomain: string;
        primaryHostname: string;
        hostnames: never[];
        provisioningRuns: never[];
        keycloakProvisioningRuns: never[];
        auditEvents: never[];
        assignedModules: string[];
      };
    }>();
    getInstanceMock
      .mockResolvedValueOnce({
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
      })
      .mockImplementationOnce(() => reloadedDetail.promise);

    const { result } = renderHook(() => useInstances());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.loadInstance('demo');
    });

    let mutationPromise: Promise<unknown> | undefined;
    act(() => {
      mutationPromise = result.current.assignModule('demo', 'news');
    });

    await waitFor(() => {
      expect(assignInstanceModuleMock).toHaveBeenCalledWith('demo', 'news');
      expect(getInstanceMock).toHaveBeenCalledTimes(2);
    });

    expect(result.current.selectedInstance?.assignedModules).toEqual([]);

    reloadedDetail.resolve({
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

    await act(async () => {
      await mutationPromise;
    });

    expect(result.current.selectedInstance?.assignedModules).toEqual(['news']);
  });

  it('refreshes auth state after bootstrapping the admin structure', async () => {
    const { result } = renderHook(() => useInstances());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      const bootstrapped = await result.current.bootstrapAdminStructure('demo', ['news']);
      expect(bootstrapped).toEqual(expect.objectContaining({ assignedModules: ['news'] }));
    });

    expect(bootstrapInstanceAdminStructureMock).toHaveBeenCalledWith('demo', ['news']);
    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(1);
  });

  it('loads a full audit run for the instances overview', async () => {
    const { result } = renderHook(() => useInstances());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      const auditRun = await result.current.refreshInstancesAudit();
      expect(auditRun).toEqual(
        expect.objectContaining({
          overallStatus: 'pass',
          summary: expect.objectContaining({
            totalInstances: 1,
          }),
        })
      );
    });

    expect(getInstanceAuditRunMock).toHaveBeenCalledWith({ includeOnlyActive: true });
    expect(result.current.instancesAuditRun).toEqual(
      expect.objectContaining({
        overallStatus: 'pass',
      })
    );
  });

  it('loads and clears the single-instance audit state', async () => {
    const { result } = renderHook(() => useInstances());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      const auditRun = await result.current.refreshInstanceAudit('demo');
      expect(auditRun).toEqual(
        expect.objectContaining({
          overallStatus: 'pass',
        })
      );
    });

    expect(getSingleInstanceAuditRunMock).toHaveBeenCalledWith('demo');
    expect(result.current.instanceAuditRun).toEqual(
      expect.objectContaining({
        overallStatus: 'pass',
      })
    );

    act(() => {
      result.current.clearSelectedInstance();
    });

    expect(result.current.instanceAuditRun).toBeNull();
  });

  it('surfaces audit refresh failures and invalidates permissions on 403', async () => {
    getSingleInstanceAuditRunMock.mockRejectedValueOnce({
      status: 403,
      code: 'forbidden',
      message: 'nope',
    });
    getInstanceAuditRunMock.mockRejectedValueOnce({
      status: 403,
      code: 'forbidden',
      message: 'still nope',
    });

    const { result } = renderHook(() => useInstances());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      expect(await result.current.refreshInstanceAudit('demo')).toBeNull();
    });

    expect(result.current.mutationError).toEqual(
      expect.objectContaining({ status: 403, code: 'forbidden' })
    );
    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(1);

    await act(async () => {
      expect(
        await result.current.refreshInstancesAudit({
          includeOnlyActive: false,
          instanceIds: ['demo', 'bb-guben'],
        })
      ).toBeNull();
    });

    expect(getInstanceAuditRunMock).toHaveBeenCalledWith({
      includeOnlyActive: false,
      instanceIds: ['demo', 'bb-guben'],
    });
    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(2);
  });

  it('preserves an existing detail error while a successful audit refresh runs', async () => {
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

    expect(result.current.mutationError).toEqual(
      expect.objectContaining({
        status: 502,
        code: 'keycloak_unavailable',
      })
    );

    await act(async () => {
      await result.current.refreshInstanceAudit('demo');
    });

    expect(result.current.mutationError).toEqual(
      expect.objectContaining({
        status: 502,
        code: 'keycloak_unavailable',
      })
    );
  });

  it('ignores stale single-instance audit responses after switching to another instance', async () => {
    const demoAudit = createDeferred<{
      data: {
        generatedAt: string;
        includeOnlyActive: boolean;
        targetInstanceIds: string[];
        overallStatus: string;
        summary: {
          totalInstances: number;
          passedInstances?: number;
          warnedInstances?: number;
          failedInstances?: number;
          skippedInstances?: number;
          passCount?: number;
          warnCount?: number;
          failCount?: number;
          skipCount?: number;
        };
        checks: never[];
        instances: Array<{ instanceId: string; displayName: string; primaryHostname: string; status: string; overallStatus: string; checks: never[] }>;
      };
    }>();

    getSingleInstanceAuditRunMock
      .mockImplementationOnce(() => demoAudit.promise)
      .mockResolvedValueOnce({
        data: {
          generatedAt: '2026-06-10T10:05:00.000Z',
          includeOnlyActive: true,
          targetInstanceIds: ['bb-guben'],
          overallStatus: 'pass',
          summary: {
            totalInstances: 1,
            passCount: 1,
            failCount: 0,
            warnCount: 0,
            skipCount: 0,
          },
          checks: [],
          instances: [
            {
              instanceId: 'bb-guben',
              displayName: 'BB Guben',
              primaryHostname: 'bb-guben.studio.smart-village.app',
              status: 'active',
              overallStatus: 'pass',
              checks: [],
            },
          ],
        },
      });

    getInstanceMock
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
        data: {
          instanceId: 'bb-guben',
          displayName: 'BB Guben',
          status: 'active',
          parentDomain: 'studio.smart-village.app',
          primaryHostname: 'bb-guben.studio.smart-village.app',
          hostnames: [],
          provisioningRuns: [],
          keycloakProvisioningRuns: [],
          auditEvents: [],
        },
      });

    const { result } = renderHook(() => useInstances());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.loadInstance('demo');
    });

    const firstAuditPromise = result.current.refreshInstanceAudit('demo');

    await act(async () => {
      await result.current.loadInstance('bb-guben');
      await result.current.refreshInstanceAudit('bb-guben');
    });

    await act(async () => {
      demoAudit.resolve({
        data: {
          generatedAt: '2026-06-10T10:00:00.000Z',
          includeOnlyActive: true,
          targetInstanceIds: ['demo'],
          overallStatus: 'pass',
          summary: {
            totalInstances: 1,
            passCount: 1,
            failCount: 0,
            warnCount: 0,
            skipCount: 0,
          },
          checks: [],
          instances: [
            {
              instanceId: 'demo',
              displayName: 'Demo',
              primaryHostname: 'demo.studio.example.org',
              status: 'active',
              overallStatus: 'pass',
              checks: [],
            },
          ],
        },
      });
      await firstAuditPromise;
    });

    expect(result.current.selectedInstance?.instanceId).toBe('bb-guben');
    expect(result.current.instanceAuditRun?.targetInstanceIds).toEqual(['bb-guben']);
    expect(result.current.instanceAuditRun?.instances[0]?.instanceId).toBe('bb-guben');
  });

  it('keeps auditLoading true while overlapping audit requests are still pending', async () => {
    let resolveSingleAudit: ((value: unknown) => void) | undefined;
    let resolveOverviewAudit: ((value: unknown) => void) | undefined;

    getSingleInstanceAuditRunMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSingleAudit = resolve;
        })
    );
    getInstanceAuditRunMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOverviewAudit = resolve;
        })
    );

    const { result } = renderHook(() => useInstances());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let singleAuditPromise: Promise<unknown> | undefined;
    let overviewAuditPromise: Promise<unknown> | undefined;

    await act(async () => {
      singleAuditPromise = result.current.refreshInstanceAudit('demo');
      overviewAuditPromise = result.current.refreshInstancesAudit();
    });

    expect(result.current.auditLoading).toBe(true);

    await act(async () => {
      resolveSingleAudit?.({
        data: {
          generatedAt: '2026-06-10T12:00:00.000Z',
          includeOnlyActive: true,
          targetInstanceIds: ['demo'],
          overallStatus: 'pass',
          summary: { totalInstances: 1, passCount: 1, failCount: 0, warnCount: 0, skipCount: 0 },
          checks: [],
          instances: [],
        },
      });
      await Promise.resolve();
    });

    expect(result.current.auditLoading).toBe(true);

    await act(async () => {
      resolveOverviewAudit?.({
        data: {
          generatedAt: '2026-06-10T12:00:00.000Z',
          includeOnlyActive: true,
          targetInstanceIds: ['demo'],
          overallStatus: 'pass',
          summary: { totalInstances: 1, passCount: 1, failCount: 0, warnCount: 0, skipCount: 0 },
          checks: [],
          instances: [],
        },
      });
      await Promise.all([singleAuditPromise, overviewAuditPromise]);
    });

    expect(result.current.auditLoading).toBe(false);
  });
});
