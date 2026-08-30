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
});
