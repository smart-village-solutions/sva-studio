import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listInstances: vi.fn(),
  reconcileModuleActivationPolicies: vi.fn(),
  withRegistryService: vi.fn(),
  withScopedRegistryService: vi.fn(),
  metricCallbacks: new Map<
    string,
    (result: {
      observe: (value: number, attributes?: Readonly<Record<string, string>>) => void;
    }) => void
  >(),
}));

vi.mock('@opentelemetry/api', () => ({
  metrics: {
    getMeter: () => ({
      createObservableGauge: (name: string) => ({
        addCallback: (
          callback: (result: {
            observe: (value: number, attributes?: Readonly<Record<string, string>>) => void;
          }) => void
        ) => {
          mocks.metricCallbacks.set(name, callback);
        },
      }),
    }),
  },
}));

vi.mock('./repository.js', () => ({
  withRegistryService: mocks.withRegistryService,
  withScopedRegistryService: mocks.withScopedRegistryService,
}));

import {
  readPluginActivationPolicyFleetReconcileReport,
  reconcileConfiguredPluginActivationPoliciesForAllInstances,
  recordUnexpectedPluginActivationPolicyFleetReconcileFailure,
  resetPluginActivationPolicyFleetReconcileReportForTests,
} from './plugin-activation-policy-reconcile.js';
import {
  configureInstanceRegistryPluginActivationPolicies,
  readInstanceRegistryPluginActivationPolicies,
} from './plugin-activation-policy-snapshot.js';

afterEach(() => {
  mocks.listInstances.mockReset();
  mocks.reconcileModuleActivationPolicies.mockReset();
  mocks.withRegistryService.mockReset();
  mocks.withScopedRegistryService.mockReset();
  resetPluginActivationPolicyFleetReconcileReportForTests();
});

