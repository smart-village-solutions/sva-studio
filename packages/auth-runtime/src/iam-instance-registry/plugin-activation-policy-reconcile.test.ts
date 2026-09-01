import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listInstances: vi.fn(),
  reconcileModuleActivationPolicies: vi.fn(),
  withRegistryService: vi.fn(),
  withScopedRegistryService: vi.fn(),
}));

vi.mock('./repository.js', () => ({
  withRegistryService: mocks.withRegistryService,
  withScopedRegistryService: mocks.withScopedRegistryService,
}));

import {
  readPluginActivationPolicyFleetReconcileReport,
  reconcileConfiguredPluginActivationPoliciesForAllInstances,
  resetPluginActivationPolicyFleetReconcileReportForTests,
} from './plugin-activation-policy-reconcile.js';

afterEach(() => {
  mocks.listInstances.mockReset();
  mocks.reconcileModuleActivationPolicies.mockReset();
  mocks.withRegistryService.mockReset();
  mocks.withScopedRegistryService.mockReset();
  resetPluginActivationPolicyFleetReconcileReportForTests();
});

const configureRegistryService = () => {
  mocks.withRegistryService.mockImplementation(
    async (operation: (service: unknown) => Promise<unknown>) =>
      operation({
        listInstances: mocks.listInstances,
        reconcileModuleActivationPolicies: mocks.reconcileModuleActivationPolicies,
      })
  );
  mocks.withScopedRegistryService.mockImplementation(
    async (instanceId: string, operation: (service: unknown) => Promise<unknown>) => {
      await mocks.reconcileModuleActivationPolicies({ instanceId });
      return operation({});
    }
  );
};

describe('plugin activation policy fleet reconcile', () => {
  it('reconciles every existing instance and publishes a ready report', async () => {
    configureRegistryService();
    mocks.listInstances.mockResolvedValue([
      { instanceId: 'instance-a' },
      { instanceId: 'instance-b' },
    ]);
    mocks.reconcileModuleActivationPolicies.mockResolvedValue({ changed: false });

    const report = await reconcileConfiguredPluginActivationPoliciesForAllInstances({
      revision: 'catalog-1',
    });

    expect(mocks.reconcileModuleActivationPolicies).toHaveBeenNthCalledWith(1, {
      instanceId: 'instance-a',
    });
    expect(mocks.reconcileModuleActivationPolicies).toHaveBeenNthCalledWith(2, {
      instanceId: 'instance-b',
    });
    expect(mocks.withScopedRegistryService).toHaveBeenNthCalledWith(
      1,
      'instance-a',
      expect.any(Function),
      { forceIamSync: true, awaitActivationPolicyFollowUp: true }
    );
    expect(mocks.withScopedRegistryService).toHaveBeenNthCalledWith(
      2,
      'instance-b',
      expect.any(Function),
      { forceIamSync: true, awaitActivationPolicyFollowUp: true }
    );
    expect(report).toEqual(
      expect.objectContaining({
        revision: 'catalog-1',
        status: 'ready',
        instanceCount: 2,
        reconciledInstanceCount: 2,
        failures: [],
      })
    );
    expect(readPluginActivationPolicyFleetReconcileReport()).toBe(report);
  });

  it('continues after an instance failure and identifies the degraded instance', async () => {
    configureRegistryService();
    mocks.listInstances.mockResolvedValue([
      { instanceId: 'instance-a' },
      { instanceId: 'instance-b' },
    ]);
    mocks.reconcileModuleActivationPolicies
      .mockRejectedValueOnce(new Error('database conflict'))
      .mockResolvedValueOnce({ changed: true });

    const report = await reconcileConfiguredPluginActivationPoliciesForAllInstances({
      revision: 'catalog-2',
    });

    expect(report).toEqual(
      expect.objectContaining({
        status: 'degraded',
        instanceCount: 2,
        reconciledInstanceCount: 1,
        failures: [
          {
            instanceId: 'instance-a',
            stage: 'reconcile_instance',
            code: 'plugin_activation_policy_reconcile_failed',
          },
        ],
      })
    );
  });

  it('publishes a degraded report when lifecycle follow-up scheduling fails', async () => {
    configureRegistryService();
    mocks.listInstances.mockResolvedValue([{ instanceId: 'instance-a' }]);
    mocks.withScopedRegistryService.mockRejectedValueOnce(new Error('queue unavailable'));

    await expect(
      reconcileConfiguredPluginActivationPoliciesForAllInstances({ revision: 'catalog-2' })
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'degraded',
        reconciledInstanceCount: 0,
        failures: [
          {
            instanceId: 'instance-a',
            stage: 'reconcile_instance',
            code: 'plugin_activation_policy_reconcile_failed',
          },
        ],
      })
    );
  });

  it('publishes a degraded report when the instance inventory is unavailable', async () => {
    mocks.withRegistryService.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(
      reconcileConfiguredPluginActivationPoliciesForAllInstances({ revision: 'catalog-3' })
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'degraded',
        instanceCount: 0,
        reconciledInstanceCount: 0,
        failures: [
          {
            stage: 'list_instances',
            code: 'plugin_activation_policy_reconcile_failed',
          },
        ],
      })
    );
  });
});
