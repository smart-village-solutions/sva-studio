import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  listModuleActivations: vi.fn(),
  listLifecycles: vi.fn(),
}));

vi.mock('../iam-instance-registry/plugin-activation-policy-snapshot.js', () => ({
  readInstanceRegistryPluginTenantLifecycleRegistry: () =>
    new Map([
      [
        'speech',
        {
          pluginId: 'speech',
          contractVersion: 1,
          operations: [
            { operation: 'reconcile', jobTypeId: 'speech.reconcileTenant' },
            { operation: 'readiness', jobTypeId: 'speech.checkReadiness' },
          ],
          readinessChecks: [
            {
              checkId: 'speech.databaseSchema',
              titleKey: 'speech.readiness.databaseSchema',
              required: true,
              repairOperation: 'reconcile',
            },
          ],
        },
      ],
      [
        'inactive',
        {
          pluginId: 'inactive',
          contractVersion: 1,
          operations: [],
          readinessChecks: [],
        },
      ],
    ]),
}));

vi.mock('../iam-instance-registry/repository.js', () => ({
  withRegistryRepository: async (work: (repository: unknown) => Promise<unknown>) =>
    work({ listModuleActivations: state.listModuleActivations }),
}));

vi.mock('../plugin-operations/repository.js', () => ({
  withPluginTenantLifecycleRepository: async (
    _instanceId: string,
    work: (repository: unknown) => Promise<unknown>
  ) => work({ listLifecycles: state.listLifecycles }),
}));

describe('configured plugin tenant readiness read model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.listModuleActivations.mockResolvedValue([
      {
        moduleId: 'speech',
        activationPolicy: 'required',
        effectiveActive: true,
        updatedAt: '2026-08-30T12:00:00.000Z',
      },
      {
        moduleId: 'inactive',
        activationPolicy: 'optional',
        effectiveActive: false,
        updatedAt: '2026-08-30T12:00:00.000Z',
      },
    ]);
    state.listLifecycles.mockResolvedValue([]);
  });

  it('returns active declared plugins and treats missing lifecycle evidence as pending', async () => {
    const { readConfiguredPluginTenantReadiness } = await import('./read-model.js');

    await expect(readConfiguredPluginTenantReadiness('tenant-a')).resolves.toEqual([
      expect.objectContaining({
        pluginId: 'speech',
        activationPolicy: 'required',
        effectiveActive: true,
        status: 'pending',
        evidenceState: 'missing',
        desiredGeneration: 0,
        checks: [
          expect.objectContaining({
            checkId: 'speech.databaseSchema',
            status: 'pending',
            repairOperation: 'reconcile',
          }),
        ],
      }),
    ]);
    expect(state.listModuleActivations).toHaveBeenCalledWith('tenant-a');
    expect(state.listLifecycles).toHaveBeenCalledWith('tenant-a');
  });

  it('rejects missing lifecycle definitions and activation records during provisioning', async () => {
    const { readProvisioningModuleReadiness } = await import('./read-model.js');
    const speechLifecycle = {
      pluginId: 'speech',
      contractVersion: 1,
      operations: [{ operation: 'readiness' as const, jobTypeId: 'speech.checkReadiness' }],
      readinessChecks: [
        {
          checkId: 'speech.databaseSchema',
          titleKey: 'speech.readiness.databaseSchema',
          required: true,
          repairOperation: 'reconcile' as const,
        },
      ],
    };

    await expect(
      readProvisioningModuleReadiness({ instanceId: 'tenant-a', lifecycles: [] })
    ).rejects.toThrow('provisioning_plugin_snapshot_missing');

    state.listModuleActivations.mockResolvedValueOnce([]);
    await expect(
      readProvisioningModuleReadiness({
        instanceId: 'tenant-a',
        lifecycles: [speechLifecycle],
      })
    ).rejects.toThrow('provisioning_plugin_activation_missing');
  });

  it('projects ready, pending, and terminally blocked provisioning evidence', async () => {
    const { readProvisioningModuleReadiness } = await import('./read-model.js');
    const speechLifecycle = {
      pluginId: 'speech',
      contractVersion: 1,
      operations: [{ operation: 'readiness' as const, jobTypeId: 'speech.checkReadiness' }],
      readinessChecks: [
        {
          checkId: 'speech.databaseSchema',
          titleKey: 'speech.readiness.databaseSchema',
          required: true,
          repairOperation: 'reconcile' as const,
        },
      ],
    };
    const evidence = (readinessStatus: 'ready' | 'pending' | 'blocked') => ({
      pluginId: 'speech',
      accessState: 'active',
      readinessStatus,
      desiredOperation: 'readiness',
      desiredGeneration: 1,
      completedGeneration: readinessStatus === 'pending' ? 0 : 1,
      readinessRevision: 'schema:1',
      readinessChecks: [
        {
          checkId: 'speech.databaseSchema',
          status: readinessStatus === 'ready' ? 'ready' : 'blocked',
        },
      ],
      ...(readinessStatus === 'blocked'
        ? { errorCode: 'speech.schemaInvalid', retryKind: 'terminal' }
        : {}),
      updatedAt: '2026-08-30T12:05:00.000Z',
    });

    state.listLifecycles.mockResolvedValueOnce([evidence('ready')]);
    await expect(
      readProvisioningModuleReadiness({
        instanceId: 'tenant-a',
        lifecycles: [speechLifecycle],
      })
    ).resolves.toMatchObject({ status: 'ready' });

    state.listLifecycles.mockResolvedValueOnce([evidence('pending')]);
    await expect(
      readProvisioningModuleReadiness({
        instanceId: 'tenant-a',
        lifecycles: [speechLifecycle],
      })
    ).resolves.toMatchObject({ status: 'pending' });

    state.listLifecycles.mockResolvedValueOnce([evidence('blocked')]);
    await expect(
      readProvisioningModuleReadiness({
        instanceId: 'tenant-a',
        lifecycles: [speechLifecycle],
      })
    ).resolves.toMatchObject({
      status: 'blocked',
      errorCode: 'speech.schemaInvalid',
    });
  });
});