const collectMetric = (metricName: string) => {
  const observations: Array<{
    value: number;
    attributes?: Readonly<Record<string, string>>;
  }> = [];
  const callback = mocks.metricCallbacks.get(metricName);
  if (!callback) throw new Error(`missing metric callback: ${metricName}`);
  callback({
    observe: (value, attributes) => observations.push({ value, attributes }),
  });
  return observations;
};

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
  it('does not observe fleet metrics before this process owns a reconcile', () => {
    expect(collectMetric('sva_plugin_activation_policy_fleet_state')).toEqual([]);
    expect(collectMetric('sva_plugin_activation_policy_fleet_failure_count')).toEqual([]);
    expect(collectMetric('sva_plugin_activation_policy_fleet_seconds_since_success')).toEqual([]);
  });

  it('replaces a previous ready report with a bounded unexpected failure', async () => {
    configureRegistryService();
    mocks.listInstances.mockResolvedValue([]);
    await reconcileConfiguredPluginActivationPoliciesForAllInstances({ revision: 'catalog-1' });

    expect(readPluginActivationPolicyFleetReconcileReport()?.status).toBe('ready');

    expect(
      recordUnexpectedPluginActivationPolicyFleetReconcileFailure({ revision: 'catalog-2' })
    ).toEqual(
      expect.objectContaining({
        revision: 'catalog-2',
        status: 'degraded',
        failures: [
          expect.objectContaining({
            reasonCode: 'plugin_activation_policy_reconcile_unknown',
            retryClass: 'degraded',
          }),
        ],
      })
    );
    expect(collectMetric('sva_plugin_activation_policy_fleet_state')).toContainEqual({
      value: 1,
      attributes: { state: 'degraded' },
    });
    expect(collectMetric('sva_plugin_activation_policy_fleet_failure_count')).toContainEqual({
      value: 1,
      attributes: {
        reason_code: 'plugin_activation_policy_reconcile_unknown',
        retry_class: 'degraded',
      },
    });
  });

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

  it('does not publish a result from an obsolete runtime snapshot generation', async () => {
    let completeInstanceList: ((instances: readonly never[]) => void) | undefined;
    configureRegistryService();
    configureInstanceRegistryPluginActivationPolicies({ revision: 'catalog-1', modules: [] });
    mocks.listInstances.mockImplementationOnce(
      () =>
        new Promise<readonly never[]>((resolve) => {
          completeInstanceList = resolve;
        })
    );

    const reconcile = reconcileConfiguredPluginActivationPoliciesForAllInstances({
      revision: 'catalog-1',
    });
    await vi.waitFor(() => expect(mocks.listInstances).toHaveBeenCalledOnce());
    configureInstanceRegistryPluginActivationPolicies({ revision: 'catalog-2', modules: [] });
    completeInstanceList?.([]);

    await expect(reconcile).resolves.toEqual(
      expect.objectContaining({ revision: 'catalog-1', status: 'ready' })
    );
    expect(readPluginActivationPolicyFleetReconcileReport()).toBeUndefined();
    expect(collectMetric('sva_plugin_activation_policy_fleet_seconds_since_success')).toEqual([
      { value: -1, attributes: undefined },
    ]);
  });

  it('uses one immutable runtime snapshot throughout every instance mutation', async () => {
    const observedRevisions: string[] = [];
    configureRegistryService();
    configureInstanceRegistryPluginActivationPolicies({ revision: 'catalog-1', modules: [] });
    mocks.listInstances.mockResolvedValue([
      { instanceId: 'instance-a' },
      { instanceId: 'instance-b' },
    ]);
    mocks.withScopedRegistryService.mockImplementation(async (_instanceId, operation) => {
      observedRevisions.push(readInstanceRegistryPluginActivationPolicies().revision);
      if (observedRevisions.length === 1) {
        configureInstanceRegistryPluginActivationPolicies({ revision: 'catalog-2', modules: [] });
      }
      return operation({});
    });

    await reconcileConfiguredPluginActivationPoliciesForAllInstances({ revision: 'catalog-1' });

    expect(observedRevisions).toEqual(['catalog-1', 'catalog-1']);
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
            reasonCode: 'plugin_activation_policy_reconcile_unknown',
            retryClass: 'degraded',
          },
        ],
      })
    );
  });

  it('reports a mixed fleet as retrying when any failure is retryable', async () => {
    configureRegistryService();
    mocks.listInstances.mockResolvedValue([
      { instanceId: 'instance-a' },
      { instanceId: 'instance-b' },
    ]);
    mocks.withScopedRegistryService
      .mockRejectedValueOnce(new Error('waste_tenant_role_privilege_drift:instance-a'))
      .mockRejectedValueOnce(new Error('plugin_activation_state_conflict:instance-b'));

    await reconcileConfiguredPluginActivationPoliciesForAllInstances({ revision: 'catalog-2' });

    expect(collectMetric('sva_plugin_activation_policy_fleet_state')).toContainEqual({
      value: 1,
      attributes: { state: 'retrying' },
    });
  });

  it('publishes a degraded report when lifecycle follow-up scheduling fails', async () => {
    configureRegistryService();
    mocks.listInstances.mockResolvedValue([{ instanceId: 'instance-a' }]);
    mocks.withScopedRegistryService.mockRejectedValueOnce(
      new Error('plugin_tenant_lifecycle_schedule_exhausted:instance-a:ssf')
    );

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
            reasonCode: 'plugin_tenant_lifecycle_schedule_exhausted',
            retryClass: 'retryable',
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
            reasonCode: 'plugin_activation_policy_reconcile_unknown',
            retryClass: 'degraded',
          },
        ],
      })
    );
  });

  it('keeps a known activation conflict bounded and marks it as retryable', async () => {
    configureRegistryService();
    mocks.listInstances.mockResolvedValue([{ instanceId: 'instance-a' }]);
    mocks.withScopedRegistryService.mockRejectedValueOnce(
      new Error('plugin_activation_state_conflict:events')
    );

    await expect(
      reconcileConfiguredPluginActivationPoliciesForAllInstances({ revision: 'catalog-4' })
    ).resolves.toEqual(
      expect.objectContaining({
        failures: [
          {
            instanceId: 'instance-a',
            stage: 'reconcile_instance',
            code: 'plugin_activation_policy_reconcile_failed',
            reasonCode: 'plugin_activation_state_conflict',
            retryClass: 'retryable',
          },
        ],
      })
    );
  });

  it('does not expose an unknown exception message in the fleet report', async () => {
    configureRegistryService();
    mocks.listInstances.mockResolvedValue([{ instanceId: 'instance-a' }]);
    mocks.withScopedRegistryService.mockRejectedValueOnce(
      new Error('password=do-not-expose host=internal.example')
    );

    const report = await reconcileConfiguredPluginActivationPoliciesForAllInstances({
      revision: 'catalog-5',
    });

    expect(JSON.stringify(report)).not.toContain('do-not-expose');
    expect(report.failures[0]).toEqual(
      expect.objectContaining({
        reasonCode: 'plugin_activation_policy_reconcile_unknown',
        retryClass: 'degraded',
      })
    );
  });

  it('exports fleet state and bounded failure metrics from the latest report', async () => {
    configureRegistryService();
    mocks.listInstances.mockResolvedValue([{ instanceId: 'instance-a' }]);
    mocks.withScopedRegistryService.mockRejectedValueOnce(
      new Error('plugin_tenant_lifecycle_schedule_exhausted:instance-a:ssf')
    );

    await reconcileConfiguredPluginActivationPoliciesForAllInstances({ revision: 'catalog-6' });

    expect(collectMetric('sva_plugin_activation_policy_fleet_state')).toContainEqual({
      value: 1,
      attributes: { state: 'retrying' },
    });
    expect(collectMetric('sva_plugin_activation_policy_fleet_failure_count')).toContainEqual({
      value: 1,
      attributes: {
        reason_code: 'plugin_tenant_lifecycle_schedule_exhausted',
        retry_class: 'retryable',
      },
    });
    expect(collectMetric('sva_plugin_activation_policy_fleet_seconds_since_success')).toEqual([
      { value: -1, attributes: undefined },
    ]);
  });
});
